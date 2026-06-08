"""
EcoMind 消息网关 API — 管理四大 IM 平台连接

端点:
  GET    /api/gateway/status              — 网关状态
  POST   /api/gateway/start               — 启动指定平台
  POST   /api/gateway/stop                — 停止指定平台
  POST   /api/gateway/qr/register         — 启动扫码注册
  GET    /api/gateway/qr/status           — 查询注册状态
  GET    /api/gateway/sessions            — 活跃会话列表
  POST   /api/gateway/sessions/{id}/end   — 结束指定会话
  POST   /api/gateway/send                — 主动发送消息
  GET    /api/gateway/config              — 获取网关配置
  PUT    /api/gateway/config              — 更新网关配置
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gateway", tags=["Message Gateway"])


# ── Schema ──

class GatewayStartRequest(BaseModel):
    platforms: list[str] = Field(default=["feishu", "wechat", "wecom", "dingtalk"])


class GatewayStopRequest(BaseModel):
    platforms: Optional[list[str]] = None


class QRRegisterRequest(BaseModel):
    platform: str = Field(..., description="feishu / wecom / dingtalk / wechat")


class SendMessageRequest(BaseModel):
    platform: str = Field(..., description="目标平台")
    to_chat_id: str = Field(..., description="目标会话 ID")
    content: str = Field(..., description="消息内容")


class GatewayConfigUpdate(BaseModel):
    api_base_url: Optional[str] = None
    max_message_length: Optional[int] = None
    session_timeout: Optional[int] = None


# ── 助手 ──

def _get_runner():
    try:
        from gateway.runner import get_gateway_runner
        return get_gateway_runner()
    except ImportError:
        raise HTTPException(500, "消息网关未初始化")


# ── 端点 ──

@router.get("/status")
async def gateway_status():
    """获取网关运行状态"""
    runner = _get_runner()
    return runner.status()


@router.post("/start")
async def gateway_start(req: GatewayStartRequest, background_tasks: BackgroundTasks):
    """启动消息网关（后台运行）"""
    runner = _get_runner()
    background_tasks.add_task(runner.start, req.platforms)
    return {"message": f"正在启动: {', '.join(req.platforms)}", "platforms": req.platforms}


@router.post("/stop")
async def gateway_stop(req: GatewayStopRequest = GatewayStopRequest()):
    """停止消息网关"""
    runner = _get_runner()
    await runner.stop(req.platforms)
    return {"message": "网关已停止", "platforms": req.platforms or "all"}


# ── QR 扫码注册 ──

@router.post("/qr/register")
async def qr_register(req: QRRegisterRequest):
    """为指定平台启动扫码注册流程

    返回 QR 码 URL——用户用手机扫描即可连接。

    飞书: 设备码流（自动创建应用）
    企微: OAuth 授权扫码
    钉钉: OAuth 授权扫码
    微信: 公众号关注扫码
    """
    runner = _get_runner()

    # 先确保适配器已加载
    if req.platform not in runner._adapters:
        try:
            runner._load_adapter(req.platform)
        except Exception as e:
            raise HTTPException(400, f"平台 {req.platform} 不支持: {e}")

    result = await runner.start_qr_flow(req.platform)
    if not result:
        raise HTTPException(500, f"{req.platform} 扫码注册启动失败")

    qr_url = result.get("qr_url", "")
    comment = _get_platform_qr_tip(req.platform)

    return {
        "platform": req.platform,
        "qr_url": qr_url,
        "expires_in": result.get("expires_in", 600),
        "instruction": comment,
        "status": "pending",
    }


def _get_platform_qr_tip(platform: str) -> str:
    tips = {
        "feishu": "打开飞书手机App → 扫一扫 → 授权连接 → 自动创建应用 → 完成",
        "wecom": "打开企业微信手机App → 扫一扫 → 授权登录 → 完成",
        "dingtalk": "打开钉钉手机App → 扫一扫 → 授权登录 → 完成",
        "wechat": "打开微信 → 扫一扫 → 关注公众号 → 完成",
    }
    return tips.get(platform, "请用手机扫描二维码完成连接")


@router.get("/qr/status")
async def qr_status():
    """查询各平台扫码注册状态"""
    runner = _get_runner()
    return runner.get_qr_registrations()


# ── 会话管理 ──

@router.get("/sessions")
async def list_sessions(platform: str = ""):
    """列出活跃会话"""
    runner = _get_runner()
    sessions = runner._sessions.list_active(platform)
    return {
        "count": len(sessions),
        "sessions": [
            {
                "session_id": s.session_id,
                "platform": s.platform,
                "user_id": s.user_id[:8] + "...",
                "display_name": s.display_name,
                "message_count": s.message_count,
                "last_active": s.last_active_at,
            }
            for s in sessions
        ],
    }


@router.post("/sessions/{session_id}/end")
async def end_session(session_id: str):
    """手动结束一个会话"""
    runner = _get_runner()
    runner._sessions.end_session(session_id)
    return {"message": f"会话 {session_id} 已结束"}


# ── 主动发送 ──

@router.post("/send")
async def send_message(req: SendMessageRequest):
    """主动发送消息到指定平台"""
    runner = _get_runner()
    adapter = runner._adapters.get(req.platform)
    if not adapter:
        raise HTTPException(400, f"平台 {req.platform} 未启动")

    ok = await adapter.send_message(req.to_chat_id, req.content)
    if ok:
        return {"message": "发送成功"}
    else:
        raise HTTPException(500, "发送失败——请检查平台凭据配置")


# ── 配置 ──

@router.get("/config")
async def get_config():
    """获取网关配置"""
    from gateway.runner import CONFIG_PATH
    cfg = {}
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
    return {
        "config": cfg,
        "env_vars_set": {
            "ECOMIND_FEISHU_APP_ID": bool(os.environ.get("ECOMIND_FEISHU_APP_ID")),
            "ECOMIND_WECOM_CORP_ID": bool(os.environ.get("ECOMIND_WECOM_CORP_ID")),
            "ECOMIND_DINGTALK_APP_KEY": bool(os.environ.get("ECOMIND_DINGTALK_APP_KEY")),
            "ECOMIND_WECHAT_APP_ID": bool(os.environ.get("ECOMIND_WECHAT_APP_ID")),
        },
    }


@router.put("/config")
async def update_config(update: GatewayConfigUpdate):
    """更新网关配置"""
    runner = _get_runner()
    if update.api_base_url:
        runner.config.api_base_url = update.api_base_url
    if update.max_message_length:
        runner.config.max_message_length = update.max_message_length
    if update.session_timeout:
        runner.config.session_timeout = update.session_timeout
        runner._sessions._timeout = update.session_timeout
    return {"message": "配置已更新"}
