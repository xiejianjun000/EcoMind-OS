"""
EcoMind 消息网关 — 平台适配器基类

对标 Hermes gateway/platforms/base.py
每一个平台适配器都继承此基类，实现标准生命周期方法。
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


# ─── 消息与事件模型 ───────────────────────────────────

class Platform(str, Enum):
    FEISHU = "feishu"
    WECHAT = "wechat"
    WECOM = "wecom"
    DINGTALK = "dingtalk"


@dataclass
class MessageSource:
    """消息来源——来自哪个平台、哪个用户、哪个群/频道"""
    platform: Platform
    user_id: str
    chat_id: str
    chat_type: str = "dm"           # dm / group / channel
    message_id: str = ""
    display_name: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class MessageAttachment:
    file_name: str = ""
    file_type: str = ""
    file_url: str = ""
    file_size: int = 0


@dataclass
class Message:
    """统一消息体——所有平台的消息都归一化为此结构"""
    source: MessageSource
    content: str
    attachments: list[MessageAttachment] = field(default_factory=list)
    reply_to: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class GatewayConfig:
    """网关全局配置"""
    enabled: bool = True
    platforms: list[str] = field(default_factory=lambda: ["feishu", "wechat", "wecom", "dingtalk"])
    api_base_url: str = "http://localhost:8000"
    agent_engine_endpoint: str = "/deepseek/v1/chat/completions"
    max_message_length: int = 4096
    rate_limit_per_user: int = 10         # 每分钟每用户最多 10 条
    session_timeout: int = 3600            # 会话超时 1 小时
    store_path: str = "data/gateway"


# ─── QR 扫码注册 ──────────────────────────────────────

@dataclass
class QRRegistration:
    """平台的扫码注册信息"""
    platform: str
    qr_url: str
    device_code: str = ""
    user_code: str = ""
    expires_at: float = 0
    interval: int = 5
    status: str = "pending"   # pending / success / timeout / denied
    credentials: dict[str, str] = field(default_factory=dict)


# ─── 适配器基类 ───────────────────────────────────────

class BasePlatformAdapter(ABC):
    """消息平台适配器基类

    子类必须实现:
      - connect()       — 建立连接（启动 webhook / 长轮询）
      - disconnect()    — 断开连接
      - send_message()  — 发送消息到这个平台
      - platform        — 平台标识

    子类可选实现:
      - setup_qr_flow() — 启动扫码注册流程
      - poll_qr_result()— 轮询扫码结果
    """

    def __init__(
        self,
        config: dict[str, Any],
        on_message: Optional[Callable[[Message], Any]] = None,
        on_error: Optional[Callable[[str, Exception], Any]] = None,
    ) -> None:
        self.config = config
        self.on_message = on_message
        self.on_error = on_error
        self._running = False
        self._task: Optional[asyncio.Task] = None

    @property
    @abstractmethod
    def platform(self) -> Platform:
        """返回平台标识"""
        ...

    @abstractmethod
    async def connect(self) -> bool:
        """建立与平台的长连接 / 启动 webhook 服务。返回是否成功"""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """断开连接 / 停止 webhook"""
        ...

    @abstractmethod
    async def send_message(
        self, to_chat_id: str, content: str,
        reply_to: Optional[str] = None,
        attachments: Optional[list[MessageAttachment]] = None,
    ) -> bool:
        """发送消息到这个平台的指定会话。返回是否成功"""
        ...

    async def start(self) -> None:
        """启动适配器（调用 connect 并在 on_message 上挂回调）"""
        if self._running:
            return
        self._running = True
        ok = await self.connect()
        if ok:
            logger.info("%s 适配器已启动", self.platform.value)
        else:
            self._running = False
            logger.error("%s 适配器启动失败", self.platform.value)

    async def stop(self) -> None:
        """停止适配器"""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        await self.disconnect()
        logger.info("%s 适配器已停止", self.platform.value)

    def _trigger_on_message(self, message: Message) -> None:
        """触发消息回调"""
        if self.on_message:
            try:
                result = self.on_message(message)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error("消息回调异常: %s", e)

    def _trigger_on_error(self, context: str, exc: Exception) -> None:
        """触发错误回调"""
        if self.on_error:
            try:
                self.on_error(context, exc)
            except Exception:
                pass

    # ─── QR 扫码注册（子类可选重写） ───

    async def setup_qr_flow(self) -> QRRegistration:
        """启动扫码注册流程。默认抛出未实现"""
        raise NotImplementedError(f"{self.platform.value} 不支持扫码注册")

    async def poll_qr_result(self, registration: QRRegistration) -> Optional[dict]:
        """轮询扫码注册结果。返回凭据 dict 或 None"""
        raise NotImplementedError(f"{self.platform.value} 不支持扫码轮询")

    async def complete_qr_registration(self) -> Optional[dict[str, str]]:
        """完整的扫码注册流程：生成二维码 → 等待用户扫描 → 返回凭据"""
        reg = await self.setup_qr_flow()
        logger.info(
            "%s 扫码注册: 请在60秒内用手机扫描二维码\n  %s",
            self.platform.value, reg.qr_url,
        )
        result = await self.poll_qr_result(reg)
        if result:
            logger.info("%s 扫码注册成功", self.platform.value)
        else:
            logger.warning("%s 扫码注册超时", self.platform.value)
        return result

    # ─── 工具方法 ───

    @staticmethod
    def _hmac_sha256(key: str, msg: str) -> str:
        import hashlib
        import hmac
        return hmac.new(key.encode(), msg.encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def _now_ts() -> int:
        return int(datetime.now().timestamp())
