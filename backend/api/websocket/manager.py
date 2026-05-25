"""
WebSocket 连接管理器

管理 WebSocket 客户端连接、广播推送（Agent 状态变化、安全告警、审批通知）。
集成 EventBus 实现实时事件推送。
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


@dataclass
class ConnectedClient:
    """已连接的 WebSocket 客户端"""
    client_id: str
    websocket: WebSocket
    subscribed_topics: set[str] = field(default_factory=set)
    connected_at: float = field(default_factory=time.time)
    metadata: dict[str, Any] = field(default_factory=dict)


class WebSocketManager:
    """
    WebSocket 连接管理器

    职责：
    - 管理客户端连接/断开
    - 按主题（topic）订阅/取消订阅
    - 广播消息到指定主题或所有客户端
    - 集成 EventBus，将 Agent 事件自动推送到前端
    """

    def __init__(self) -> None:
        self._clients: dict[str, ConnectedClient] = {}
        self._topic_subscribers: dict[str, set[str]] = {}
        self._broadcast_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=1000)
        self._background_task: Optional[asyncio.Task] = None
        self._running: bool = False

    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None) -> str:
        """
        接受新的 WebSocket 连接。

        Args:
            websocket: FastAPI WebSocket 实例
            client_id: 可选客户端标识，自动生成若未提供

        Returns:
            分配的 client_id
        """
        await websocket.accept()
        client_id = client_id or str(uuid.uuid4())
        client = ConnectedClient(client_id=client_id, websocket=websocket)
        self._clients[client_id] = client
        logger.info(f"WebSocket 客户端连接: {client_id}, 当前连接数: {len(self._clients)}")
        return client_id

    async def disconnect(self, client_id: str) -> None:
        """断开指定客户端连接。"""
        client = self._clients.pop(client_id, None)
        if client:
            # 从所有主题中移除
            for topic in client.subscribed_topics:
                subscribers = self._topic_subscribers.get(topic)
                if subscribers:
                    subscribers.discard(client_id)
            logger.info(f"WebSocket 客户端断开: {client_id}, 剩余连接数: {len(self._clients)}")

    async def disconnect_all(self) -> None:
        """断开所有客户端连接。"""
        self._running = False
        if self._background_task and not self._background_task.done():
            self._background_task.cancel()
        client_ids = list(self._clients.keys())
        for cid in client_ids:
            await self.disconnect(cid)
        logger.info("已断开所有 WebSocket 连接")

    def subscribe(self, client_id: str, topic: str) -> None:
        """
        订阅主题。

        支持的主题：
        - agent:status — Agent 状态变化
        - security:alert — 安全告警
        - approval:notification — 审批通知
        - workflow:progress — 工作流进度
        """
        client = self._clients.get(client_id)
        if not client:
            return
        client.subscribed_topics.add(topic)
        if topic not in self._topic_subscribers:
            self._topic_subscribers[topic] = set()
        self._topic_subscribers[topic].add(client_id)
        logger.debug(f"客户端 {client_id} 订阅主题: {topic}")

    def unsubscribe(self, client_id: str, topic: str) -> None:
        """取消订阅主题。"""
        client = self._clients.get(client_id)
        if client:
            client.subscribed_topics.discard(topic)
        subscribers = self._topic_subscribers.get(topic)
        if subscribers:
            subscribers.discard(client_id)

    async def broadcast_to_topic(self, topic: str, data: dict[str, Any]) -> int:
        """
        向指定主题的所有订阅者广播消息。

        Args:
            topic: 目标主题
            data: 消息数据

        Returns:
            成功发送的客户端数量
        """
        subscribers = self._topic_subscribers.get(topic, set())
        sent_count = 0
        message = {
            "topic": topic,
            "data": data,
            "timestamp": time.time(),
        }
        for client_id in list(subscribers):
            client = self._clients.get(client_id)
            if client:
                try:
                    await client.websocket.send_json(message)
                    sent_count += 1
                except Exception as e:
                    logger.warning(f"发送 WebSocket 消息失败 (client={client_id}): {e}")
                    await self.disconnect(client_id)
        return sent_count

    async def broadcast_all(self, data: dict[str, Any]) -> int:
        """
        向所有连接的客户端广播消息。

        Returns:
            成功发送的客户端数量
        """
        message = {
            "topic": "broadcast",
            "data": data,
            "timestamp": time.time(),
        }
        sent_count = 0
        for client_id in list(self._clients.keys()):
            client = self._clients.get(client_id)
            if client:
                try:
                    await client.websocket.send_json(message)
                    sent_count += 1
                except Exception as e:
                    logger.warning(f"广播消息失败 (client={client_id}): {e}")
                    await self.disconnect(client_id)
        return sent_count

    async def send_to_client(self, client_id: str, data: dict[str, Any]) -> bool:
        """
        向指定客户端发送消息。

        Returns:
            是否发送成功
        """
        client = self._clients.get(client_id)
        if not client:
            return False
        try:
            await client.websocket.send_json({
                "topic": "direct",
                "data": data,
                "timestamp": time.time(),
            })
            return True
        except Exception as e:
            logger.warning(f"发送消息到客户端 {client_id} 失败: {e}")
            await self.disconnect(client_id)
            return False

    def enqueue_broadcast(self, topic: str, data: dict[str, Any]) -> None:
        """
        将广播消息放入队列，由后台任务异步发送。

        用于在非异步上下文（如 EventBus 回调）中触发 WebSocket 推送。
        """
        try:
            self._broadcast_queue.put_nowait({"topic": topic, "data": data})
        except asyncio.QueueFull:
            logger.warning("广播队列已满，丢弃消息")

    def start_background_broadcaster(self) -> None:
        """启动后台广播任务。"""
        if self._running:
            return
        self._running = True
        self._background_task = asyncio.create_task(self._broadcast_loop())
        logger.info("WebSocket 后台广播任务已启动")

    async def _broadcast_loop(self) -> None:
        """后台广播循环，从队列中取出消息并广播。"""
        while self._running:
            try:
                msg = await asyncio.wait_for(self._broadcast_queue.get(), timeout=1.0)
                await self.broadcast_to_topic(msg["topic"], msg["data"])
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"广播循环错误: {e}")

    def get_stats(self) -> dict[str, Any]:
        """获取 WebSocket 连接统计信息。"""
        return {
            "total_clients": len(self._clients),
            "topics": {
                topic: len(subscribers)
                for topic, subscribers in self._topic_subscribers.items()
            },
            "queue_size": self._broadcast_queue.qsize(),
        }

    @property
    def client_count(self) -> int:
        """当前连接的客户端数量。"""
        return len(self._clients)


async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket 端点处理函数。

    协议：
    - 连接后客户端可发送 JSON 消息进行订阅/取消订阅
    - 服务端推送订阅主题的实时消息

    客户端消息格式：
    - {"action": "subscribe", "topic": "agent:status"}
    - {"action": "unsubscribe", "topic": "agent:status"}
    - {"action": "ping"}
    """
    from api.main import ws_manager

    client_id = await ws_manager.connect(websocket)
    try:
        # 默认订阅所有核心主题
        ws_manager.subscribe(client_id, "agent:status")
        ws_manager.subscribe(client_id, "security:alert")
        ws_manager.subscribe(client_id, "approval:notification")
        ws_manager.subscribe(client_id, "workflow:progress")

        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await ws_manager.send_to_client(client_id, {
                    "type": "error",
                    "message": "Invalid JSON format",
                })
                continue

            action = message.get("action", "")
            if action == "subscribe":
                topic = message.get("topic", "")
                if topic:
                    ws_manager.subscribe(client_id, topic)
                    await ws_manager.send_to_client(client_id, {
                        "type": "subscribed",
                        "topic": topic,
                    })
            elif action == "unsubscribe":
                topic = message.get("topic", "")
                if topic:
                    ws_manager.unsubscribe(client_id, topic)
                    await ws_manager.send_to_client(client_id, {
                        "type": "unsubscribed",
                        "topic": topic,
                    })
            elif action == "ping":
                await ws_manager.send_to_client(client_id, {
                    "type": "pong",
                    "timestamp": time.time(),
                })

    except WebSocketDisconnect:
        await ws_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket 端点异常 (client={client_id}): {e}")
        await ws_manager.disconnect(client_id)
