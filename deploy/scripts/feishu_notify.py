#!/usr/bin/env python3
"""
feishu_notify.py — ECO-Audit V3.0 飞书通知模块

功能:
  - 审计完成通知
  - 异常情况告警
  - 报告下载链接
  - 心跳超时告警

用法:
  python3 feishu_notify.py --action audit_complete --mode standard --report /path/to/report.json
  python3 feishu_notify.py --action alert --level CRITICAL --message "基线校验失败"
  python3 feishu_notify.py --action heartbeat_timeout --duration 300

配置:
  环境变量:
    FEISHU_WEBHOOK      — 飞书机器人 Webhook URL
    FEISHU_SECRET       — 签名密钥 (可选)
    FEISHU_TEMPLATE_ID  — 消息卡片模板 ID (可选)

版本: V3.0 Phase 1
日期: 2026-06-14
"""

import argparse
import hashlib
import hmac
import base64
import json
import os
import sys
import time
from datetime import datetime
from urllib import request, error


# =========================== 配置 ===========================
WEBHOOK_URL = os.environ.get("FEISHU_WEBHOOK", "")
WEBHOOK_SECRET = os.environ.get("FEISHU_SECRET", "")
TEMPLATE_ID = os.environ.get("FEISHU_TEMPLATE_ID", "")
LOG_PREFIX = "[飞书通知]"


# =========================== 签名 ===========================
def generate_sign(timestamp: str) -> str:
    """生成飞书 Webhook 签名"""
    if not WEBHOOK_SECRET:
        return ""
    string_to_sign = f"{timestamp}\n{WEBHOOK_SECRET}"
    hmac_code = hmac.new(
        string_to_sign.encode("utf-8"), digestmod=hashlib.sha256
    ).digest()
    return base64.b64encode(hmac_code).decode("utf-8")


# =========================== 发送 ===========================
def send_to_feishu(payload: dict) -> bool:
    """发送消息到飞书 Webhook"""
    if not WEBHOOK_URL:
        print(f"{LOG_PREFIX} ⚠ Webhook URL 未配置，跳过发送", file=sys.stderr)
        return False

    timestamp = str(int(time.time()))
    sign = generate_sign(timestamp)

    # 添加签名
    if sign:
        payload["timestamp"] = timestamp
        payload["sign"] = sign

    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        WEBHOOK_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            if result.get("StatusCode") == 0 or result.get("code") == 0:
                print(f"{LOG_PREFIX} ✓ 消息发送成功")
                return True
            else:
                print(f"{LOG_PREFIX} ✖ 发送失败: {result}", file=sys.stderr)
                return False
    except error.URLError as e:
        print(f"{LOG_PREFIX} ✖ 网络错误: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"{LOG_PREFIX} ✖ 未知错误: {e}", file=sys.stderr)
        return False


# =========================== 消息模板 ===========================
def build_audit_complete_msg(mode: str, report_path: str) -> dict:
    """构建审计完成通知消息"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    mode_names = {
        "quick": "快速审计",
        "standard": "标准审计",
        "full": "完整审计",
    }
    mode_name = mode_names.get(mode, mode)

    return {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": "🔍 ECO-Audit 审计完成通知"},
                "template": "blue",
            },
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**审计模式**: {mode_name}"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**完成时间**: {now}"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**报告路径**: `{report_path}`"}},
                {"tag": "hr"},
                {"tag": "div", "text": {"tag": "lark_md", "content": "审计报告已生成，请及时查看并归档。"}},
                {"tag": "action", "actions": [
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": "下载报告"},
                        "type": "primary",
                        "url": f"file://{os.path.dirname(report_path)}",
                    }
                ]},
            ],
        },
    }


def build_alert_msg(level: str, message: str) -> dict:
    """构建异常告警消息"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 根据级别选择颜色
    template_map = {
        "CRITICAL": "red",
        "WARNING": "orange",
        "INFO": "blue",
    }
    template = template_map.get(level, "gray")

    level_icons = {
        "CRITICAL": "🚨",
        "WARNING": "⚠️",
        "INFO": "ℹ️",
    }
    icon = level_icons.get(level, "📋")

    return {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": f"{icon} ECO-Audit 异常告警 [{level}]"},
                "template": template,
            },
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**告警级别**: {level}"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**告警时间**: {now}"}},
                {"tag": "hr"},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**详细信息**:\n```{message}```"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": "请相关人员立即排查。"}},
            ],
        },
    }


def build_heartbeat_timeout_msg(duration: int) -> dict:
    """构建心跳超时告警消息"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    duration_min = duration / 60

    return {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": "💓 门神心跳超时告警"},
                "template": "red",
            },
            "elements": [
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**超时时长**: {duration_min:.1f} 分钟"}},
                {"tag": "div", "text": {"tag": "lark_md", "content": f"**告警时间**: {now}"}},
                {"tag": "hr"},
                {"tag": "div", "text": {"tag": "lark_md", "content": "门神守护进程可能已异常退出，请立即检查目标工控机状态。"}},
            ],
        },
    }


# =========================== 主流程 ===========================
def main():
    parser = argparse.ArgumentParser(description="ECO-Audit V3.0 飞书通知模块")
    parser.add_argument(
        "--action",
        required=True,
        choices=["audit_complete", "alert", "heartbeat_timeout"],
        help="通知类型",
    )
    parser.add_argument("--mode", default="standard", help="审计模式")
    parser.add_argument("--report", default="", help="报告文件路径")
    parser.add_argument("--level", default="WARNING", help="告警级别")
    parser.add_argument("--message", default="", help="告警内容")
    parser.add_argument("--duration", type=int, default=0, help="超时时长(秒)")

    args = parser.parse_args()

    if args.action == "audit_complete":
        payload = build_audit_complete_msg(args.mode, args.report)
    elif args.action == "alert":
        payload = build_alert_msg(args.level, args.message)
    elif args.action == "heartbeat_timeout":
        payload = build_heartbeat_timeout_msg(args.duration)
    else:
        print(f"{LOG_PREFIX} ✖ 未知操作: {args.action}", file=sys.stderr)
        sys.exit(1)

    success = send_to_feishu(payload)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
