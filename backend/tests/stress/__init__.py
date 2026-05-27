"""
EcoMind OS — 端到端压力测试套件

覆盖范围：
- REST API（enforcement / approval / compliance / reports / safety-chain / knowledge-graph / marketplace）
- SSE 流式（Agent Chat / 模型推理）
- WebSocket（环境数据 / Agent 状态推送）
- 并发场景（多用户 / 多角色 / 混合负载）

使用方式：
    # 快速冒烟测试（10 并发 / 30 秒）
    python -m tests.stress.runner --mode smoke

    # 标准压力测试（50 并发 / 120 秒）
    python -m tests.stress.runner --mode stress

    # 极限测试（200 并发 / 300 秒）
    python -m tests.stress.runner --mode spike

    # 自定义
    python -m tests.stress.runner --concurrency 100 --duration 180 --endpoint all
"""

__version__ = "1.0.0"
