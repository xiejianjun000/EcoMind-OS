"""
EcoMind 消息网关运行器 — 对标 Hermes gateway/run.py

统一管理飞书/微信/企业微信/钉钉四大适配器的生命周期。
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import httpx

from gateway.base import GatewayConfig, Message, Platform
from gateway.session import GatewaySessionManager

logger = logging.getLogger(__name__)

ADAPTER_MAP = {
    "feishu": "gateway.platforms.feishu.FeishuAdapter",
    "wecom": "gateway.platforms.wecom.WeComAdapter",
    "dingtalk": "gateway.platforms.dingtalk.DingTalkAdapter",
    "wechat": "gateway.platforms.wechat.WeChatAdapter",
}

CONFIG_PATH = Path(__file__).resolve().parent / "gateway_config.json"


class GatewayRunner:
    """消息网关运行器 — 单例"""

    _instance: Optional[GatewayRunner] = None

    def __init__(self, config: Optional[GatewayConfig] = None):
        self.config = config or GatewayConfig()
        self._adapters: dict[str, Any] = {}
        self._sessions = GatewaySessionManager(session_timeout=self.config.session_timeout)
        self._running = False
        self._qr_registrations: dict[str, dict] = {}

    @classmethod
    def get_instance(cls) -> GatewayRunner:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ─── 生命周期 ─────────────────────────────────────

    async def start(self, platforms: Optional[list[str]] = None) -> dict[str, bool]:
        """启动指定平台的消息网关"""
        target = platforms or self.config.platforms
        results = {}

        for name in target:
            try:
                adapter = self._load_adapter(name)
                adapter.on_message = self._route_message
                adapter.on_error = self._on_platform_error
                await adapter.start()
                self._adapters[name] = adapter
                results[name] = True
                logger.info("✅ %s 网关已启动", name)
            except Exception as e:
                logger.error("❌ %s 网关启动失败: %s", name, e)
                results[name] = False

        self._running = any(results.values())
        if self._running:
            asyncio.create_task(self._cleanup_loop())
        return results

    async def stop(self, platforms: Optional[list[str]] = None) -> None:
        """停止网关"""
        target = platforms or list(self._adapters.keys())
        for name in target:
            adapter = self._adapters.pop(name, None)
            if adapter:
                await adapter.stop()
        self._sessions.cleanup_expired()
        self._running = False

    def _load_adapter(self, platform: str):
        """动态加载平台适配器"""
        import_path = ADAPTER_MAP.get(platform)
        if not import_path:
            raise ValueError(f"不支持的平台: {platform}")

        module_path, class_name = import_path.rsplit(".", 1)
        import importlib
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)

        cfg = self._load_platform_config(platform)
        return cls(config=cfg)

    def _load_platform_config(self, platform: str) -> dict:
        """加载平台配置（gateway_config.json + 环境变量）"""
        cfg = {}
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH) as f:
                all_cfg = json.load(f)
            cfg = all_cfg.get(platform, {})

        # 环境变量覆盖
        prefix = platform.upper()
        for key in ["app_id", "app_secret", "corp_id", "secret", "token", "encoding_aes_key"]:
            env_val = os.environ.get(f"ECOMIND_{prefix}_{key.upper()}", "")
            if env_val:
                cfg[key] = env_val
        return cfg

    # ─── 消息路由 ─────────────────────────────────────

    async def _route_message(self, msg: Message) -> None:
        """统一消息路由：消息 → Agent 引擎 → 回复"""
        try:
            # 1. 获取或创建会话
            session = self._sessions.get_or_create(msg)

            # 2. 记录用户消息
            self._sessions.add_history(session.session_id, "user", msg.content)

            # 3. 调用 Agent 引擎
            reply = await self._call_agent_engine(
                msg.content,
                session.session_id,
                msg.source.platform.value,
                msg.source.user_id,
            )

            # 4. 记录回复
            if reply:
                self._sessions.add_history(session.session_id, "assistant", reply)

            # 5. 发送回复
            await self._send_reply(msg, reply)

        except Exception as e:
            logger.error("消息路由异常: %s", e)
            await self._send_reply(msg, "抱歉，处理您的请求时出现了问题。请稍后重试。")

    async def _call_agent_engine(
        self, user_message: str, session_id: str, platform: str, user_id: str,
    ) -> str:
        """调用 EcoAgentEngine 处理消息"""
        try:
            system_prompt = (
                "你是 EcoMind 生态环境智能助手，通过消息平台为生态环境执法人员提供服务。\n"
                f"用户正在通过 {platform} 与你对话，回复应适合移动端阅读。\n"
                "回答简洁专业，必要时引用法规条款编号。"
            )

            # 获取会话历史作为上下文
            history = self._sessions.get_history(session_id)
            messages = []
            for h in history[-10:]:
                messages.append({"role": h["role"], "content": h["content"]})

            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{self.config.api_base_url}/deepseek/v1/chat/completions",
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            *messages,
                            {"role": "user", "content": user_message},
                        ],
                        "temperature": 0.7,
                        "max_tokens": 2048,
                        "stream": False,
                    },
                )
                data = resp.json()
                return (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
        except Exception as e:
            logger.error("Agent 引擎调用失败: %s", e)
            return f"抱歉，生态环境智能服务暂时不可用。({str(e)[:50]})"

    async def _send_reply(self, msg: Message, content: str) -> None:
        """通过原平台发送回复"""
        if not content:
            return
        adapter = self._adapters.get(msg.source.platform.value)
        if not adapter:
            return

        # 移动端优化：长文本分段
        if len(content) > 1500:
            parts = self._split_for_mobile(content)
            for part in parts:
                await adapter.send_message(msg.source.chat_id, part)
        else:
            await adapter.send_message(msg.source.chat_id, content)

    def _split_for_mobile(self, text: str, max_len: int = 1500) -> list[str]:
        """移动端长文本分段（在段落边界切分）"""
        parts = []
        current = ""
        for para in text.split("\n"):
            if len(current) + len(para) < max_len:
                current += para + "\n"
            else:
                if current:
                    parts.append(current.rstrip())
                current = para + "\n"
        if current:
            parts.append(current.rstrip())
        return parts or [text[:max_len]]

    def _on_platform_error(self, context: str, exc: Exception) -> None:
        logger.error("网关平台错误 [%s]: %s", context, exc)

    async def _cleanup_loop(self) -> None:
        """定期清理过期会话"""
        while self._running:
            await asyncio.sleep(600)
            n = self._sessions.cleanup_expired()
            if n:
                logger.info("清理 %d 个过期会话", n)

    # ─── 状态查询 ─────────────────────────────────────

    def status(self) -> dict:
        return {
            "running": self._running,
            "platforms": {
                name: adapter._running
                for name, adapter in self._adapters.items()
            },
            "active_sessions": len(self._sessions.list_active()),
        }

    # ─── QR 扫码注册 ───────────────────────────────────

    def get_qr_registrations(self) -> dict[str, dict]:
        """获取各平台注册状态"""
        result = {}
        for name, adapter in self._adapters.items():
            try:
                reg = self._qr_registrations.get(name)
                result[name] = {
                    "qr_url": reg["qr_url"] if reg else "",
                    "status": "connected" if adapter._running else "disconnected",
                }
            except Exception:
                result[name] = {"status": "error"}
        return result

    async def start_qr_flow(self, platform: str) -> Optional[dict]:
        """为指定平台启动扫码注册流程"""
        adapter = self._adapters.get(platform)
        if not adapter:
            try:
                adapter = self._load_adapter(platform)
            except Exception:
                return None

        try:
            reg = await adapter.setup_qr_flow()
            self._qr_registrations[platform] = {
                "qr_url": reg.qr_url,
                "device_code": reg.device_code,
                "expires_at": reg.expires_at,
            }
            return {
                "platform": platform,
                "qr_url": reg.qr_url,
                "expires_in": int(reg.expires_at - time.time()),
            }
        except NotImplementedError:
            return {"platform": platform, "note": "该平台不支持自动扫码注册，请手动配置"}


# ─── 单例 getter ─────────────────────────────────────

def get_gateway_runner() -> GatewayRunner:
    return GatewayRunner.get_instance()
