"""
EcoMind 企业微信适配器

支持:
  - 扫码注册（企业微信自建应用 OAuth）
  - Webhook 回调接收消息
  - 发送文本/Markdown/图文消息
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any, Optional

import httpx

from gateway.base import (
    BasePlatformAdapter, Message, MessageAttachment,
    MessageSource, Platform, QRRegistration,
)

logger = logging.getLogger(__name__)

WECOM_API_BASE = "https://qyapi.weixin.qq.com/cgi-bin"


class WeComAdapter(BasePlatformAdapter):
    """企业微信适配器"""

    @property
    def platform(self) -> Platform:
        return Platform.WECOM

    def __init__(self, config: dict[str, Any], **kwargs):
        super().__init__(config, **kwargs)
        self._corp_id: str = config.get("corp_id", "")
        self._agent_id: str = config.get("agent_id", "")
        self._secret: str = config.get("secret", "")
        self._token: str = config.get("token", "ecomind")
        self._encoding_aes_key: str = config.get("encoding_aes_key", "")
        self._access_token: str = ""
        self._token_expires: float = 0
        self._webhook_port: int = config.get("webhook_port", 18091)
        self._webhook_path: str = config.get("webhook_path", "/wecom/callback")
        self._server: Optional[asyncio.AbstractServer] = None

    # ─── Token ───────────────────────────────────────

    async def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._token_expires - 60:
            return self._access_token

        url = f"{WECOM_API_BASE}/gettoken"
        params = {"corpid": self._corp_id, "corpsecret": self._secret}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            data = resp.json()
            if data.get("errcode") != 0:
                raise RuntimeError(f"获取企微 token 失败: {data.get('errmsg')}")
            self._access_token = data["access_token"]
            self._token_expires = time.time() + data.get("expires_in", 7200)
            return self._access_token

    # ─── 连接 ────────────────────────────────────────

    async def connect(self) -> bool:
        try:
            self._server = await asyncio.start_server(
                self._handle_callback, "0.0.0.0", self._webhook_port,
            )
            logger.info("企业微信 webhook: http://0.0.0.0:%d", self._webhook_port)
            return True
        except Exception as e:
            logger.error("企业微信 webhook 启动失败: %s", e)
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

            # URL 验证 (GET echostr)
            if text.startswith("GET "):
                if "echostr" in text:
                    await self._handle_url_verify(text, writer)
                else:
                    await self._respond(writer, 200, "ok")
                return

            # POST 消息事件
            body = text.split("\r\n\r\n", 1)[-1] if "\r\n\r\n" in text else ""
            await self._on_message(body)
            await self._respond(writer, 200, "success")
        except Exception as e:
            logger.error("企微回调异常: %s", e)
            self._trigger_on_error("企微回调", e)

    async def _handle_url_verify(self, request_text: str, writer: asyncio.StreamWriter) -> None:
        """处理企微 URL 验证"""
        import urllib.parse
        path = request_text.split(" ")[1] if " " in request_text else "/"
        query = path.split("?", 1)[-1] if "?" in path else ""
        params = dict(urllib.parse.parse_qsl(query))

        echostr = params.get("echostr", "")
        timestamp = params.get("timestamp", "")
        nonce = params.get("nonce", "")
        msg_signature = params.get("msg_signature", "")

        if not self._encoding_aes_key:
            await self._respond(writer, 200, echostr)
            return

        try:
            from gateway.crypto import wecom_decrypt_echostr
            decrypted = wecom_decrypt_echostr(
                self._token, self._encoding_aes_key,
                self._corp_id, msg_signature, timestamp, nonce, echostr,
            )
            await self._respond(writer, 200, decrypted)
        except Exception:
            await self._respond(writer, 200, echostr)

    async def _on_message(self, body: str) -> None:
        """解析企微 XML 消息体"""
        try:
            root = ET.fromstring(body)
        except ET.ParseError:
            try:
                data = json.loads(body)
                await self._on_json_message(data)
                return
            except json.JSONDecodeError:
                return

        msg_type = root.findtext("MsgType", "text")
        user_id = root.findtext("FromUserName", "")
        agent_id = root.findtext("AgentID", "0")
        content = root.findtext("Content", "") or root.findtext("Text", "")
        msg_id = root.findtext("MsgId", "")
        chat_id = root.findtext("ChatId", "") or user_id

        if not content and msg_type not in ("image", "voice", "file"):
            return

        msg = Message(
            source=MessageSource(
                platform=Platform.WECOM,
                user_id=user_id,
                chat_id=chat_id,
                chat_type="group" if "@chatroom" in (chat_id or "") else "dm",
                message_id=msg_id,
            ),
            content=content or f"[{msg_type}]",
        )

        logger.info("企微消息: %s → %s", user_id[:12], content[:60])
        self._trigger_on_message(msg)

    async def _on_json_message(self, data: dict) -> None:
        """处理企微 JSON 回调（应用消息）"""
        msg = data.get("msg", data)
        msg_type = msg.get("msgtype", "text")
        user_id = msg.get("from", {}).get("userid", "")
        chat_id = msg.get("chatid", "") or user_id
        content = ""
        if msg_type == "text":
            content = msg.get("text", {}).get("content", "")
        elif msg_type == "image":
            content = "[图片]"
        elif msg_type == "voice":
            content = "[语音]"

        if not content:
            return

        self._trigger_on_message(Message(
            source=MessageSource(
                platform=Platform.WECOM,
                user_id=user_id,
                chat_id=chat_id,
                chat_type="dm",
            ),
            content=content,
        ))

    # ─── 发送 ────────────────────────────────────────

    async def send_message(
        self, to_chat_id: str, content: str,
        reply_to: Optional[str] = None,
        attachments: Optional[list[MessageAttachment]] = None,
    ) -> bool:
        try:
            token = await self._get_access_token()
        except RuntimeError as e:
            logger.error("企微发送失败: %s", e)
            return False

        url = f"{WECOM_API_BASE}/message/send"
        params = {"access_token": token}
        body = {
            "touser": to_chat_id if "@" not in (to_chat_id or "") else "",
            "toparty": "",
            "totag": "",
            "msgtype": "text",
            "agentid": int(self._agent_id) if self._agent_id else 0,
            "text": {"content": content},
            "safe": 0,
        }

        # 群聊消息
        if "@" in (to_chat_id or "") or "chat" in (to_chat_id or "").lower():
            body.pop("touser", None)
            body["chatid"] = to_chat_id

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, params=params, json=body)
            data = resp.json()
            ok = data.get("errcode") == 0
            if not ok:
                logger.error("企微发送失败: %s", data.get("errmsg"))
            return ok

    # ─── QR 扫码注册 ──────────────────────────────────

    async def setup_qr_flow(self) -> QRRegistration:
        """企业微信扫码注册：构建 OAuth 授权 URL"""
        if not self._corp_id:
            raise RuntimeError("企微 Corp ID 未配置")

        redirect_uri = f"http://localhost:{self._webhook_port}/wecom/oauth"
        qr_url = (
            f"https://open.work.weixin.qq.com/wwopen/sso/qrConnect"
            f"?appid={self._corp_id}"
            f"&agentid={self._agent_id}"
            f"&redirect_uri={redirect_uri}"
            f"&state=ecomind_{int(time.time())}"
        )

        return QRRegistration(
            platform="wecom",
            qr_url=qr_url,
            expires_at=time.time() + 600,
            interval=3,
        )

    async def poll_qr_result(self, reg: QRRegistration) -> Optional[dict]:
        """企微扫码轮询——等待 OAuth 回调写入凭据"""
        deadline = reg.expires_at
        while time.time() < deadline:
            await asyncio.sleep(reg.interval)
            if self._secret:
                return {"corp_id": self._corp_id, "secret": self._secret, "agent_id": self._agent_id}
        return None

    async def _respond(self, writer: asyncio.StreamWriter, status: int, body: str) -> None:
        resp = (
            f"HTTP/1.1 {status} OK\r\n"
            f"Content-Type: text/plain\r\n"
            f"Content-Length: {len(body)}\r\n\r\n{body}"
        )
        writer.write(resp.encode())
        await writer.drain()
        writer.close()
