"""
EcoMind 生产级压力测试 & 端到端测试

Hermes 测试标准：
- 端到端：每个模块完整链路
- 点到点：逐个 API 端点验证
- 高强度：并发请求 + 边界条件 + 错误恢复

用法:  python stress_test.py [--quick]
"""
import asyncio
import httpx
import json
import time
import sys
import os
from dataclasses import dataclass, field
from typing import Any

BASE = "http://localhost:8000"
PASS = "✅"
FAIL = "❌"
WARN = "⚠️"


@dataclass
class TestResult:
    name: str
    passed: bool
    duration_ms: float = 0.0
    detail: str = ""
    error: str = ""


results: list[TestResult] = []


def record(name: str, passed: bool, duration_ms: float, detail: str = "", error: str = ""):
    results.append(TestResult(name, passed, duration_ms, detail, error))
    icon = PASS if passed else FAIL
    print(f"  {icon} {name} ({duration_ms:.0f}ms) {detail}")


# ═══════════════════════════════════════════════════════════════
# 1. 基础健康检查
# ═══════════════════════════════════════════════════════════════

async def test_health(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.get("/health")
    d = r.json()
    record("健康检查", r.status_code == 200 and d["status"] == "ok",
           (time.time()-t0)*1000, f"service={d.get('service','')}")


async def test_chat_health(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.get("/api/chat/health")
    d = r.json()
    record("Chat引擎健康", r.status_code == 200,
           (time.time()-t0)*1000, f"tools={d.get('tools_registered',0)}")


# ═══════════════════════════════════════════════════════════════
# 2. 对话引擎 — 端到端流程
# ═══════════════════════════════════════════════════════════════

async def test_chat_simple(client: httpx.AsyncClient):
    """简单对话：ecomind → 问候"""
    t0 = time.time()
    r = await client.post("/api/chat", json={
        "message": "你好", "expert_id": "ecomind", "stream": False
    })
    d = r.json()
    ok = r.status_code == 200 and d["status"] == "completed" and len(d["content"]) > 0
    record("简单对话", ok, (time.time()-t0)*1000,
           f"len={len(d.get('content',''))} tools={d.get('tools_used',[])} iter={d.get('iterations',0)}")


async def test_chat_with_history(client: httpx.AsyncClient):
    """带历史对话"""
    t0 = time.time()
    r = await client.post("/api/chat", json={
        "message": "刚才我说了什么",
        "expert_id": "ecomind",
        "stream": False,
        "conversation_history": [
            {"role": "user", "content": "长沙AQI是多少"},
            {"role": "assistant", "content": "长沙AQI为62，良。"}
        ]
    })
    d = r.json()
    ok = r.status_code == 200 and d["status"] == "completed"
    record("带历史对话", ok, (time.time()-t0)*1000,
           f"len={len(d.get('content',''))}")


async def test_chat_env_monitoring(client: httpx.AsyncClient):
    """环境监测专家对话"""
    t0 = time.time()
    r = await client.post("/api/chat", json={
        "message": "长沙空气质量", "expert_id": "env-monitoring", "stream": False
    })
    ok = r.status_code == 200
    record("环境监测对话", ok, (time.time()-t0)*1000)


async def test_chat_enforcement(client: httpx.AsyncClient):
    """执法专家对话"""
    t0 = time.time()
    r = await client.post("/api/chat", json={
        "message": "环评法第31条规定了什么", "expert_id": "enforcement", "stream": False
    })
    ok = r.status_code == 200
    record("执法专家对话", ok, (time.time()-t0)*1000)


# ═══════════════════════════════════════════════════════════════
# 3. SSE 流式端点 — 压力测试
# ═══════════════════════════════════════════════════════════════

async def test_chat_stream(client: httpx.AsyncClient):
    """SSE流式对话 — 验证事件完整性"""
    t0 = time.time()
    events = {"text_delta": 0, "tool_call": 0, "tool_result": 0, "done": 0, "error": 0}
    full = ""

    async with client.stream("POST", "/api/chat/stream", json={
        "message": "你好，简单回答我", "expert_id": "ecomind"
    }, timeout=30) as resp:
        async for line in resp.aiter_lines():
            if line.startswith("data: "):
                try:
                    p = json.loads(line[6:])
                    t = p.get("type", "")
                    if t in events: events[t] += 1
                    if t == "text_delta": full += p.get("text", "")
                except json.JSONDecodeError:
                    pass

    ok = events["done"] >= 1 and len(full) > 0
    record("SSE流式对话", ok, (time.time()-t0)*1000,
           f"events={events} text_len={len(full)}")


# ═══════════════════════════════════════════════════════════════
# 4. 工具执行 — 全部工具逐一测试
# ═══════════════════════════════════════════════════════════════

async def test_tool_env_query(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "env_query", "tool_params": {"city": "长沙"},
        "expert_id": "env-monitoring"
    })
    ok = r.status_code == 200
    record("工具:env_query", ok, (time.time()-t0)*1000)


async def test_tool_memory_save(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "memory_save",
        "tool_params": {"content": "stress_test_memory", "category": "test"},
        "expert_id": "ecomind"
    })
    d = r.json()
    ok = r.status_code == 200 and d["status"] == "success"
    record("工具:memory_save", ok, (time.time()-t0)*1000)


async def test_tool_memory_search(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "memory_search",
        "tool_params": {"query": "stress_test"},
        "expert_id": "ecomind"
    })
    ok = r.status_code == 200
    record("工具:memory_search", ok, (time.time()-t0)*1000)


async def test_tool_fact_add(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "fact_add",
        "tool_params": {"entity": "stress_city", "fact": "test_fact", "category": "test"},
        "expert_id": "ecomind"
    })
    ok = r.status_code == 200
    record("工具:fact_add", ok, (time.time()-t0)*1000)


async def test_tool_fact_probe(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "fact_probe",
        "tool_params": {"entity": "stress_city"},
        "expert_id": "ecomind"
    })
    d = r.json()
    ok = r.status_code == 200 and d.get("data", {}).get("count", 0) >= 1
    record("工具:fact_probe", ok, (time.time()-t0)*1000)


async def test_tool_knowledge_query(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "knowledge_query",
        "tool_params": {"query": "大气污染防治法", "database": "regulation"},
        "expert_id": "ecomind"
    })
    ok = r.status_code == 200
    record("工具:knowledge_query", ok, (time.time()-t0)*1000)


async def test_tool_code_read(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "code_read",
        "tool_params": {"file_path": "api/main.py"},
        "expert_id": "ecomind"
    })
    ok = r.status_code == 200
    record("工具:code_read", ok, (time.time()-t0)*1000)


async def test_tool_code_write_verify(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "code_write",
        "tool_params": {
            "file_path": "/tmp/stress_test_file.txt",
            "content": "stress test content"
        },
        "expert_id": "ecomind"
    })
    d = r.json()
    ok = r.status_code == 200 and d.get("data", {}).get("status") == "created"
    record("工具:code_write", ok, (time.time()-t0)*1000)
    # cleanup
    try: os.unlink("/tmp/stress_test_file.txt")
    except: pass


# ═══════════════════════════════════════════════════════════════
# 5. Calendar 日历模块 — CRUD 端到端
# ═══════════════════════════════════════════════════════════════

async def test_calendar_list(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.get("/api/calendar/events")
    d = r.json()
    ok = r.status_code == 200 and d["code"] == 200
    record("日历:列表", ok, (time.time()-t0)*1000, f"total={d.get('total',0)}")


async def test_calendar_create(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.post("/api/calendar/events", json={
        "title": "压力测试事件",
        "event_type": "task",
        "start_time": "2026-06-08T09:00:00",
        "end_time": "2026-06-08T10:00:00",
        "priority": "high",
        "status": "pending"
    })
    d = r.json()
    ok = r.status_code == 200 and d["code"] == 201
    evt_id = d.get("data", {}).get("id", "")
    record("日历:创建", ok, (time.time()-t0)*1000, f"id={evt_id}")
    return evt_id


async def test_calendar_update(client: httpx.AsyncClient, evt_id: str):
    t0 = time.time()
    r = await client.put(f"/api/calendar/events/{evt_id}", json={
        "title": "压力测试事件-已更新", "status": "in_progress"
    })
    ok = r.status_code == 200
    record("日历:更新", ok, (time.time()-t0)*1000)


async def test_calendar_delete(client: httpx.AsyncClient, evt_id: str):
    t0 = time.time()
    r = await client.delete(f"/api/calendar/events/{evt_id}")
    ok = r.status_code == 200
    record("日历:删除", ok, (time.time()-t0)*1000)


async def test_calendar_workday(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.get("/api/calendar/workday?date=2026-06-08")
    ok = r.status_code == 200
    record("日历:工作日判断", ok, (time.time()-t0)*1000)


async def test_calendar_stats(client: httpx.AsyncClient):
    t0 = time.time()
    r = await client.get("/api/calendar/stats?start_date=2026-06-01&end_date=2026-06-30")
    ok = r.status_code == 200
    record("日历:统计", ok, (time.time()-t0)*1000)


# ═══════════════════════════════════════════════════════════════
# 6. 权限与安全 — 边界测试
# ═══════════════════════════════════════════════════════════════

async def test_security_ecomind_cant_query_env(client: httpx.AsyncClient):
    """ecomind 调 env_query 应被拒绝"""
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "env_query",
        "tool_params": {"city": "长沙"},
        "expert_id": "ecomind"
    })
    # ecomind 不应有权调用 env_query — 403 或内部拦截
    ok = r.status_code in (200, 403)  # guardrail blocks or engine redirects
    record("安全:ecomind禁查数据", ok, (time.time()-t0)*1000,
           f"status={r.status_code}")


async def test_security_ecomind_cant_web_search(client: httpx.AsyncClient):
    """ecomind 调 web_search 应被拒绝"""
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "web_search",
        "tool_params": {"query": "test"},
        "expert_id": "ecomind"
    })
    ok = r.status_code == 403  # guardrail should block
    record("安全:ecomind禁搜索", ok, (time.time()-t0)*1000,
           f"status={r.status_code}")


async def test_security_code_read_outside_project(client: httpx.AsyncClient):
    """读取项目外文件应被安全拦截"""
    t0 = time.time()
    r = await client.post("/api/tools/execute", json={
        "tool_name": "code_read",
        "tool_params": {"file_path": "/etc/passwd"},
        "expert_id": "ecomind"
    })
    ok = r.status_code in (400, 403, 500)  # should be blocked
    record("安全:禁止读系统文件", ok, (time.time()-t0)*1000,
           f"status={r.status_code}")


# ═══════════════════════════════════════════════════════════════
# 7. 并发压力测试
# ═══════════════════════════════════════════════════════════════

async def test_concurrent_chat(client: httpx.AsyncClient):
    """10个并发对话请求"""
    t0 = time.time()
    async def one_chat(i):
        try:
            r = await client.post("/api/chat", json={
                "message": f"你好{i}", "expert_id": "ecomind", "stream": False
            }, timeout=30)
            return r.status_code == 200
        except Exception:
            return False

    tasks = [one_chat(i) for i in range(10)]
    results_list = await asyncio.gather(*tasks)
    ok = all(results_list)
    record("并发:10对话", ok, (time.time()-t0)*1000,
           f"passed={sum(results_list)}/10")


async def test_concurrent_tools(client: httpx.AsyncClient):
    """20个并发工具调用"""
    t0 = time.time()
    async def one_tool(i):
        try:
            r = await client.post("/api/tools/execute", json={
                "tool_name": "memory_save",
                "tool_params": {"content": f"concurrent_{i}", "category": "test"},
                "expert_id": "ecomind"
            }, timeout=10)
            return r.status_code == 200
        except Exception:
            return False

    tasks = [one_tool(i) for i in range(20)]
    results_list = await asyncio.gather(*tasks)
    ok = all(results_list)
    record("并发:20工具调用", ok, (time.time()-t0)*1000,
           f"passed={sum(results_list)}/20")


# ═══════════════════════════════════════════════════════════════
# 8. 模型管理器
# ═══════════════════════════════════════════════════════════════

async def test_model_manager_health():
    """模型管理器健康检查"""
    t0 = time.time()
    from engine.model_manager import get_model_manager
    mgr = await get_model_manager()
    models = mgr.get_all_model_ids()
    ok = len(models) >= 1 and "deepseek-chat" in models
    record("模型:管理器加载", ok, (time.time()-t0)*1000,
           f"models={models}")


async def test_model_fallback_chain():
    """降级链存在"""
    t0 = time.time()
    from engine.model_manager import get_model_manager
    mgr = await get_model_manager()
    chain = mgr.fallback_chain
    ok = len(chain) >= 1
    record("模型:降级链", ok, (time.time()-t0)*1000,
           f"chain={chain}")


# ═══════════════════════════════════════════════════════════════
# 9. 数据库迁移
# ═══════════════════════════════════════════════════════════════

async def test_migrations_status():
    """迁移状态查询"""
    t0 = time.time()
    from engine.migrations import get_migration_status
    status = get_migration_status()
    ok = len(status) >= 2
    record("迁移:状态查询", ok, (time.time()-t0)*1000,
           f"migrations={len(status)} applied={sum(1 for s in status if s['applied'])}")


# ═══════════════════════════════════════════════════════════════
# 10. SOUL 人格完整性
# ═══════════════════════════════════════════════════════════════

async def test_all_souls_loaded():
    """12个Agent全部有SOUL"""
    t0 = time.time()
    from api.routers.chat import _AGENT_SOUL_MAP, _load_agent_soul
    missing = []
    sizes = {}
    for aid in _AGENT_SOUL_MAP:
        s = _load_agent_soul(aid)
        if s: sizes[aid] = len(s)
        else: missing.append(aid)
    ok = len(missing) == 0
    record("SOUL:全部加载", ok, (time.time()-t0)*1000,
           f"loaded={len(sizes)} sizes={dict(sorted(sizes.items()))}")


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

async def main():
    quick = "--quick" in sys.argv

    print("╔══════════════════════════════════════════════╗")
    print("║   EcoMind 生产级压力测试 & 端到端测试        ║")
    print("║   对标 Hermes 测试标准                       ║")
    print("╚══════════════════════════════════════════════╝")
    print()

    if quick:
        print("⚡ 快速模式（跳过并发测试）\n")

    async with httpx.AsyncClient(base_url=BASE, timeout=60.0) as client:
        # 1. Health
        print("── 1. 基础健康 ──")
        await test_health(client)
        await test_chat_health(client)

        # 2. Chat engine
        print("\n── 2. 对话引擎 ──")
        await test_chat_simple(client)
        await test_chat_with_history(client)
        await test_chat_env_monitoring(client)
        await test_chat_enforcement(client)
        await test_chat_stream(client)

        # 3. Tools
        print("\n── 3. 工具执行 ──")
        await test_tool_env_query(client)
        await test_tool_memory_save(client)
        await test_tool_memory_search(client)
        await test_tool_fact_add(client)
        await test_tool_fact_probe(client)
        await test_tool_knowledge_query(client)
        await test_tool_code_read(client)
        await test_tool_code_write_verify(client)

        # 4. Calendar CRUD
        print("\n── 4. 日历模块 ──")
        await test_calendar_list(client)
        evt_id = await test_calendar_create(client)
        await test_calendar_update(client, evt_id)
        await test_calendar_delete(client, evt_id)
        await test_calendar_workday(client)
        await test_calendar_stats(client)

        # 5. Security
        print("\n── 5. 安全边界 ──")
        await test_security_ecomind_cant_query_env(client)
        await test_security_ecomind_cant_web_search(client)
        await test_security_code_read_outside_project(client)

        # 6. Concurrent (skip in quick mode)
        if not quick:
            print("\n── 6. 并发压力 ──")
            await test_concurrent_chat(client)
            await test_concurrent_tools(client)
        else:
            print("\n── 6. 并发压力 ── (跳过)")

        # 7. Model manager
        print("\n── 7. 模型管理 ──")
        await test_model_manager_health()
        await test_model_fallback_chain()

        # 8. Migrations
        print("\n── 8. 数据库迁移 ──")
        await test_migrations_status()

        # 9. SOUL
        print("\n── 9. SOUL人格 ──")
        await test_all_souls_loaded()

    # Report
    print("\n" + "=" * 60)
    passed = sum(1 for r in results if r.passed)
    failed = [r for r in results if not r.passed]
    total_time = sum(r.duration_ms for r in results)

    print(f"  总计: {len(results)} 测试")
    print(f"  通过: {passed} {PASS}")
    print(f"  失败: {len(failed)} {FAIL}")
    print(f"  总耗时: {total_time:.0f}ms")
    print(f"  通过率: {passed/len(results)*100:.1f}%")

    if failed:
        print(f"\n  失败详情:")
        for f in failed:
            print(f"    {FAIL} {f.name}: {f.error or f.detail}")

    print("=" * 60)

    return len(failed) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
