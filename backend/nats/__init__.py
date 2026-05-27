"""
EcoMind OS NATS Message Bus
============================

NATS 消息总线客户端 — 支持 Agent P2P 通信、跨市州数据同步、发布/订阅。

架构：
- JetStream: 持久化消息队列（审批流事件溯源）
- Core NATS: 实时 Pub/Sub（Agent 状态广播）
- Key-Value Store: 分布式配置共享

使用方式：
    from nats import EcoNatsClient
    client = EcoNatsClient("nats://localhost:4222")
    await client.connect()
    await client.publish("agent.command", {"target": "enforcement", "action": "investigate"})
"""

from nats.client import EcoNatsClient, NatsConfig

__all__ = ["EcoNatsClient", "NatsConfig"]
__version__ = "1.0.0"
