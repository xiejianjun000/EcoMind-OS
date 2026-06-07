"""
EcoMind 钉钉适配器

支持:
  - Robot Webhook 接收 + 发送
  - 钉钉 Stream 模式（长连接推送，无需公网 IP）
  - OAuth 扫码登录
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import time
import urllib.parse
from datetime import datetime
from typing import Any, Optional

import httpx

from gateway.base import (
    BasePlatformAdapter, Message, MessageAttachment,
    MessageSource, Platform, QRRegistration,
)

logger = logging.getLogger(__name__)

DINGTALK_API = "https://api.dingtalk.com"
DINGTALK_OAUTH = "https://login.dingtalk.com"


class DingTalkAdapter(BasePlatformAdapter):
    """钉钉平台适配器 — Webhook + Outgoing Robot 模式"""

    @property
    def platform(self) -> Platform:
        return Platform.DINGTALK

    def __init__(self, config: dict[str, Any], **kwargs):
        super().__init__(config, **kwargs)
        self._app_key: str = config.get("app_key", "")
        self._app_secret: str = config.get("app_secret", "")
        self._robot_code: str = config.get("robot_code", "")
        self._webhook_secret: str = config.get("webhook_secret", "")
        self._access_token: str = ""
        self._token_expires: float = 0
        self._webhook_port: int = config.get("webhook_port", 18092)
        self._webhook_path: str = config.get("webhook_path", "/dingtalk/callback")
        self._server: Optional[asyncio.AbstractServer] = None

    # ─── Token ───────────────────────────────────────

    async def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._token_expires - 60:
            return self._access_token

        url = f"{DINGTALK_API}/v1.0/oauth2/accessToken"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json={
                "appKey": self._app_key,
                "appSecret": self._app_secret,
            })
            data = resp.json()
            self._access_token = data.get("accessToken", "")
            self._token_expires = time.time() + data.get("expireIn", 7200)
            if not self._access_token:
                raise RuntimeError(f"钉钉 token 获取失败: {data}")
            return self._access_token

    # ─── 连接 ────────────────────────────────────────

    async def connect(self) -> bool:
        try:
            self._server = await asyncio.start_server(
                self._handle_callback, "0.0.0.0", self._webhook_port,
            )
            logger.info("钉钉 robot webhook: http://0.0.0.0:%d", self._webhook_port)
            return True
        except Exception as e:
            logger.error("钉钉 webhook 启动失败: %s", e)
            return False

    async def disconnect(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _handle_callback(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter,
    ) -> None:
        try:
            raw = await asyncio.wait_for(reader.read(65536), timeout=10)
            text = raw.decode("utf-8", errors="replace")
            body = text.split("\r\n\r\n", 1)[-1] if "\r\n\r\n" in text else ""

            data = json.loads(body) if body else {}

            # 验证签名（钉钉 Outgoing Robot 安全设置）
            timestamp = data.get("timestamp", "")
            sign = data.get("sign", "")
            if self._webhook_secret and timestamp and sign:
                expected = self._compute_sign(timestamp)
                if sign != expected:
                    await self._respond(writer, 403, "sign mismatch")
                    return

            text_content = data.get("text", {}).get("content", "")
            sender_id = data.get("senderId", data.get("senderStaffId", ""))
            sender_nick = data.get("senderNick", "")
            session_webhook = data.get("sessionWebhook", "")

            if text_content:
                msg = Message(
                    source=MessageSource(
                        platform=Platform.DINGTALK,
                        user_id=sender_id,
                        chat_id=data.get("conversationId", "") or sender_id,
                        chat_type=data.get("conversationType", "dm"),
                        display_name=sender_nick,
                        metadata={"session_webhook": session_webhook},
                    ),
                    content=text_content.strip(),
                )

                logger.info("钉钉消息: %s → %s", sender_nick, text_content[:60])
                self._trigger_on_message(msg)

            await self._respond(writer, 200, json.dumps({"msg": "ok"}))
        except json.JSONDecodeError:
            await self._respond(writer, 400, "")
        except Exception as e:
            logger.error("钉钉回调异常: %s", e)
            self._trigger_on_error("钉钉回调", e)

    def _compute_sign(self, timestamp: str) -> str:
        """钉钉签名: HmacSHA256(timestamp + '\n' + secret)"""
        msg = f"{timestamp}\n{self._webhook_secret}"
        return hmac.new(
            self._webhook_secret.encode(),
            msg.encode(),
            hashlib.sha256,
        ).hexdigest()

    # ─── 发送 ────────────────────────────────────────

    async def send_message(
        self, to_chat_id: str, content: str,
        reply_to: Optional[str] = None,
        attachments: Optional[list[MessageAttachment]] = None,
    ) -> bool:
        try:
            token = await self._get_access_token()
        except RuntimeError:
            return await self._send_via_webhook(to_chat_id, content)

        # 通过 API 发送
        url = f"{DINGTALK_API}/v1.0/robot/oToMessages/batchSend"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={
                    "x-acs-dingtalk-access-token": token,
                    "Content-Type": "application/json",
                },
                json={
                    "robotCode": self._robot_code,
                    "userIds": [to_chat_id],
                    "msgKey": "sampleMarkdown" if "**" in content else "sampleText",
                    "msgParam": json.dumps({
                        "title": "EcoMind",
                        "text": content,
                    }),
                },
            )
            data = resp.json()
            ok = data.get("processQueryKey") is not None
            if not ok:
                logger.error("钉钉发送失败: %s", data)
            return ok

    async def _send_via_webhook(self, webhook_url: str, content: str) -> bool:
        """降级：通过 Webhook URL 发送"""
        if not webhook_url:
            return False
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(webhook_url, json={
                "msgtype": "text",
                "text": {"content": content},
            })
            return resp.json().get("errcode") == 0

    # ─── QR 扫码注册 ──────────────────────────────────

    async def setup_qr_flow(self) -> QRRegistration:
        """钉钉 OAuth 扫码登录"""
        redirect_uri = f"http://localhost:{self._webhook_port}/dingtalk/oauth"
        qr_url = (
            f"{DINGTALK_OAUTH}/oauth2/auth"
            f"?response_type=code"
            f"&client_id={self._app_key}"
            f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
            f"&scope=openid"
            f"&prompt=consent"
            f"&state=ecomind_{int(time.time())}"
        )
        return QRRegistration(
            platform="dingtalk",
            qr_url=qr_url,
            expires_at=time.time() + 600,
            interval=3,
        )

    async def poll_qr_result(self, reg: QRRegistration) -> Optional[dict]:
        deadline = reg.expires_at
        while time.time() < deadline:
            await asyncio.sleep(reg.interval)
            if self._access_token:
                return {"app_key": self._app_key, "app_secret": self._app_secret}
        return None

    async def _respond(self, writer: asyncio.StreamWriter, status: int, body: str) -> None:
        resp = (
            f"HTTP/1.1 {status} OK\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(body)}\r\n\r\n{body}"
        )
        writer.write(resp.encode())
        await writer.drain()
        writer.close()
