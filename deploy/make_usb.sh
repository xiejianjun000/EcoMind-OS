#!/bin/bash
###############################################################################
# make_usb.sh — ECO-Audit V3.0 可启动U盘制作脚本（Phase 1 基础验证）
#
# 功能：
#   1. 检测并验证U盘设备
#   2. 使用 Ventoy 初始化U盘引导
#   3. 创建四分区布局（FAT32启动 / ext4持久化 / exFAT输出 / LUKS加密）
#   4. 安装 Ubuntu 22.04 Live ISO 到启动分区
#   5. 配置自动启动服务与审计入口
#
# 用法：
#   sudo ./make_usb.sh /dev/sdX              # 正式制作
#   sudo ./make_usb.sh --dry-run /dev/sdX    # 预演（不写入磁盘）
#   sudo ./make_usb.sh --help                # 帮助信息
#
# 依赖：parted, cryptsetup, ventoy, mkfs.*, rsync
# 版本：V3.0 Phase 1
# 日期：2026-06-14
###############################################################################
set -euo pipefail

# =========================== 全局配置 ===========================
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly LOG_FILE="/tmp/ecomind_usb_$(date +%Y%m%d_%H%M%S).log"

# 分区大小（MiB）
readonly PART_BOOT_SIZE=4096      # FAT32 启动分区
readonly PART_PERSIST_SIZE=8192   # ext4 持久化存储
readonly PART_OUTPUT_SIZE=16384   # exFAT 审计数据输出

# ISO 路径（可在环境变量中覆盖）
readonly UBUNTU_ISO="${UBUNTU_ISO:-${SCRIPT_DIR}/iso/ubuntu-22.04.3-live-server-amd64.iso}"
readonly WINPE_ISO="${WINPE_ISO:-${SCRIPT_DIR}/iso/winpe_audit.iso}"

# Ventoy
readonly VENTOY_VERSION="${VENTOY_VERSION:-1.0.97}"
readonly VENTOY_DIR="${VENTOY_DIR:-${SCRIPT_DIR}/ventoy}"

# LUKS 加密
readonly LUKS_NAME="ecomind_evidence"
readonly LUKS_KEY_FILE="${LUKS_KEY_FILE:-/dev/urandom}"  # 生产环境应使用密码

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
NC='\033[0m'

# 全局状态
DRY_RUN=false
USB_DEVICE=""
VENTOY_BIN=""

# =========================== 日志 ===========================
log()   { echo -e "${GREEN}[$(date +%H:%M:%S)] $*${NC}" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠ $*${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ✖ $*${NC}" | tee -a "$LOG_FILE" >&2; }
info()  { echo -e "${BLUE}[$(date +%H:%M:%S)] ℹ $*${NC}" | tee -a "$LOG_FILE"; }

# dry-run 执行：打印命令而不执行
run() {
    if $DRY_RUN; then
        info "[DRY-RUN] $*"
    else
        log ">>> $*"
        eval "$@" 2>&1 | tee -a "$LOG_FILE"
    fi
}

# =========================== 帮助 ===========================
usage() {
    cat <<EOF
用法: $SCRIPT_NAME [选项] <设备路径>

选项:
  --dry-run    预演模式，显示将执行的操作但不写入磁盘
  --ventoy-dir <路径>  Ventoy 安装目录 (默认: ./ventoy)
  --help       显示此帮助

示例:
  sudo $SCRIPT_NAME /dev/sdX              # 正式制作
  sudo $SCRIPT_NAME --dry-run /dev/sdX    # 预演

注意事项:
  1. 设备路径必须为 /dev/sdX 格式（不可带分区号如 sda1）
  2. U盘将被完全格式化，所有数据将丢失
  3. 需要 root 权限
  4. 请确保 ISO 文件已放置于 ${SCRIPT_DIR}/iso/ 目录
EOF
    exit 0
}

# =========================== 前置检查 ===========================
check_prerequisites() {
    log "=== 检查前置依赖 ==="

    # root 权限
    if [[ $EUID -ne 0 ]]; then
        error "需要 root 权限，请使用 sudo 运行"
        exit 1
    fi

    # 检查必需命令
    local required_cmds=(parted mkfs.vfat mkfs.ext4 rsync sha256sum)
    for cmd in "${required_cmds[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            error "缺少必要命令: $cmd（请安装对应包）"
            exit 1
        fi
    done

    # cryptsetup（可选，LUKS 分区需要）
    if ! command -v cryptsetup &>/dev/null; then
        warn "cryptsetup 未安装 — LUKS 加密分区将跳过"
    fi

    # Ventoy
    if [[ -d "$VENTOY_DIR" ]]; then
        VENTOY_BIN=$(find "$VENTOY_DIR" -name "ventoy" -type f 2>/dev/null | head -1)
        if [[ -n "$VENTOY_BIN" ]]; then
            log "Ventoy 已找到: $VENTOY_BIN"
        else
            warn "Ventoy 可执行文件未找到，将尝试安装..."
        fi
    else
        warn "Ventoy 目录不存在: $VENTOY_DIR"
    fi

    # 检查 ISO 文件
    if [[ ! -f "$UBUNTU_ISO" ]]; then
        warn "Ubuntu ISO 未找到: $UBUNTU_ISO"
        warn "请下载后放置于此，或设置环境变量 UBUNTU_ISO"
    else
        log "Ubuntu ISO 已就绪: $UBUNTU_ISO"
    fi

    if [[ ! -f "$WINPE_ISO" ]]; then
        warn "WinPE ISO 未找到: $WINPE_ISO（可选）"
    else
        log "WinPE ISO 已就绪: $WINPE_ISO"
    fi
}

# =========================== 设备验证 ===========================
validate_device() {
    local dev="$1"

    # 格式校验
    if [[ ! "$dev" =~ ^/dev/sd[a-z]$ ]]; then
        error "无效设备路径: $dev（必须是 /dev/sdX 格式，不带分区号）"
        exit 1
    fi

    # 设备是否存在
    if [[ ! -b "$dev" ]]; then
        error "设备不存在: $dev"
        exit 1
    fi

    # 安全检查：拒绝系统盘
    local root_dev
    root_dev=$(df / --output=source 2>/dev/null | tail -1 | sed 's/[0-9]*$//')
    if [[ "$dev" == "$root_dev" ]]; then
        error "⚠ 危险！$dev 可能是系统盘，拒绝操作！"
        exit 1
    fi

    # 检查是否已挂载
    if mount | grep -q "^${dev}"; then
        warn "设备 ${dev} 有分区已挂载，正在卸载..."
        run "umount ${dev}?* 2>/dev/null || true"
    fi

    # 显示设备信息
    log "设备信息:"
    lsblk -b -o NAME,SIZE,TYPE,MOUNTPOINT "$dev" 2>/dev/null || true

    local disk_size
    disk_size=$(blockdev --getsize64 "$dev" 2>/dev/null || echo 0)
    local disk_gb=$((disk_size / 1024 / 1024 / 1024))
    log "磁盘容量: ~${disk_gb} GB"

    if [[ $disk_gb -lt 60 ]]; then
        error "磁盘容量不足（需要 ≥64GB），当前约 ${disk_gb}GB"
        exit 1
    fi

    USB_DEVICE="$dev"
    log "设备验证通过: $dev"
}

# =========================== Ventoy 安装 ===========================
install_ventoy() {
    log "=== 安装 Ventoy 引导管理器 ==="

    if [[ -n "$VENTOY_BIN" && -x "$VENTOY_BIN" ]]; then
        log "Ventoy 已安装，跳过下载"
    else
        warn "Ventoy 需要手动安装或下载"
        warn "请从 https://github.com/ventoy/Ventoy/releases 下载 v${VENTOY_VERSION}"
        warn "解压至 ${VENTOY_DIR} 目录后重新运行此脚本"

        if $DRY_RUN; then
            info "[DRY-RUN] 将执行: ventoy -i $USB_DEVICE"
            return
        fi

        read -r -p "是否继续（Ventoy 未就绪，U盘将无引导）? [y/N] " answer
        if [[ ! "$answer" =~ ^[Yy]$ ]]; then
            error "操作取消"
            exit 1
        fi
    fi

    if $DRY_RUN; then
        info "[DRY-RUN] 将执行: $VENTOY_BIN -i $USB_DEVICE"
        return
    fi

    if [[ -n "$VENTOY_BIN" ]]; then
        log "正在安装 Ventoy 到 $USB_DEVICE ..."
        # Ventoy 会覆盖整个磁盘的分区表
        echo "y" | "$VENTOY_BIN" -i "$USB_DEVICE" 2>&1 | tee -a "$LOG_FILE"
        log "Ventoy 安装完成"
    fi
}

# =========================== 分区创建 ===========================
create_partitions() {
    log "=== 创建分区布局 ==="

    local disk_size
    disk_size=$(blockdev --getsize64 "$USB_DEVICE")
    local disk_mib=$((disk_size / 1024 / 1024))
    local luks_size=$((disk_mib - PART_BOOT_SIZE - PART_PERSIST_SIZE - PART_OUTPUT_SIZE))

    if [[ $luks_size -le 0 ]]; then
        error "剩余空间不足，无法创建 LUKS 分区"
        exit 1
    fi

    log "分区规划:"
    log "  分区1 (FAT32):    ${PART_BOOT_SIZE} MiB  — 启动分区"
    log "  分区2 (ext4):     ${PART_PERSIST_SIZE} MiB  — 持久化存储"
    log "  分区3 (exFAT):    ${PART_OUTPUT_SIZE} MiB  — 审计数据输出"
    log "  分区4 (LUKS):     ${luks_size} MiB  — 加密证据区"

    if $DRY_RUN; then
        info "[DRY-RUN] parted $USB_DEVICE mklabel gpt"
        info "[DRY-RUN] parted $USB_DEVICE mkpart primary fat32 1MiB $((PART_BOOT_SIZE + 1))MiB"
        info "[DRY-RUN] parted $USB_DEVICE mkpart primary ext4 $((PART_BOOT_SIZE + 1))MiB $((PART_BOOT_SIZE + PART_PERSIST_SIZE + 1))MiB"
        info "[DRY-RUN] parted $USB_DEVICE mkpart primary exfat $((PART_BOOT_SIZE + PART_PERSIST_SIZE + 1))MiB $((PART_BOOT_SIZE + PART_PERSIST_SIZE + PART_OUTPUT_SIZE + 1))MiB"
        info "[DRY-RUN] parted $USB_DEVICE mkpart primary $((PART_BOOT_SIZE + PART_PERSIST_SIZE + PART_OUTPUT_SIZE + 1))MiB 100%"
        return
    fi

    # 创建 GPT 分区表
    log "创建 GPT 分区表..."
    parted -s "$USB_DEVICE" mklabel gpt

    # 分区1: FAT32 启动分区
    log "创建分区1: FAT32 启动分区 (${PART_BOOT_SIZE} MiB)"
    parted -s "$USB_DEVICE" mkpart primary fat32 1MiB "$((PART_BOOT_SIZE + 1))MiB"
    parted -s "$USB_DEVICE" set 1 esp on

    # 分区2: ext4 持久化
    log "创建分区2: ext4 持久化存储 (${PART_PERSIST_SIZE} MiB)"
    parted -s "$USB_DEVICE" mkpart primary ext4 "$((PART_BOOT_SIZE + 1))MiB" "$((PART_BOOT_SIZE + PART_PERSIST_SIZE + 1))MiB"

    # 分区3: exFAT 输出
    log "创建分区3: exFAT 审计数据输出 (${PART_OUTPUT_SIZE} MiB)"
    parted -s "$USB_DEVICE" mkpart primary exfat "$((PART_BOOT_SIZE + PART_PERSIST_SIZE + 1))MiB" "$((PART_BOOT_SIZE + PART_PERSIST_SIZE + PART_OUTPUT_SIZE + 1))MiB"

    # 分区4: LUKS 加密
    log "创建分区4: LUKS 加密证据区 (${luks_size} MiB)"
    parted -s "$USB_DEVICE" mkpart primary "$((PART_BOOT_SIZE + PART_PERSIST_SIZE + PART_OUTPUT_SIZE + 1))MiB" 100%
    parted -s "$USB_DEVICE" set 4 encrypted on

    # 对齐优化
    parted -s "$USB_DEVICE" align-check optimal 1 2>/dev/null || true

    # 刷新内核分区表
    partprobe "$USB_DEVICE" 2>/dev/null || sleep 3

    log "分区创建完成"
    lsblk -f "$USB_DEVICE"
}

# =========================== 格式化分区 ===========================
format_partitions() {
    log "=== 格式化分区 ==="

    local dev_boot="${USB_DEVICE}1"
    local dev_persist="${USB_DEVICE}2"
    local dev_output="${USB_DEVICE}3"
    local dev_luks="${USB_DEVICE}4"

    # FAT32
    log "格式化分区1 (FAT32): $dev_boot"
    run "mkfs.vfat -F 32 -n 'ECOAUDIT_BOOT' $dev_boot"

    # ext4
    log "格式化分区2 (ext4): $dev_persist"
    run "mkfs.ext4 -L 'ECOAUDIT_PERSIST' -E lazy_itable_init=0,lazy_journal_init=0 $dev_persist"

    # exFAT
    log "格式化分区3 (exFAT): $dev_output"
    if command -v mkfs.exfat &>/dev/null; then
        run "mkfs.exfat -L 'ECOAUDIT_OUTPUT' $dev_output"
    else
        warn "mkfs.exfat 不可用，回退到 FAT32"
        run "mkfs.vfat -F 32 -n 'ECOAUDIT_OUTPUT' $dev_output"
    fi

    # LUKS（可选）
    if command -v cryptsetup &>/dev/null; then
        log "创建 LUKS 加密分区: $dev_luks"
        if $DRY_RUN; then
            info "[DRY-RUN] cryptsetup luksFormat --type luks2 $dev_luks"
        else
            warn "⚠ LUKS 格式化将需要输入密码"
            read -r -p "是否创建 LUKS 加密分区? [y/N] " luks_answer
            if [[ "$luks_answer" =~ ^[Yy]$ ]]; then
                cryptsetup luksFormat --type luks2 --label "ECOAUDIT_EVIDENCE" "$dev_luks"
                log "LUKS 分区创建成功"
            else
                warn "跳过 LUKS 分区创建"
            fi
        fi
    else
        warn "cryptsetup 不可用，跳过 LUKS 分区"
    fi

    log "分区格式化完成"
}

# =========================== 安装 ISO ===========================
install_iso() {
    log "=== 安装 ISO 镜像到启动分区 ==="

    local dev_boot="${USB_DEVICE}1"
    local mount_point="/tmp/ecomind_boot_$$"

    if $DRY_RUN; then
        info "[DRY-RUN] mount $dev_boot $mount_point"
        info "[DRY-RUN] cp $UBUNTU_ISO $mount_point/iso/"
        return
    fi

    # 挂载启动分区
    mkdir -p "$mount_point"
    mount "$dev_boot" "$mount_point"

    # 创建目录结构
    mkdir -p "$mount_point/iso"
    mkdir -p "$mount_point/ventoy"

    # 复制 Ubuntu ISO
    if [[ -f "$UBUNTU_ISO" ]]; then
        log "复制 Ubuntu ISO 到启动分区..."
        rsync -avh --progress "$UBUNTU_ISO" "$mount_point/iso/"
        log "Ubuntu ISO 已安装"
    else
        warn "Ubuntu ISO 未找到，跳过"
    fi

    # 复制 WinPE ISO
    if [[ -f "$WINPE_ISO" ]]; then
        log "复制 WinPE ISO 到启动分区..."
        rsync -avh --progress "$WINPE_ISO" "$mount_point/iso/"
        log "WinPE ISO 已安装"
    fi

    # Ventoy 配置文件
    cat > "$mount_point/ventoy/ventoy.json" <<'VENTOY_CFG'
{
    "control": [
        { "VTOY_DEFAULT_SEARCH_PATH": "/iso" },
        { "VTOY_FILT_DOT_UNDERSCORE_FILE": "true" }
    ],
    "theme": {
        "file": "/ventoy/theme/theme.txt",
        "display_mode": "GUI",
        "fonts": []
    }
}
VENTOY_CFG

    # Ventoy 自动启动配置
    cat > "$mount_point/ventoy/ventoy_grub.cfg" <<'GRUB_CFG'
# Ventoy 自动启动配置 — ECO-Audit V3.0
# 默认选择 Ubuntu 22.04 Live Server
set timeout=5
set default=0
GRUB_CFG

    sync
    umount "$mount_point"
    rmdir "$mount_point"

    log "ISO 安装完成"
}

# =========================== 持久化分区配置 ===========================
setup_persistent_partition() {
    log "=== 配置持久化分区 (ext4) ==="

    local dev_persist="${USB_DEVICE}2"
    local mount_point="/tmp/ecomind_persist_$$"

    if $DRY_RUN; then
        info "[DRY-RUN] mount $dev_persist $mount_point"
        info "[DRY-RUN] 创建目录结构: /opt/ecomind/{scripts,engine,models,config}"
        info "[DRY-RUN] 复制部署文件到持久化分区"
        return
    fi

    mkdir -p "$mount_point"
    mount "$dev_persist" "$mount_point"

    # 创建目录结构
    log "创建目录结构..."
    mkdir -p "$mount_point/opt/ecomind/scripts"
    mkdir -p "$mount_point/opt/ecomind/engine"
    mkdir -p "$mount_point/opt/ecomind/models"
    mkdir -p "$mount_point/opt/ecomind/config"
    mkdir -p "$mount_point/opt/ecomind/logs"
    mkdir -p "$mount_point/opt/ecomind/rules"
    mkdir -p "$mount_point/etc/systemd/system"

    # 复制部署文件
    if [[ -d "$SCRIPT_DIR/scripts" ]]; then
        log "复制脚本到持久化分区..."
        cp -av "$SCRIPT_DIR/scripts/"*.sh "$mount_point/opt/ecomind/scripts/" 2>/dev/null || true
        cp -av "$SCRIPT_DIR/scripts/"*.py "$mount_point/opt/ecomind/scripts/" 2>/dev/null || true
    fi

    if [[ -d "$SCRIPT_DIR/systemd" ]]; then
        log "复制 systemd 服务配置..."
        cp -av "$SCRIPT_DIR/systemd/"*.service "$mount_point/etc/systemd/system/" 2>/dev/null || true
    fi

    # 复制规则文件
    if [[ -d "${SCRIPT_DIR}/../backend" ]]; then
        log "复制审计规则文件..."
        mkdir -p "$mount_point/opt/ecomind/rules"
        cp -rv "${SCRIPT_DIR}/../backend/rules/"* "$mount_point/opt/ecomind/rules/" 2>/dev/null || true
    fi

    # 生成基线校验文件
    log "生成 SHA256 黄金基线..."
    (cd "$mount_point/opt/ecomind" && find . -type f -exec sha256sum {} \; > "$mount_point/opt/ecomind/baseline.sha256") 2>/dev/null || true

    sync
    umount "$mount_point"
    rmdir "$mount_point"

    log "持久化分区配置完成"
}

# =========================== 输出分区配置 ===========================
setup_output_partition() {
    log "=== 配置审计数据输出分区 (exFAT) ==="

    local dev_output="${USB_DEVICE}3"
    local mount_point="/tmp/ecomind_output_$$"

    if $DRY_RUN; then
        info "[DRY-RUN] mount $dev_output $mount_point"
        info "[DRY-RUN] 创建审计报告输出目录结构"
        return
    fi

    mkdir -p "$mount_point"
    # 尝试 exFAT 挂载，失败则用 FAT32 挂载
    mount -t exfat "$dev_output" "$mount_point" 2>/dev/null || \
    mount -t vfat "$dev_output" "$mount_point" 2>/dev/null || true

    # 创建报告输出目录
    mkdir -p "$mount_point/audit_reports"
    mkdir -p "$mount_point/evidence_packages"
    mkdir -p "$mount_point/screenshots"
    mkdir -p "$mount_point/logs"

    # 创建 README
    cat > "$mount_point/README.txt" <<'README'
ECO-Audit V3.0 审计数据输出区
================================
目录结构:
  audit_reports/     — HTML/PDF 审计报告
  evidence_packages/ — SHA256 签名证据包 (ZIP)
  screenshots/       — 取证截图
  logs/              — 审计运行日志

注意: 本分区为跨平台格式 (exFAT)，可在 Windows/Linux/macOS 读取。
      重要证据请从 LUKS 加密区获取。
README

    sync
    umount "$mount_point" 2>/dev/null || true
    rmdir "$mount_point" 2>/dev/null || true

    log "输出分区配置完成"
}

# =========================== LUKS 分区初始化 ===========================
setup_luks_partition() {
    log "=== 初始化 LUKS 加密证据区 ==="

    local dev_luks="${USB_DEVICE}4"

    if ! command -v cryptsetup &>/dev/null; then
        warn "cryptsetup 不可用，跳过 LUKS 初始化"
        return
    fi

    # 检查是否已是 LUKS 格式
    if cryptsetup isLuks "$dev_luks" 2>/dev/null; then
        log "LUKS 分区已初始化"
    else
        warn "LUKS 分区未初始化，请在使用时通过 guardian.sh 手动格式化"
        warn "命令: cryptsetup luksFormat --type luks2 $dev_luks"
    fi

    log "LUKS 分区状态检查完成"
}

# =========================== 完成汇报 ===========================
print_summary() {
    log ""
    log "=============================================="
    log "  ECO-Audit V3.0 U盘制作完成！"
    log "=============================================="
    log ""
    log "设备: $USB_DEVICE"
    log ""
    log "分区布局:"
    lsblk -f "$USB_DEVICE" 2>/dev/null || lsblk "$USB_DEVICE"
    log ""
    log "下一步:"
    log "  1. 将 U盘插入目标工控机"
    log "  2. 从 U盘启动（选择 Ubuntu 22.04 Live Server）"
    log "  3. 挂载持久化分区并执行:"
    log "     sudo systemctl enable --now guardian.service"
    log "     sudo systemctl enable --now hermes-api.service"
    log "     sudo systemctl enable --now openclaw-audit.service"
    log ""
    log "日志文件: $LOG_FILE"
    log "=============================================="
}

# =========================== 主流程 ===========================
main() {
    log "=============================================="
    log "  ECO-Audit V3.0 — 可启动U盘制作工具"
    log "  Phase 1: 基础验证"
    log "  日期: $(date '+%Y-%m-%d %H:%M')"
    log "=============================================="

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                DRY_RUN=true
                log "DRY-RUN 模式已启用"
                shift
                ;;
            --ventoy-dir)
                VENTOY_DIR="$2"
                shift 2
                ;;
            --help|-h)
                usage
                ;;
            /dev/*)
                USB_DEVICE="$1"
                shift
                ;;
            *)
                error "未知参数: $1"
                usage
                ;;
        esac
    done

    if [[ -z "$USB_DEVICE" ]]; then
        error "请指定 U盘设备路径 (如 /dev/sdb)"
        usage
    fi

    # 用户确认
    if ! $DRY_RUN; then
        warn "⚠ 此操作将格式化设备 $USB_DEVICE，所有数据将丢失！"
        read -r -p "确认继续？[y/N] " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            error "操作已取消"
            exit 1
        fi
    fi

    # 执行流程
    check_prerequisites
    validate_device "$USB_DEVICE"
    install_ventoy
    create_partitions
    format_partitions
    install_iso
    setup_persistent_partition
    setup_output_partition
    setup_luks_partition
    print_summary
}

main "$@"
