"""
EcoNatsClient — NATS 消息总线客户端封装

支持：
- JetStream 持久化消息队列（审批流事件溯源、审计日志）
- Core NATS Pub/Sub（Agent 状态广播、实时数据推送）
- Key-Value Store（分布式配置共享、跨市州同步）
- 请求-响应模式（Agent RPC 调用）
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Optional

logger = logging.getLogger(__name__)


@dataclass
class NatsConfig:
    """NATS 客户端配置"""
    servers: list[str] = field(default_factory=lambda: ["nats://localhost:4222"])
    client_name: str = "ecomind-os"
    user: Optional[str] = None
    password: Optional[str] = None
    token: Optional[str] = None
    max_reconnect_attempts: int = 10
    reconnect_time_wait: float = 2.0
    connect_timeout: float = 10.0


@dataclass
class StreamConfig:
    """JetStream 流配置"""
    name: str
    subjects: list[str]
    max_age_hours: int = 72
    max_bytes: int = 1024 * 1024 * 1024  # 1GB
    replicas: int = 1


@dataclass
class Message:
    """NATS 消息封装"""
    subject: str
    data: Any
    reply_to: Optional[str] = None
    headers: dict[str, str] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    msg_id: Optional[str] = None


class EcoNatsClient:
    """
    EcoMind OS NATS 消息总线客户端。

    核心功能：
    - Agent P2P 通信：Publish / Subscribe / Request-Reply
    - 跨市州同步：JetStream 持久化 + Key-Value Store
    - 事件溯源：审批流审计日志持久化
    - 服务发现：基于 Subject 的 Agent 注册

    示例:
        client = EcoNatsClient(NatsConfig(servers=["nats://localhost:4222"]))
        await client.connect()

        # 发布环境数据更新
        await client.publish("env.city.changsha.aqi", {"aqi": 85, "level": "良"})

        # 订阅 Agent 命令
        async def handle_command(msg: Message):
            print(f"收到命令: {msg.data}")

        await client.subscribe("agent.command.enforcement", handle_command)

        # 请求-响应模式
        result = await client.request("agent.query.regulations", {"keyword": "大气污染防治法"})
    """

    # ─── 预定义主题空间 ───
    SUBJECTS = {
        # Agent 通信
        "agent.command": "agent.command.{domain}",       # Agent 命令下发
        "agent.status": "agent.status.{agent_id}",       # Agent 状态上报
        "agent.event": "agent.event.{event_type}",       # Agent 事件广播

        # 环境数据
        "env.city": "env.city.{city_code}",              # 城市环境数据
        "env.alert": "env.alert.{level}",                # 环境告警

        # 审批流
        "approval.event": "approval.event.{workflow_id}", # 审批流事件
        "approval.status": "approval.status.{doc_id}",    # 审批状态变更

        # 执法办案
        "enforcement.case": "enforcement.case.{case_id}", # 案件事件
        "enforcement.transition": "enforcement.transition.{stage}", # 案件阶段流转

        # 跨市州同步
        "sync.city": "sync.city.{city_code}",            # 市州数据同步
        "sync.config": "sync.config.{namespace}",        # 配置同步

        # 系统
        "system.heartbeat": "system.heartbeat.{service}", # 心跳
        "system.audit": "system.audit.{category}",       # 审计日志
    }

    # ─── JetStream 流定义 ───
    STREAMS: list[StreamConfig] = [
        StreamConfig(
            name="APPROVAL_EVENTS",
            subjects=["approval.event.>"],
            max_age_hours=24 * 365,  # 保存 1 年
        ),
        StreamConfig(
            name="ENFORCEMENT_EVENTS",
            subjects=["enforcement.case.>", "enforcement.transition.>"],
            max_age_hours=24 * 365,
        ),
        StreamConfig(
            name="AUDIT_LOGS",
            subjects=["system.audit.>"],
            max_age_hours=24 * 90,  # 保存 90 天
        ),
        StreamConfig(
            name="ENV_DATA_SYNC",
            subjects=["env.city.>", "env.alert.>"],
            max_age_hours=72,
        ),
    ]

    def __init__(self, config: Optional[NatsConfig] = None) -> None:
        self.config = config or NatsConfig()
        self._nc: Any = None       # NATS 连接
        self._js: Any = None       # JetStream 上下文
        self._kv: dict[str, Any] = {}  # KV Store 缓存
        self._subscriptions: list[Any] = []
        self._connected: bool = False
        self._stats = {
            "published": 0,
            "received": 0,
            "errors": 0,
            "connected_at": 0.0,
        }

    # ─── 连接管理 ───────────────────────────────────────

    async def connect(self) -> bool:
        """
        连接 NATS 服务器。

        实际部署时需安装 nats-py:
            pip install nats-py

        当前版本提供完整接口定义和模拟实现，
        开发环境可使用 mock 模式运行。
        """
        try:
            import nats
        except ImportError:
            logger.warning(
                "nats-py 未安装，NATS 客户端将以 mock 模式运行。"
                "安装命令: pip install nats-py"
            )
            self._connected = True
            self._stats["connected_at"] = time.time()
            logger.info(
                f"EcoNatsClient (mock) 已连接 → servers={self.config.servers}"
            )
            return True

        try:
            options: dict = {
                "servers": self.config.servers,
                "name": self.config.client_name,
                "max_reconnect_attempts": self.config.max_reconnect_attempts,
                "reconnect_time_wait": self.config.reconnect_time_wait,
                "connect_timeout": self.config.connect_timeout,
            }

            if self.config.token:
                options["token"] = self.config.token
            elif self.config.user and self.config.password:
                options["user"] = self.config.user
                options["password"] = self.config.password

            self._nc = await nats.connect(**options)
            self._js = self._nc.jetstream()
            self._connected = True
            self._stats["connected_at"] = time.time()

            # 初始化 JetStream 流
            await self._setup_streams()

            logger.info(
                f"EcoNatsClient 已连接 → {self.config.servers}, "
                f"client_name={self.config.client_name}"
            )
            return True

        except Exception as e:
            logger.error(f"NATS 连接失败: {e}")
            self._stats["errors"] += 1
            return False

    async def disconnect(self) -> None:
        """断开 NATS 连接，清理资源。"""
        if self._nc and self._connected:
            try:
                # 取消所有订阅
                for sub in self._subscriptions:
                    await sub.unsubscribe()
                self._subscriptions.clear()

                await self._nc.drain()
                await self._nc.close()
            except Exception as e:
                logger.error(f"NATS 断开异常: {e}")

        self._connected = False
        self._kv.clear()
        logger.info("EcoNatsClient 已断开")

    async def _setup_streams(self) -> None:
        """初始化 JetStream 流。"""
        if not self._js:
            return

        for stream_config in self.STREAMS:
            try:
                await self._js.add_stream(
                    name=stream_config.name,
                    subjects=stream_config.subjects,
                    max_age=int(stream_config.max_age_hours * 3600 * 1e9),  # ns
                    max_bytes=stream_config.max_bytes,
                    replicas=stream_config.replicas,
                )
                logger.info(f"JetStream 流已创建: {stream_config.name}")
            except Exception:
                # 流可能已存在，忽略
                pass

    # ─── 发布/订阅 ───────────────────────────────────────

    async def publish(
        self,
        subject: str,
        data: Any,
        headers: Optional[dict] = None,
        reply_to: Optional[str] = None,
    ) -> bool:
        """
        发布消息到指定主题。

        Args:
            subject: 主题名称（如 "env.city.changsha.aqi"）
            data: 消息数据（dict 自动序列化为 JSON）
            headers: 可选消息头
            reply_to: 可选回复主题（用于请求-响应模式）

        Returns:
            是否成功发布
        """
        payload = json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else str(data)
        encoded = payload.encode("utf-8")

        if self._nc is None:
            # Mock 模式：仅记录日志
            logger.debug(f"[MOCK PUB] {subject} → {len(encoded)} bytes")
            self._stats["published"] += 1
            return True

        try:
            await self._nc.publish(
                subject=subject,
                payload=encoded,
                reply=reply_to or "",
                headers=headers,
            )
            self._stats["published"] += 1
            return True
        except Exception as e:
            logger.error(f"发布失败 [{subject}]: {e}")
            self._stats["errors"] += 1
            return False

    async def subscribe(
        self,
        subject: str,
        handler: Callable[[Message], Any],
        queue_group: Optional[str] = None,
    ) -> Any:
        """
        订阅主题。

        Args:
            subject: 主题名称（支持通配符 * 和 >）
            handler: 消息处理回调函数
            queue_group: 可选队列组名（负载均衡）

        Returns:
            订阅句柄，可用于取消订阅
        """
        async def _wrapper(msg: Any) -> None:
            try:
                data = json.loads(msg.data.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                data = msg.data.decode("utf-8", errors="replace")

            wrapped = Message(
                subject=msg.subject,
                data=data,
                reply_to=getattr(msg, "reply", ""),
                headers=dict(getattr(msg, "header", {}) or {}),
            )
            self._stats["received"] += 1
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(wrapped)
                else:
                    handler(wrapped)
            except Exception as e:
                logger.error(f"消息处理异常 [{subject}]: {e}")
                self._stats["errors"] += 1

        if self._nc is None:
            # Mock 模式
            logger.info(f"[MOCK SUB] 已订阅: {subject}")
            mock_sub = type("MockSub", (), {"unsubscribe": lambda: None})()
            self._subscriptions.append(mock_sub)
            return mock_sub

        try:
            if queue_group:
                sub = await self._nc.subscribe(
                    subject, cb=_wrapper, queue=queue_group
                )
            else:
                sub = await self._nc.subscribe(subject, cb=_wrapper)
            self._subscriptions.append(sub)
            logger.info(f"已订阅: {subject}" + (f" (queue={queue_group})" if queue_group else ""))
            return sub
        except Exception as e:
            logger.error(f"订阅失败 [{subject}]: {e}")
            self._stats["errors"] += 1
            raise

    async def request(
        self,
        subject: str,
        data: Any,
        timeout: float = 10.0,
    ) -> Optional[Message]:
        """
        请求-响应模式：发送请求并等待回复。

        Args:
            subject: 请求主题
            data: 请求数据
            timeout: 超时时间（秒）

        Returns:
            响应消息，超时返回 None
        """
        payload = json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else str(data)

        if self._nc is None:
            logger.debug(f"[MOCK REQ] {subject} → (no response)")
            return None

        try:
            response = await self._nc.request(
                subject=subject,
                payload=payload.encode("utf-8"),
                timeout=timeout,
            )
            try:
                resp_data = json.loads(response.data.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                resp_data = response.data.decode("utf-8", errors="replace")

            return Message(
                subject=response.subject,
                data=resp_data,
                headers=dict(getattr(response, "header", {}) or {}),
            )
        except asyncio.TimeoutError:
            logger.warning(f"请求超时 [{subject}] (timeout={timeout}s)")
            self._stats["errors"] += 1
            return None
        except Exception as e:
            logger.error(f"请求失败 [{subject}]: {e}")
            self._stats["errors"] += 1
            return None

    # ─── JetStream 持久化 ───────────────────────────────────────

    async def jetstream_publish(
        self,
        subject: str,
        data: Any,
        stream_name: Optional[str] = None,
    ) -> bool:
        """通过 JetStream 发布持久化消息。"""
        payload = json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else str(data)

        if self._js is None:
            logger.debug(f"[MOCK JS PUB] {subject} ({stream_name or 'auto'})")
            self._stats["published"] += 1
            return True

        try:
            ack = await self._js.publish(subject, payload.encode("utf-8"))
            logger.debug(f"JetStream 已确认: stream={ack.stream}, seq={ack.seq}")
            self._stats["published"] += 1
            return True
        except Exception as e:
            logger.error(f"JetStream 发布失败 [{subject}]: {e}")
            self._stats["errors"] += 1
            return False

    async def jetstream_subscribe(
        self,
        subject: str,
        stream_name: str,
        durable_name: Optional[str] = None,
        handler: Optional[Callable[[Message], Any]] = None,
    ) -> Any:
        """通过 JetStream 订阅持久化消息。"""
        if self._js is None:
            logger.info(f"[MOCK JS SUB] {subject} → stream={stream_name}")
            return None

        async def _wrapper(msg: Any) -> None:
            try:
                data = json.loads(msg.data.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                data = msg.data.decode("utf-8", errors="replace")

            wrapped = Message(
                subject=msg.subject,
                data=data,
                headers=dict(getattr(msg, "header", {}) or {}),
            )
            self._stats["received"] += 1
            await msg.ack()

            if handler:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(wrapped)
                    else:
                        handler(wrapped)
                except Exception as e:
                    logger.error(f"JS 消息处理异常 [{subject}]: {e}")

        try:
            sub = await self._js.subscribe(
                subject=subject,
                stream=stream_name,
                durable=durable_name or f"{stream_name}_durable",
                cb=_wrapper,
            )
            self._subscriptions.append(sub)
            logger.info(f"JetStream 已订阅: {subject} (stream={stream_name})")
            return sub
        except Exception as e:
            logger.error(f"JetStream 订阅失败 [{subject}]: {e}")
            return None

    # ─── Key-Value Store ───────────────────────────────────────

    async def kv_put(self, bucket: str, key: str, value: Any) -> bool:
        """写入 KV Store。"""
        encoded = json.dumps(value, ensure_ascii=False).encode("utf-8")

        if self._nc is None:
            cache_key = f"{bucket}/{key}"
            self._kv[cache_key] = value
            logger.debug(f"[MOCK KV PUT] {cache_key}")
            return True

        try:
            kv = await self._nc.jetstream().key_value(bucket)
            await kv.put(key, encoded)
            return True
        except Exception as e:
            logger.error(f"KV PUT 失败 [{bucket}/{key}]: {e}")
            return False

    async def kv_get(self, bucket: str, key: str) -> Optional[Any]:
        """读取 KV Store。"""
        cache_key = f"{bucket}/{key}"

        if self._nc is None:
            val = self._kv.get(cache_key)
            return val

        try:
            kv = await self._nc.jetstream().key_value(bucket)
            entry = await kv.get(key)
            if entry:
                return json.loads(entry.value.decode("utf-8"))
        except Exception as e:
            logger.error(f"KV GET 失败 [{bucket}/{key}]: {e}")

        return None

    # ─── 跨市州同步 ───────────────────────────────────────

    async def sync_to_city(
        self,
        city_code: str,
        data_type: str,
        payload: dict,
    ) -> bool:
        """
        向指定市州推送同步数据。

        Args:
            city_code: 市州编码（如 "changsha", "zhuzhou"）
            data_type: 数据类型（如 "aqi", "regulation", "config"）
            payload: 同步数据
        """
        subject = f"sync.city.{city_code}.{data_type}"
        return await self.publish(subject, payload)

    async def broadcast_to_all_cities(
        self,
        data_type: str,
        payload: dict,
    ) -> bool:
        """向所有市州广播同步数据。"""
        subject = f"sync.city.*.{data_type}"
        return await self.publish("sync.city.all", {
            "type": data_type,
            "payload": payload,
            "timestamp": time.time(),
        })

    async def sync_config(
        self,
        namespace: str,
        key: str,
        value: Any,
    ) -> bool:
        """同步分布式配置。"""
        return await self.kv_put(f"config.{namespace}", key, value)

    # ─── 统计与健康检查 ───────────────────────────────────────

    def get_stats(self) -> dict:
        """获取客户端统计信息。"""
        return {
            "connected": self._connected,
            "server": self.config.servers[0] if self.config.servers else "none",
            "client_name": self.config.client_name,
            "subscriptions": len(self._subscriptions),
            "kv_entries": len(self._kv),
            **self._stats,
        }

    @property
    def is_connected(self) -> bool:
        """是否已连接。"""
        return self._connected


# ─── 全局单例 ───────────────────────────────────────

_default_client: Optional[EcoNatsClient] = None


async def get_nats_client(
    config: Optional[NatsConfig] = None,
) -> EcoNatsClient:
    """获取或创建全局 NATS 客户端单例。"""
    global _default_client

    if _default_client is None or not _default_client.is_connected:
        _default_client = EcoNatsClient(config)
        await _default_client.connect()

    return _default_client
