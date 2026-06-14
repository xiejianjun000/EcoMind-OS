#!/bin/bash
###############################################################################
# audit_entry.sh — ECO-Audit V3.0 审计入口脚本
#
# 职责:
#   1. 自动检测目标工控机磁盘
#   2. 加载协议适配库
#   3. 执行三级审计（快速 / 标准 / 完整）
#   4. 生成审计报告
#   5. 通过飞书推送通知
#
# 用法:
#   ./audit_entry.sh                          # 标准审计（默认）
#   ./audit_entry.sh --mode quick             # 快速审计
#   ./audit_entry.sh --mode full              # 完整审计
#   ./audit_entry.sh --target /dev/sda        # 指定目标磁盘
#   ./audit_entry.sh --dry-run                # 预演模式
#   ./audit_entry.sh --health-check           # 健康检查（systemd ExecStartPre）
#
# 版本: V3.0 Phase 1
# 日期: 2026-06-14
###############################################################################
set -euo pipefail

# =========================== 配置 ===========================
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly ENGINE_DIR="${SCRIPT_DIR}/../engine"
readonly RULES_DIR="${AUDIT_RULES_DIR:-/opt/ecomind/rules}"
readonly OUTPUT_DIR="${AUDIT_OUTPUT_DIR:-/opt/ecomind/output}"
readonly LOG_DIR="${AUDIT_LOG_DIR:-/opt/ecomind/logs}"
readonly FEISHU_SCRIPT="${SCRIPT_DIR}/feishu_notify.py"
readonly TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# 默认审计模式
AUDIT_MODE="${AUDIT_MODE:-standard}"
TARGET_DEVICE=""
DRY_RUN=false
HEALTH_CHECK=false

# 日志
mkdir -p "$LOG_DIR" "$OUTPUT_DIR"
readonly LOG_FILE="${LOG_DIR}/audit_${TIMESTAMP}.log"

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +%H:%M:%S)] $*${NC}" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠ $*${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ✖ $*${NC}" | tee -a "$LOG_FILE" >&2; }
info()  { echo -e "${BLUE}[$(date +%H:%M:%S)] ℹ $*${NC}" | tee -a "$LOG_FILE"; }

run() {
    if $DRY_RUN; then
        info "[DRY-RUN] $*"
    else
        eval "$@" 2>&1 | tee -a "$LOG_FILE"
    fi
}

# =========================== 帮助 ===========================
usage() {
    cat <<EOF
用法: $SCRIPT_NAME [选项]

选项:
  --mode <quick|standard|full>  审计模式 (默认: standard)
  --target <设备>               指定目标磁盘 (如 /dev/sda)
  --dry-run                     预演模式
  --health-check                健康检查模式
  --help                        显示帮助

审计模式说明:
  quick    快速扫描 — 规则 R001-R015，≤15分钟，4-8GB内存
  standard 标准审计 — 规则 R001-R110，≤30分钟，8-16GB内存
  full     完整审计 — 规则 R001-R200，≤60分钟，16GB+内存
EOF
    exit 0
}

# =========================== 健康检查 ===========================
health_check() {
    log "执行健康检查..."

    local errors=0

    # 检查必需目录
    for dir in "$ENGINE_DIR" "$RULES_DIR" "$OUTPUT_DIR" "$LOG_DIR"; do
        if [[ ! -d "$dir" ]]; then
            error "目录不存在: $dir"
            ((errors++))
        fi
    done

    # 检查必需脚本
    if [[ ! -x "$FEISHU_SCRIPT" ]]; then
        warn "飞书通知脚本不可执行: $FEISHU_SCRIPT"
    fi

    # 检查规则文件
    local rule_count
    rule_count=$(find "$RULES_DIR" -name "*.json" -o -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l)
    if [[ $rule_count -eq 0 ]]; then
        warn "未发现规则文件（审计将跳过规则引擎部分）"
    else
        log "规则文件: $rule_count 个"
    fi

    # 检查协议适配库
    if [[ -d "${ENGINE_DIR}/protocol_adapters" ]]; then
        local adapter_count
        adapter_count=$(find "${ENGINE_DIR}/protocol_adapters" -name "*.py" -o -name "*.so" 2>/dev/null | wc -l)
        log "协议适配器: $adapter_count 个"
    else
        warn "协议适配库未安装: ${ENGINE_DIR}/protocol_adapters"
    fi

    if [[ $errors -gt 0 ]]; then
        error "健康检查失败: $errors 个错误"
        exit 1
    fi

    log "健康检查通过 ✓"
    exit 0
}

# =========================== 检测目标磁盘 ===========================
detect_target_disk() {
    if [[ -n "$TARGET_DEVICE" ]]; then
        log "使用指定目标磁盘: $TARGET_DEVICE"
        return 0
    fi

    log "自动检测目标磁盘..."

    # 方法1: 查找非本机的物理磁盘
    local root_disk
    root_disk=$(df / --output=source 2>/dev/null | tail -1 | sed 's/[0-9]*$//')

    # 方法2: 查找 USB 连接的大容量磁盘
    local candidates
    candidates=$(lsblk -d -o NAME,SIZE,ROTA,TRAN -n 2>/dev/null | \
        grep -v "^$(basename "$root_disk")" | \
        awk '$4=="usb" || $4=="sata" {print "/dev/"$1, $2}' | head -5)

    if [[ $(echo "$candidates" | grep -c .) -eq 1 ]]; then
        TARGET_DEVICE=$(echo "$candidates" | awk '{print $1}')
        log "检测到目标磁盘: $TARGET_DEVICE"
        return 0
    fi

    if [[ $(echo "$candidates" | grep -c .) -gt 1 ]]; then
        warn "发现多个候选磁盘:"
        echo "$candidates" | while read -r dev size; do
            warn "  $dev ($size)"
        done
        warn "请使用 --target 指定目标磁盘"
        return 1
    fi

    error "未检测到目标磁盘"
    return 1
}

# =========================== 加载协议适配库 ===========================
load_protocol_adapters() {
    log "加载协议适配库..."

    local adapter_dir="${ENGINE_DIR}/protocol_adapters"
    if [[ ! -d "$adapter_dir" ]]; then
        warn "协议适配库目录不存在: $adapter_dir"
        return 0
    fi

    local adapters_found=0
    for adapter in "$adapter_dir"/*; do
        if [[ -f "$adapter" ]]; then
            info "  加载: $(basename "$adapter")"
            ((adapters_found++))
        fi
    done

    log "协议适配器已加载: $adapters_found 个"
}

# =========================== 三级审计 ===========================
run_audit() {
    local mode="$1"

    log "=============================================="
    log "  开始 ${mode} 审计"
    log "  目标磁盘: ${TARGET_DEVICE:-自动检测}"
    log "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log "=============================================="

    local start_time
    start_time=$(date +%s)

    case "$mode" in
        quick)
            run_audit_quick
            ;;
        standard)
            run_audit_standard
            ;;
        full)
            run_audit_full
            ;;
        *)
            error "未知审计模式: $mode"
            exit 1
            ;;
    esac

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log "审计完成，耗时: ${duration}秒"
    log "报告已保存至: $OUTPUT_DIR"
}

# 快速审计 — 纯规则引擎，无LLM推理
run_audit_quick() {
    log "[快速审计] 规则范围: R001-R015"
    log "[快速审计] 预计耗时: ≤15分钟"

    run "echo '快速审计 — 技术合规与反造假专项 (R001-R015)'"
    run "echo '  R001 隐藏菜单与后门扫描'"
    run "echo '  R002 进程白名单检查'"
    run "echo '  R004 全参数一致性快检'"
    run "echo '  R010 设备认证校验'"
    run "echo '  R015 数据完整性校验'"
    run "echo '  ... 以及其他快速规则'"

    # Phase 1: 输出占位报告
    generate_placeholder_report "quick"
}

# 标准审计 — 含 LLM 推理（3B模型）
run_audit_standard() {
    log "[标准审计] 规则范围: R001-R110"
    log "[标准审计] 预计耗时: ≤30分钟"

    run_audit_quick

    log "[标准审计] 深度审计: R016-R110"
    run "echo '  数据逻辑校验 (R051-R065)'"
    run "echo '  物理链路审计 (R101-R110)'"

    generate_placeholder_report "standard"
}

# 完整审计 — 含 LLM 推理（7B模型）+ 全规则
run_audit_full() {
    log "[完整审计] 规则范围: R001-R200"
    log "[完整审计] 预计耗时: ≤60分钟"

    run_audit_standard

    log "[完整审计] 扩展审计: R111-R200"
    run "echo '  运维质控审计 (R131-R160)'"
    run "echo '  第三方检测报告审计 (R161-R180)'"
    run "echo '  行业专项规则 (R181-R200)'"

    generate_placeholder_report "full"
}

# =========================== 生成报告 ===========================
generate_placeholder_report() {
    local mode="$1"
    local report_file="${OUTPUT_DIR}/audit_report_${mode}_${TIMESTAMP}.html"
    local json_file="${OUTPUT_DIR}/audit_result_${mode}_${TIMESTAMP}.json"

    log "生成审计报告..."

    # JSON 结果
    cat > "$json_file" <<EOF
{
    "version": "ECO-Audit-V3.0-Phase1",
    "audit_mode": "${mode}",
    "timestamp": "${TIMESTAMP}",
    "target_device": "${TARGET_DEVICE:-unknown}",
    "status": "placeholder",
    "message": "Phase 1 基础验证 — 报告结构占位",
    "rules_executed": [],
    "anomalies": [],
    "evidence_files": [],
    "sha256": ""
}
EOF

    # HTML 报告
    cat > "$report_file" <<EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>ECO-Audit V3.0 审计报告 — ${mode} 模式</title>
<style>
body { font-family: "Microsoft YaHei", sans-serif; margin: 40px; line-height: 1.6; }
h1 { color: #1a73e8; }
.meta { color: #666; font-size: 14px; }
.status { padding: 10px 20px; background: #fff3e0; border-left: 4px solid #ff9800; margin: 20px 0; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f5f5f5; }
</style>
</head>
<body>
<h1>🔍 ECO-Audit V3.0 审计报告</h1>
<p class="meta">
    审计模式: ${mode} |
    时间: ${TIMESTAMP} |
    目标磁盘: ${TARGET_DEVICE:-unknown}
</p>
<div class="status">
    ⚠ Phase 1 基础验证 — 此报告为结构占位，实际审计规则尚未部署
</div>
<h2>审计概览</h2>
<table>
<tr><th>项目</th><th>值</th></tr>
<tr><td>审计模式</td><td>${mode}</td></tr>
<tr><td>规则范围</td><td>占位（Phase 2 部署）</td></tr>
<tr><td>异常数量</td><td>0</td></tr>
<tr><td>置信度</td><td>N/A</td></tr>
</table>
<h2>下一步</h2>
<ul>
<li>Phase 2: 部署 OpenClaw 框架与协议适配库</li>
<li>Phase 3: 实现自进化学习引擎</li>
<li>Phase 4: 扩展至 ~200 条规则</li>
</ul>
</body>
</html>
EOF

    # 计算 SHA256
    local sha
    sha=$(sha256sum "$json_file" | awk '{print $1}')
    # 更新 SHA256
    sed -i "s/\"sha256\": \"\"/\"sha256\": \"${sha}\"/" "$json_file"

    log "报告已生成:"
    log "  HTML: $report_file"
    log "  JSON: $json_file"
}

# =========================== 飞书通知 ===========================
send_feishu_notification() {
    local mode="$1"
    local report_file="${OUTPUT_DIR}/audit_result_${mode}_${TIMESTAMP}.json"

    if [[ ! -x "$FEISHU_SCRIPT" ]]; then
        warn "飞书通知脚本不可用: $FEISHU_SCRIPT"
        return 0
    fi

    log "发送飞书通知..."
    python3 "$FEISHU_SCRIPT" \
        --action audit_complete \
        --mode "$mode" \
        --report "$report_file" \
        2>/dev/null || warn "飞书通知发送失败"
}

# =========================== 参数解析 ===========================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            AUDIT_MODE="$2"
            shift 2
            ;;
        --target)
            TARGET_DEVICE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --health-check)
            HEALTH_CHECK=true
            shift
            ;;
        --help|-h)
            usage
            ;;
        *)
            error "未知参数: $1"
            usage
            ;;
    esac
done

# =========================== 主流程 ===========================
main() {
    log "=============================================="
    log "  ECO-Audit V3.0 审计入口"
    log "  Phase 1: 基础验证"
    log "=============================================="

    # 健康检查模式
    if $HEALTH_CHECK; then
        health_check
    fi

    # 预演模式
    if $DRY_RUN; then
        info "[DRY-RUN] 审计模式: $AUDIT_MODE"
        info "[DRY-RUN] 目标设备: ${TARGET_DEVICE:-自动检测}"
        exit 0
    fi

    # 检测目标磁盘
    detect_target_disk

    # 加载协议适配库
    load_protocol_adapters

    # 执行审计
    run_audit "$AUDIT_MODE"

    # 飞书通知
    send_feishu_notification "$AUDIT_MODE"

    log "=============================================="
    log "  审计流程完成 ✓"
    log "=============================================="
}

main "$@"
