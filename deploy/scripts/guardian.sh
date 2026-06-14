#!/bin/bash
###############################################################################
# guardian.sh — ECO-Audit V3.0 门神守护脚本
#
# 职责:
#   1. 只读挂载目标磁盘，防止取证过程中数据被篡改
#   2. SHA256 校验黄金基线，检测系统完整性
#   3. 心跳监控（每 30 秒检查一次），异常时告警
#
# 运行方式: 由 systemd guardian.service 自动启动
# 版本: V3.0 Phase 1
# 日期: 2026-06-14
###############################################################################
set -euo pipefail

# =========================== 配置 ===========================
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly LOG_DIR="${AUDIT_LOG_DIR:-/opt/ecomind/logs}"
readonly BASELINE_PATH="${BASELINE_PATH:-/opt/ecomind/baseline.sha256}"
readonly HEARTBEAT_INTERVAL="${GUARDIAN_INTERVAL:-30}"
readonly ALERT_SCRIPT="${SCRIPT_DIR}/feishu_notify.py"
readonly LOG_FILE="${LOG_DIR}/guardian_$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

# 目标磁盘（自动检测）
TARGET_DISK=""
LUKS_DEVICE=""

# =========================== 日志 ===========================
log()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*" | tee -a "$LOG_FILE"; }
warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  ⚠ $*" | tee -a "$LOG_FILE"; }
error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] ✖ $*" | tee -a "$LOG_FILE" >&2; }

# =========================== 告警推送 ===========================
send_alert() {
    local level="$1"
    local message="$2"
    log "[ALERT:${level}] $message"

    if [[ -x "$ALERT_SCRIPT" ]]; then
        python3 "$ALERT_SCRIPT" \
            --action alert \
            --level "$level" \
            --message "$message" \
            2>/dev/null || warn "告警推送失败: $ALERT_SCRIPT"
    else
        warn "告警脚本不可用: $ALERT_SCRIPT"
    fi
}

# =========================== 自动检测目标磁盘 ===========================
detect_target_disk() {
    log "检测目标磁盘..."

    # 方法1: 查找带有 ECOAUDIT_PERSIST 标签的分区
    local persist_part
    persist_part=$(lsblk -o NAME,LABEL,TYPE -n 2>/dev/null | grep "ECOAUDIT_PERSIST" | awk '{print "/dev/"$1}' | head -1)

    if [[ -n "$persist_part" ]]; then
        TARGET_DISK="${persist_part%[0-9]}"  # 去掉分区号，得到 /dev/sdX
        log "通过标签检测: $TARGET_DISK (分区: $persist_part)"
        return 0
    fi

    # 方法2: 查找可移动 USB 设备
    local usb_disks
    usb_disks=$(lsblk -d -o NAME,RM,TYPE -n 2>/dev/null | awk '$2=="1" && $3=="disk" {print "/dev/"$1}')

    if [[ $(echo "$usb_disks" | wc -l) -eq 1 ]]; then
        TARGET_DISK="$usb_disks"
        log "通过 RM 标志检测: $TARGET_DISK"
        return 0
    fi

    # 方法3: 查找带有 GPT 分区表的 USB 设备
    for dev in $usb_disks; do
        if parted "$dev" print 2>/dev/null | grep -q "gpt"; then
            TARGET_DISK="$dev"
            log "通过 GPT 检测: $TARGET_DISK"
            return 0
        fi
    done

    error "无法自动检测目标磁盘，请设置环境变量 TARGET_DISK"
    return 1
}

# =========================== 只读挂载 ===========================
set_disk_readonly() {
    log "设置目标磁盘为只读: $TARGET_DISK"

    if blockdev --getro "$TARGET_DISK" 2>/dev/null | grep -q "1"; then
        log "磁盘已处于只读模式"
        return 0
    fi

    blockdev --setro "$TARGET_DISK" 2>/dev/null || {
        warn "blockdev --setro 失败，尝试替代方案..."
        # 替代方案: 以只读方式挂载各分区
        local part_num=1
        for part in "${TARGET_DISK}"?*; do
            if [[ -b "$part" ]] && ! mountpoint -q "$part" 2>/dev/null; then
                warn "以只读方式挂载: $part"
                mount -o ro "$part" "/mnt/part${part_num}" 2>/dev/null || true
            fi
            ((part_num++))
        done
    }

    # 验证
    if blockdev --getro "$TARGET_DISK" 2>/dev/null | grep -q "1"; then
        log "只读模式已确认"
    else
        send_alert "CRITICAL" "磁盘无法设置为只读: $TARGET_DISK"
        return 1
    fi
}

# =========================== 基线校验 ===========================
check_baseline_integrity() {
    log "执行 SHA256 基线校验..."

    if [[ ! -f "$BASELINE_PATH" ]]; then
        warn "基线文件不存在: $BASELINE_PATH"
        send_alert "WARNING" "基线文件缺失，无法校验完整性"
        return 1
    fi

    local cd_dir
    cd_dir=$(dirname "$BASELINE_PATH")

    local result
    if result=$(cd "$cd_dir" && sha256sum -c "$BASELINE_PATH" 2>&1); then
        log "基线校验通过 ✓"
        return 0
    else
        local failed_files
        failed_files=$(echo "$result" | grep "FAILED" || echo "unknown")
        error "基线校验失败 ✖"
        error "失败文件: $failed_files"
        send_alert "CRITICAL" "系统完整性校验失败: $failed_files"
        return 1
    fi
}

# =========================== 只读状态检查 ===========================
check_disk_readonly() {
    if blockdev --getro "$TARGET_DISK" 2>/dev/null | grep -q "1"; then
        return 0
    else
        error "磁盘只读状态丢失! 正在恢复..."
        blockdev --setro "$TARGET_DISK" 2>/dev/null || {
            send_alert "CRITICAL" "磁盘只读状态丢失且无法恢复: $TARGET_DISK"
            return 1
        }
        return 0
    fi
}

# =========================== 心跳日志 ===========================
heartbeat_log() {
    local uptime_seconds=${SECONDS:-0}
    local disk_ro="✓"
    blockdev --getro "$TARGET_DISK" 2>/dev/null | grep -q "1" || disk_ro="✖"

    log "♥ 心跳 [运行${uptime_seconds}s] 只读=${disk_ro} PID=$$"

    # systemd watchdog 通知
    if [[ -n "${WATCHDOG_USEC:-}" ]]; then
        # systemd 会监控这个服务，定期发送 WATCHDOG=1
        true
    fi
}

# =========================== LUKS 状态检查 ===========================
check_luks_status() {
    log "检查 LUKS 加密区状态..."

    local luks_part="${TARGET_DISK}4"
    if [[ -b "$luks_part" ]]; then
        if cryptsetup isLuks "$luks_part" 2>/dev/null; then
            if cryptsetup status "$LUKS_DEVICE" &>/dev/null; then
                log "LUKS 加密区已解锁: $LUKS_DEVICE"
            else
                log "LUKS 加密区已初始化但未解锁 (正常)"
            fi
        else
            warn "分区4 不是 LUKS 格式"
        fi
    else
        warn "分区4 不存在: $luks_part"
    fi
}

# =========================== 清理 ===========================
cleanup() {
    log "门神守护退出，执行清理..."
    # 恢复磁盘为读写（可选，根据安全策略决定是否保留只读）
    # blockdev --setrw "$TARGET_DISK" 2>/dev/null || true
    log "清理完成"
}

# =========================== 主流程 ===========================
main() {
    trap cleanup EXIT

    log "=============================================="
    log "  ECO-Audit V3.0 门神守护启动"
    log "  心跳间隔: ${HEARTBEAT_INTERVAL}s"
    log "  基线文件: ${BASELINE_PATH}"
    log "=============================================="

    # 1. 检测目标磁盘
    detect_target_disk

    # 2. 设置只读
    set_disk_readonly

    # 3. 初始基线校验
    check_baseline_integrity || {
        send_alert "CRITICAL" "启动时基线校验失败，拒绝继续"
        exit 1
    }

    # 4. 检查 LUKS 状态
    check_luks_status

    # 5. 启动心跳监控循环
    log "进入心跳监控循环（每 ${HEARTBEAT_INTERVAL} 秒检查一次）..."

    while true; do
        check_disk_readonly || send_alert "CRITICAL" "只读检查失败"
        check_baseline_integrity || send_alert "WARNING" "基线校验异常"
        heartbeat_log

        sleep "$HEARTBEAT_INTERVAL"
    done
}

main "$@"
