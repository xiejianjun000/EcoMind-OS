"""
EcoMind 测试框架骨架

对标 OpenClaw 的 82+ 测试覆盖。
使用 pytest + httpx (async) 进行 API 测试。
"""
import pytest
import pytest_asyncio
import httpx
import os
import sys

# 确保 backend 在 path 中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000"


@pytest_asyncio.fixture
async def client():
    """异步 HTTP 客户端"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as ac:
        yield ac


# ══════════════════════════════════════════════
# 1. 基础健康检查
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_health_check(client):
    """后端健康检查"""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_chat_health(client):
    """Chat引擎健康检查"""
    resp = await client.get("/api/chat/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "tools_registered" in data


# ══════════════════════════════════════════════
# 2. SOUL 人格加载
# ══════════════════════════════════════════════

def test_soul_ecomind_loaded():
    """ecomind 人格文件存在且可加载"""
    from api.routers.chat import _load_agent_soul
    soul = _load_agent_soul("ecomind")
    assert soul is not None
    assert len(soul) > 500  # 至少500字符


def test_all_agents_have_soul():
    """全部12个Agent都有SOUL文件"""
    from api.routers.chat import _AGENT_SOUL_MAP, _load_agent_soul
    missing = []
    for agent_id in _AGENT_SOUL_MAP:
        soul = _load_agent_soul(agent_id)
        if not soul:
            missing.append(agent_id)
    assert missing == [], f"缺失SOUL: {missing}"


# ══════════════════════════════════════════════
# 3. 权限矩阵
# ══════════════════════════════════════════════

def test_ecomind_no_data_access():
    """ecomind 不能查数据"""
    from api.guardrails import EXPERT_TOOL_MATRIX
    tools = EXPERT_TOOL_MATRIX["ecomind"]
    assert "env_query" not in tools
    assert "web_search" not in tools
    assert "regulation_search" not in tools


def test_ecomind_has_dispatch():
    """ecomind 有 dispatch 能力"""
    from api.guardrails import EXPERT_TOOL_MATRIX
    tools = EXPERT_TOOL_MATRIX["ecomind"]
    assert "dispatch_expert" in tools
    assert "memory_save" in tools


def test_enforcement_has_file_read():
    """enforcement 能读文件"""
    from api.guardrails import EXPERT_TOOL_MATRIX
    tools = EXPERT_TOOL_MATRIX["enforcement"]
    assert "code_read" in tools
    assert "regulation_search" in tools


# ══════════════════════════════════════════════
# 4. 记忆功能
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_memory_save_and_probe(client):
    """记忆存取完整流程"""
    # Save
    resp = await client.post("/api/tools/execute", json={
        "tool_name": "memory_save",
        "tool_params": {"content": "test memory entry", "category": "test"},
        "expert_id": "ecomind",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"

    # Probe (needs fact, use fact_add first)
    resp = await client.post("/api/tools/execute", json={
        "tool_name": "fact_add",
        "tool_params": {"entity": "test_entity", "fact": "test fact", "category": "test"},
        "expert_id": "ecomind",
    })
    assert resp.status_code == 200

    resp = await client.post("/api/tools/execute", json={
        "tool_name": "fact_probe",
        "tool_params": {"entity": "test_entity"},
        "expert_id": "ecomind",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["count"] >= 1


# ══════════════════════════════════════════════
# 5. 对话功能
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_chat_simple(client):
    """简单对话"""
    resp = await client.post("/api/chat", json={
        "message": "你好",
        "expert_id": "ecomind",
        "stream": False,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert len(data["content"]) > 0


@pytest.mark.asyncio
async def test_chat_env_monitoring(client):
    """环境监测专家对话"""
    resp = await client.post("/api/chat", json={
        "message": "长沙今天空气质量怎么样",
        "expert_id": "env-monitoring",
        "stream": False,
    })
    assert resp.status_code == 200


# ══════════════════════════════════════════════
# 6. 模型管理器
# ══════════════════════════════════════════════

@pytest.mark.asyncio
async def test_model_manager_loads():
    """模型管理器能加载配置"""
    from engine.model_manager import get_model_manager
    mgr = await get_model_manager()
    models = mgr.get_all_model_ids()
    assert len(models) >= 1
    assert "deepseek-chat" in models


def test_model_manager_fallback():
    """模型降级链存在"""
    from engine.model_manager import ModelManager
    mgr = ModelManager()
    mgr._setup_defaults()
    assert mgr.fallback_chain == ["deepseek-chat"]


# ══════════════════════════════════════════════
# 7. 配置热加载
# ══════════════════════════════════════════════

def test_config_watcher_registers():
    """配置监控器注册目标"""
    from engine.config_watcher import ConfigWatcher
    w = ConfigWatcher()
    called = False
    def cb():
        nonlocal called
        called = True

    import tempfile, os
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write("test")
        tmp = f.name

    try:
        w.watch(tmp, "test", cb)
        assert len(w._targets) == 1
    finally:
        os.unlink(tmp)
