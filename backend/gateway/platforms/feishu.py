"""
EcoMind 飞书适配器 — 对标 Hermes gateway/platforms/feishu.py

支持:
  - 扫码注册（自动创建飞书应用 + 获取 App ID/Secret）
  - Webhook 接收消息（飞书事件订阅）
  - 发送消息（文本/富文本/图片）
  - 会话管理（按用户 ID 去重）
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import time
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import httpx

from gateway.base import (
    BasePlatformAdapter, GatewayConfig, Message, MessageAttachment,
    MessageSource, Platform, QRRegistration,
)

logger = logging.getLogger(__name__)

# 飞书 Open API 域名
FEISHU_OPEN_BASE = "https://open.feishu.cn"
LARK_OPEN_BASE = "https://open.larksuite.com"
FEISHU_ACCOUNTS_BASE = "https://accounts.feishu.cn"
LARK_ACCOUNTS_BASE = "https://accounts.larkoffice.com"


class FeishuAdapter(BasePlatformAdapter):
    """飞书 / Lark 平台适配器"""

    @property
    def platform(self) -> Platform:
        return Platform.FEISHU

    # ─── 构造器 ──────────────────────────────────────

    def __init__(self, config: dict[str, Any], **kwargs):
        super().__init__(config, **kwargs)
        self._domain: str = config.get("domain", "feishu")
        self._app_id: str = config.get("app_id", "")
        self._app_secret: str = config.get("app_secret", "")
        self._verification_token: str = config.get("verification_token", "")
        self._encrypt_key: str = config.get("encrypt_key", "")
        self._tenant_access_token: str = ""
        self._token_expires: float = 0
        self._webhook_port: int = config.get("webhook_port", 18090)
        self._webhook_path: str = config.get("webhook_path", "/feishu/callback")
        self._webhook_server: Optional[asyncio.AbstractServer] = None
        self._httpd_task: Optional[asyncio.Task] = None

    @property
    def is_lark(self) -> bool:
        return self._domain == "lark"

    @property
    def open_base(self) -> str:
        return LARK_OPEN_BASE if self.is_lark else FEISHU_OPEN_BASE

    @property
    def accounts_base(self) -> str:
        return LARK_ACCOUNTS_BASE if self.is_lark else FEISHU_ACCOUNTS_BASE

    # ─── Token 管理 ──────────────────────────────────

    async def _get_tenant_token(self) -> str:
        """获取 tenant_access_token（缓存复用）"""
        if self._tenant_access_token and time.time() < self._token_expires - 60:
            return self._tenant_access_token

        if not self._app_id or not self._app_secret:
            raise RuntimeError("飞书 App ID / App Secret 未配置")

        url = f"{self.open_base}/open-apis/auth/v3/tenant_access_token/internal"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json={
                "app_id": self._app_id,
                "app_secret": self._app_secret,
            })
            data = resp.json()
            code = data.get("code", -1)
            if code != 0:
                raise RuntimeError(f"获取飞书 token 失败: {data.get('msg', 'unknown')}")
            self._tenant_access_token = data["tenant_access_token"]
            self._token_expires = time.time() + data.get("expire", 3600)
            return self._tenant_access_token

    # ─── 连接与断开 ──────────────────────────────────

    async def connect(self) -> bool:
        """启动飞书 webhook 服务器"""
        try:
            self._webhook_server = await asyncio.start_server(
                self._handle_feishu_callback,
                "0.0.0.0",
                self._webhook_port,
            )
            logger.info(
                "飞书 webhook 已启动: http://0.0.0.0:%d%s",
                self._webhook_port, self._webhook_path,
            )
            return True
        except Exception as e:
            logger.error("飞书 webhook 启动失败: %s", e)
            return False

    async def disconnect(self) -> None:
        """停止 webhook 服务器"""
        if self._webhook_server:
            self._webhook_server.close()
            await self._webhook_server.wait_closed()
            logger.info("飞书 webhook 已停止")

    async def _handle_feishu_callback(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter,
    ) -> None:
        """处理飞书事件回调（HTTP Server 原生实现）"""
        try:
            raw = await asyncio.wait_for(reader.read(65536), timeout=10)
            request_text = raw.decode("utf-8", errors="replace")

            # 解析 HTTP 请求
            lines = request_text.split("\r\n")
            if not lines:
                return
            body_start = request_text.find("\r\n\r\n")
            body = ""
            if body_start >= 0:
                body = request_text[body_start + 4:]

            # 1. URL 验证（飞书开放平台配置回调时的 challenge）
            data = json.loads(body) if body else {}
            challenge = data.get("challenge")
            if challenge:
                await self._respond(writer, 200, json.dumps({"challenge": challenge}))
                return

            # 2. 事件处理
            event_type = data.get("header", {}).get("event_type", "")
            event = data.get("event", {})

            if event_type == "im.message.receive_v1":
                await self._on_message_event(event)

            await self._respond(writer, 200, '{"code":0}')

        except json.JSONDecodeError:
            await self._respond(writer, 400, '{"code":-1,"msg":"invalid json"}')
        except Exception as e:
            logger.error("飞书回调处理异常: %s", e)
            self._trigger_on_error("飞书回调", e)
            await self._respond(writer, 500, '{"code":-1}')

    async def _on_message_event(self, event: dict) -> None:
        """处理飞书消息事件"""
        # 1. 拿原始信息
        message = event.get("message", event)
        msg_id = message.get("message_id", "")
        msg_type = message.get("msg_type", "text")
        content_str = message.get("content", "{}")
        chat_id = message.get("chat_id", "")
        chat_type = message.get("chat_type", "dm")

        # 2. 解析 sender
        sender = event.get("sender", {})
        sender_id = sender.get("sender_id", {})
        user_id = ""
        if isinstance(sender_id, dict):
            user_id = sender_id.get("open_id") or sender_id.get("user_id") or ""
        elif isinstance(sender_id, str):
            user_id = sender_id

        # 3. 去重（同一条消息不处理两次）
        if self._is_duplicate_msg(msg_id):
            return

        # 4. 解析消息内容
        text = self._parse_message_content(msg_type, content_str)

        if not text and msg_type != "image":
            return

        # 5. 构造统一消息
        msg = Message(
            source=MessageSource(
                platform=Platform.FEISHU,
                user_id=user_id,
                chat_id=chat_id,
                chat_type=chat_type,
                message_id=msg_id,
                display_name=sender.get("sender_id", {}).get("name", "") if isinstance(sender.get("sender_id"), dict) else "",
            ),
            content=text,
            attachments=self._parse_attachments(msg_type, content_str),
        )

        logger.info("飞书消息: %s → %s", user_id[:12], text[:60])
        self._trigger_on_message(msg)

    def _parse_message_content(self, msg_type: str, content_str: str) -> str:
        """解析飞书消息体为纯文本"""
        try:
            content = json.loads(content_str) if content_str else {}
        except json.JSONDecodeError:
            return content_str

        if msg_type == "text":
            return content.get("text", "") or content.get("content", "")
        elif msg_type == "post":
            # 富文本 — 提取文字段落
            parts = []
            post = content.get("content", {}) if "content" in content else content
            if isinstance(post, list):
                for block in post:
                    for para in block if isinstance(block, list) else [block]:
                        if isinstance(para, list):
                            for elem in para:
                                if isinstance(elem, dict) and "text" in elem:
                                    parts.append(elem["text"])
            return "\n".join(parts) if parts else "[富文本消息]"
        elif msg_type == "image":
            return "[图片]"
        elif msg_type == "file":
            return f"[文件: {content.get('file_name', 'unknown')}]"
        elif msg_type == "audio":
            return "[语音]"
        elif msg_type == "sticker":
            return "[表情]"
        return ""

    def _parse_attachments(self, msg_type: str, content_str: str) -> list[MessageAttachment]:
        """提取附件"""
        if msg_type == "image":
            try:
                c = json.loads(content_str)
                return [MessageAttachment(
                    file_name="image.png",
                    file_type="image",
                    file_url=c.get("image_key", ""),
                )]
            except (json.JSONDecodeError, TypeError):
                pass
        return []

    _seen_msg_ids: set[str] = set()

    def _is_duplicate_msg(self, msg_id: str) -> bool:
        if msg_id in self._seen_msg_ids:
            return True
        self._seen_msg_ids.add(msg_id)
        if len(self._seen_msg_ids) > 10000:
            self._seen_msg_ids.clear()
        return False

    # ─── 发送消息 ─────────────────────────────────────

    async def send_message(
        self, to_chat_id: str, content: str,
        reply_to: Optional[str] = None,
        attachments: Optional[list[MessageAttachment]] = None,
    ) -> bool:
        """发送消息到飞书会话"""
        try:
            token = await self._get_tenant_token()
        except RuntimeError as e:
            logger.error("飞书发送失败(无token): %s", e)
            return False

        # 构造消息体
        msg_content = json.dumps({"text": content})
        msg_type = "text"

        body = {
            "receive_id": to_chat_id,
            "msg_type": msg_type,
            "content": msg_content,
        }
        if reply_to:
            body["root_id"] = reply_to

        url = f"{self.open_base}/open-apis/im/v1/messages"
        params = {"receive_id_type": "chat_id"}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url, params=params, json=body,
                headers={"Authorization": f"Bearer {token}"},
            )
            data = resp.json()
            ok = data.get("code") == 0
            if not ok:
                logger.error("飞书发送失败: %s", data.get("msg", ""))
            return ok

    # ─── QR 扫码注册 ──────────────────────────────────

    async def setup_qr_flow(self) -> QRRegistration:
        """启动飞书扫码注册（设备码流）"""
        init_url = f"{self.accounts_base}/console/app/v1/registration"
        try:
            # Step 1: 初始化
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(init_url, json={"action": "init"})
                data = resp.json()
                methods = data.get("supported_auth_methods", [])
                if "client_secret" not in methods:
                    raise RuntimeError(f"飞书注册不支持 client_secret: {methods}")

                # Step 2: 开始注册
                resp2 = await client.post(init_url, json={
                    "action": "begin",
                    "archetype": "PersonalAgent",
                    "auth_method": "client_secret",
                    "request_user_info": "open_id",
                })
                data2 = resp2.json()
                device_code = data2.get("device_code", "")
                if not device_code:
                    raise RuntimeError("飞书注册未返回 device_code")

                return QRRegistration(
                    platform="feishu",
                    qr_url=data2.get("verification_uri_complete", ""),
                    device_code=device_code,
                    user_code=data2.get("user_code", ""),
                    expires_at=time.time() + data2.get("expire_in", 600),
                    interval=data2.get("interval", 5),
                )
        except Exception as e:
            logger.error("飞书扫码注册初始化失败: %s", e)
            raise

    async def poll_qr_result(self, reg: QRRegistration) -> Optional[dict]:
        """轮询扫码注册结果"""
        poll_url = f"{self.accounts_base}/console/app/v1/registration"
        deadline = reg.expires_at

        async with httpx.AsyncClient(timeout=15) as client:
            while time.time() < deadline:
                await asyncio.sleep(reg.interval)
                try:
                    resp = await client.post(poll_url, json={
                        "action": "check",
                        "device_code": reg.device_code,
                        "auth_method": "client_secret",
                    })
                    data = resp.json()
                    status = data.get("status", "")

                    if status == "success":
                        app_id = data.get("app_id", "")
                        app_secret = data.get("app_secret", "")
                        if app_id and app_secret:
                            self._app_id = app_id
                            self._app_secret = app_secret
                            return {"app_id": app_id, "app_secret": app_secret}
                        return None
                    elif status in ("denied", "expired"):
                        return None
                except Exception:
                    continue
        return None

    # ─── HTTP 响应工具 ────────────────────────────────

    async def _respond(self, writer: asyncio.StreamWriter, status: int, body: str) -> None:
        resp = f"HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n{body}"
        writer.write(resp.encode())
        await writer.drain()
        writer.close()
