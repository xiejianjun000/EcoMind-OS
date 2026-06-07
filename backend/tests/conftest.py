"""
Pytest 全局配置 — 所有测试层的共享 fixtures
"""
import pytest
import sys
import os

# 确保 backend 在 path 中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(autouse=True)
def block_credentials():
    """禁止测试读到真实 API key，防止凭据泄漏进断言"""
    blocked = set()
    for key in list(os.environ):
        if key.endswith(('_API_KEY', '_TOKEN', '_SECRET', '_PASSWORD')):
            blocked.add(key)
            del os.environ[key]
    yield
    # 不恢复——测试不该在环境变量里留下副作用


@pytest.fixture(scope="session")
def event_loop():
    """为 async 测试创建事件循环"""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
