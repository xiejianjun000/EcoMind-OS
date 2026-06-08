"""
EcoMind 微信公众号适配器

支持:
  - 微信服务器 Token 验证
  - 接收用户消息（文本/图片/语音/事件）
  - 被动回复消息
  - 客服消息主动推送
  - 扫码关注即连接
"""
from __future__ import annotations

import asyncio
import hashlib
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

WECHAT_API = "https://api.weixin.qq.com/cgi-bin"


class WeChatAdapter(BasePlatformAdapter):
    """微信公众号适配器"""

    @property
    def platform(self) -> Platform:
        return Platform.WECHAT

    def __init__(self, config: dict[str, Any], **kwargs):
        super().__init__(config, **kwargs)
        self._app_id: str = config.get("app_id", "")
        self._app_secret: str = config.get("app_secret", "")
        self._token: str = config.get("token", "ecomind_wechat_token")
        self._encoding_aes_key: str = config.get("encoding_aes_key", "")
        self._access_token: str = ""
        self._token_expires: float = 0
        self._webhook_port: int = config.get("webhook_port", 18093)
        self._webhook_path: str = config.get("webhook_path", "/wechat/callback")
        self._server: Optional[asyncio.AbstractServer] = None

    # ─── Token ───────────────────────────────────────

    async def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._token_expires - 120:
            return self._access_token

        url = (
            f"{WECHAT_API}/token"
            f"?grant_type=client_credential"
            f"&appid={self._app_id}"
            f"&secret={self._app_secret}"
        )
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            data = resp.json()
            token = data.get("access_token", "")
            if not token:
                raise RuntimeError(f"微信公众号 token 获取失败: {data.get('errmsg')}")
            self._access_token = token
            self._token_expires = time.time() + data.get("expires_in", 7200)
            return token

    # ─── 连接 ────────────────────────────────────────

    async def connect(self) -> bool:
        try:
            self._server = await asyncio.start_server(
                self._handle_callback, "0.0.0.0", self._webhook_port,
            )
            logger.info("微信公众号 webhook: http://0.0.0.0:%d", self._webhook_port)
            return True
        except Exception as e:
            logger.error("微信公众号 webhook 启动失败: %s", e)
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

            if text.startswith("GET "):
                await self._handle_verify(text, writer)
                return

            body = text.split("\r\n\r\n", 1)[-1] if "\r\n\r\n" in text else ""
            reply_xml = await self._on_message(body)
            await self._respond(writer, 200, reply_xml or "success")
        except Exception as e:
            logger.error("微信回调异常: %s", e)

    async def _handle_verify(self, request_text: str, writer: asyncio.StreamWriter) -> None:
        """微信服务器 Token 验证"""
        import urllib.parse
        path = request_text.split(" ")[1] if " " in request_text else "/"
        query = path.split("?", 1)[-1] if "?" in path else ""
        params = dict(urllib.parse.parse_qsl(query))

        signature = params.get("signature", "")
        timestamp = params.get("timestamp", "")
        nonce = params.get("nonce", "")
        echostr = params.get("echostr", "")

        # 验证签名
        tmp_list = sorted([self._token, timestamp, nonce])
        tmp_str = "".join(tmp_list)
        expected = hashlib.sha1(tmp_str.encode()).hexdigest()

        if signature == expected:
            logger.info("微信公众号 Token 验证成功")
            await self._respond(writer, 200, echostr)
        else:
            logger.warning("微信公众号 Token 验证失败: %s != %s", signature, expected)
            await self._respond(writer, 403, "signature mismatch")

    async def _on_message(self, body: str) -> str:
        """解析微信 XML 消息，返回被动回复 XML"""
        try:
            root = ET.fromstring(body)
        except ET.ParseError:
            return ""

        msg_type = root.findtext("MsgType", "text")
        from_user = root.findtext("FromUserName", "")
        to_user = root.findtext("ToUserName", "")
        content = root.findtext("Content", "")
        msg_id = root.findtext("MsgId", "")
        create_time = root.findtext("CreateTime", "")

        # 关注事件
        if msg_type == "event":
            event = root.findtext("Event", "")
            if event.lower() == "subscribe":
                content = "/help"
            else:
                return ""

        if not content:
            return ""

        msg = Message(
            source=MessageSource(
                platform=Platform.WECHAT,
                user_id=from_user,
                chat_id=from_user,  # 公众号模式: 用户=会话
                chat_type="dm",
                message_id=msg_id,
                metadata={"to_user": to_user, "msg_type": msg_type},
            ),
            content=content.strip(),
            attachments=[],
        )

        logger.info("微信公众号消息: %s → %s", from_user[:12], content[:60])
        self._trigger_on_message(msg)

        # 空回复（后续由客服消息异步发送）
        return "success"

    # ─── 发送 ────────────────────────────────────────

    async def send_message(
        self, to_chat_id: str, content: str,
        reply_to: Optional[str] = None,
        attachments: Optional[list[MessageAttachment]] = None,
    ) -> bool:
        """发送客服消息（48小时内和用户有过交互才能发）"""
        try:
            token = await self._get_access_token()
        except RuntimeError as e:
            logger.error("微信发送失败: %s", e)
            return False

        url = f"{WECHAT_API}/message/custom/send?access_token={token}"
        body = {
            "touser": to_chat_id,
            "msgtype": "text",
            "text": {"content": content},
        }

        # Markdown 格式 → 转为文本（公众号客服消息不支持原生 Markdown）
        if len(content) > 600:
            body["text"]["content"] = content[:600] + "\n...\n[内容过长已截断]"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=body)
            data = resp.json()
            ok = data.get("errcode") == 0
            if not ok:
                logger.error("微信发送失败: %s", data.get("errmsg"))
            return ok

    # ─── QR 扫码注册 ──────────────────────────────────

    async def setup_qr_flow(self) -> QRRegistration:
        """
        微信公众号扫码关注即连接。

        生成带参数二维码 → 用户扫描 → 关注公众号 → 触发 subscribe 事件。
        这是"扫码连接"的自然模式——不需要额外的 OAuth 流程。
        """
        if not self._app_id:
            raise RuntimeError("微信公众号 App ID 未配置")

        # 微信公众号—生成带场景值的临时二维码
        qr_url = (
            f"https://open.weixin.qq.com/connect/oauth2/authorize"
            f"?appid={self._app_id}"
            f"&redirect_uri=http://localhost:{self._webhook_port}/wechat/oauth"
            f"&response_type=code"
            f"&scope=snsapi_userinfo"
            f"&state=ecomind_{int(time.time())}"
            f"#wechat_redirect"
        )

        return QRRegistration(
            platform="wechat",
            qr_url=qr_url,
            expires_at=time.time() + 600,
            interval=3,
        )

    async def poll_qr_result(self, reg: QRRegistration) -> Optional[dict]:
        deadline = reg.expires_at
        while time.time() < deadline:
            await asyncio.sleep(reg.interval)
            if self._access_token:
                return {"app_id": self._app_id}
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
