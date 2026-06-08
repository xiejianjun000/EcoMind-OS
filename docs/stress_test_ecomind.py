"""
EcoMind OS 端到端压力测试套件
Point-to-Point, End-to-End Stress Testing

测试覆盖：
1. API 端点压力测试 (Agent/Workflow/Security/Model)
2. WebSocket 连接压力测试
3. 并发请求压力测试
4. 数据一致性测试
5. 性能基准测试
"""

import asyncio
import gc
import json
import os
import sys
import time
import statistics
import tracemalloc
import psutil
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from pathlib import Path
import weakref

import httpx

try:
    import websockets
except ImportError:
    websockets = None

try:
    import numpy as np
except ImportError:
    np = None


BASE_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE_DIR / "backend" / "taiji-agent" / "src"))

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
WS_BASE_URL = os.getenv("WS_BASE_URL", "ws://localhost:8000")


@dataclass
class StressTestResult:
    name: str
    test_type: str
    iterations: int
    concurrent_users: int
    duration_seconds: float
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    throughput_rps: float
    error_rate: float
    memory_delta_mb: float
    cpu_usage_percent: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class EcoMindStressTestRunner:
    def __init__(self):
        self.results: list[StressTestResult] = []
        self.start_time: Optional[datetime] = None
        self.process = psutil.Process()
        self.api_available = False
        self.websocket_available = False
        self.httpx_client: Optional[httpx.AsyncClient] = None

    async def initialize(self):
        """初始化测试环境"""
        print("\n" + "=" * 80)
        print("🔧 EcoMind OS 端到端压力测试初始化")
        print("=" * 80)

        self.start_time = datetime.now()
        tracemalloc.start()

        gc.collect()
        self.initial_memory = self.process.memory_info().rss / (1024 * 1024)
        self.initial_cpu = self.process.cpu_percent()

        self.httpx_client = httpx.AsyncClient(
            base_url=API_BASE_URL,
            timeout=30.0,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
        )

        await self._check_api_availability()
        await self._check_websocket_availability()

        print(f"\n📊 环境状态:")
        print(f"  API 服务: {'✅ 可用' if self.api_available else '❌ 不可用 (将使用模拟数据)'}")
        print(f"  WebSocket: {'✅ 可用' if self.websocket_available else '❌ 不可用 (将使用模拟数据)'}")
        print(f"  初始内存: {self.initial_memory:.2f} MB")
        print(f"  初始CPU: {self.initial_cpu:.1f}%")

    async def _check_api_availability(self):
        """检查API服务可用性"""
        try:
            response = await self.httpx_client.get("/health", timeout=5.0)
            self.api_available = response.status_code == 200
        except Exception as e:
            print(f"  ⚠️ API健康检查失败: {e}")
            self.api_available = False

    async def _check_websocket_availability(self):
        """检查WebSocket可用性"""
        if websockets is None:
            self.websocket_available = False
            return

        try:
            async with websockets.connect(f"{WS_BASE_URL}/ws", ping_timeout=5) as ws:
                await ws.send(json.dumps({"action": "ping"}))
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                self.websocket_available = True
        except Exception as e:
            print(f"  ⚠️ WebSocket连接失败: {e}")
            self.websocket_available = False

    async def close(self):
        """清理测试环境"""
        if self.httpx_client:
            await self.httpx_client.aclose()

        tracemalloc.stop()

        gc.collect()
        final_memory = self.process.memory_info().rss / (1024 * 1024)
        memory_delta = final_memory - self.initial_memory

        print(f"\n📊 资源使用:")
        print(f"  初始内存: {self.initial_memory:.2f} MB")
        print(f"  最终内存: {final_memory:.2f} MB")
        print(f"  内存增量: {memory_delta:.2f} MB")

    def _record_result(
        self,
        name: str,
        test_type: str,
        iterations: int,
        concurrent_users: int,
        duration: float,
        latencies: list[float],
        successes: int,
        failures: int,
    ) -> StressTestResult:
        """记录测试结果"""
        latencies_sorted = sorted(latencies) if latencies else [0]
        total = successes + failures

        result = StressTestResult(
            name=name,
            test_type=test_type,
            iterations=iterations,
            concurrent_users=concurrent_users,
            duration_seconds=duration,
            total_requests=total,
            successful_requests=successes,
            failed_requests=failures,
            avg_latency_ms=statistics.mean(latencies) if latencies else 0,
            min_latency_ms=min(latencies_sorted) if latencies else 0,
            max_latency_ms=max(latencies_sorted) if latencies else 0,
            p50_latency_ms=latencies_sorted[int(len(latencies_sorted) * 0.50)] if latencies else 0,
            p95_latency_ms=latencies_sorted[int(len(latencies_sorted) * 0.95)] if latencies else 0,
            p99_latency_ms=latencies_sorted[int(len(latencies_sorted) * 0.99)] if latencies else 0,
            throughput_rps=total / duration if duration > 0 else 0,
            error_rate=failures / total if total > 0 else 0,
            memory_delta_mb=0,
            cpu_usage_percent=self.process.cpu_percent(),
        )

        self.results.append(result)
        return result

    def _print_result(self, result: StressTestResult, prefix: str = "📊"):
        """打印测试结果"""
        print(f"\n{prefix} {result.name}")
        print(f"   测试类型: {result.test_type}")
        print(f"   迭代次数: {result.iterations}")
        print(f"   并发用户: {result.concurrent_users}")
        print(f"   持续时间: {result.duration_seconds:.2f}s")
        print(f"   总请求数: {result.total_requests}")
        print(f"   成功/失败: {result.successful_requests}/{result.failed_requests}")
        print(f"   错误率: {result.error_rate * 100:.2f}%")
        print(f"   吞吐量: {result.throughput_rps:.2f} req/s")
        print(f"   平均延迟: {result.avg_latency_ms:.2f}ms")
        print(f"   最小延迟: {result.min_latency_ms:.2f}ms")
        print(f"   最大延迟: {result.max_latency_ms:.2f}ms")
        print(f"   P50延迟: {result.p50_latency_ms:.2f}ms")
        print(f"   P95延迟: {result.p95_latency_ms:.2f}ms")
        print(f"   P99延迟: {result.p99_latency_ms:.2f}ms")
        print(f"   CPU使用: {result.cpu_usage_percent:.1f}%")

    async def run_all_tests(self):
        """运行所有压力测试"""
        print("\n" + "=" * 80)
        print("🚀 EcoMind OS 端到端压力测试开始")
        print(f"开始时间: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)

        await self.test_1_health_endpoint()
        await self.test_2_agent_crud_operations()
        await self.test_3_workflow_crud_operations()
        await self.test_4_security_operations()
        await self.test_5_model_operations()
        await self.test_6_concurrent_requests()
        await self.test_7_websocket_connections()
        await self.test_8_taiji_agent_core()
        await self.test_9_govmcp_modules()
        await self.test_10_memory_pressure()

        self.print_summary()

    async def test_1_health_endpoint(self):
        """测试1: 健康检查端点压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试1: 健康检查端点压力测试")
        print("-" * 80)

        if not self.api_available:
            print("  ⏭️ 跳过: API服务不可用")
            return

        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        for i in range(500):
            req_start = time.perf_counter()
            try:
                response = await self.httpx_client.get("/health")
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                if response.status_code == 200:
                    successes += 1
                else:
                    failures += 1
            except Exception:
                failures += 1
                latencies.append(5000)

        duration = time.perf_counter() - start
        result = self._record_result(
            "健康检查端点",
            "HTTP GET",
            500,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_2_agent_crud_operations(self):
        """测试2: Agent CRUD操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试2: Agent CRUD操作压力测试")
        print("-" * 80)

        test_cases = [
            ("创建Agent", "POST /api/agents/", self._create_agent),
            ("列出Agent", "GET /api/agents/", self._list_agents),
            ("获取Agent", "GET /api/agents/{id}", self._get_agent),
            ("更新Agent状态", "PUT /api/agents/{id}/status", self._update_agent_status),
        ]

        for name, endpoint, test_func in test_cases:
            if not self.api_available:
                print(f"  ⏭️ 跳过 {name}: API服务不可用")
                continue

            latencies = []
            successes = 0
            failures = 0
            agent_ids = []
            start = time.perf_counter()

            for i in range(100):
                req_start = time.perf_counter()
                try:
                    success, agent_id = await test_func(agent_ids)
                    latency = (time.perf_counter() - req_start) * 1000
                    latencies.append(latency)
                    if success:
                        successes += 1
                        if agent_id:
                            agent_ids.append(agent_id)
                    else:
                        failures += 1
                except Exception as e:
                    failures += 1
                    latencies.append(5000)

            duration = time.perf_counter() - start
            result = self._record_result(
                f"Agent CRUD - {name}",
                endpoint,
                100,
                1,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result, "  📊")

    async def _create_agent(self, agent_ids: list) -> tuple[bool, Optional[str]]:
        """创建Agent"""
        data = {
            "name": f"TestAgent_{int(time.time() * 1000)}",
            "description": "压力测试Agent",
            "provider": "qwen",
            "model": "qwen-max",
            "temperature": 0.7,
        }
        response = await self.httpx_client.post("/api/agents/", json=data)
        if response.status_code == 201:
            result = response.json()
            return True, result.get("agent_id")
        return False, None

    async def _list_agents(self, agent_ids: list) -> tuple[bool, Optional[str]]:
        """列出Agent"""
        response = await self.httpx_client.get("/api/agents/?limit=50")
        return response.status_code == 200, None

    async def _get_agent(self, agent_ids: list) -> tuple[bool, Optional[str]]:
        """获取Agent详情"""
        if agent_ids:
            agent_id = agent_ids[0] if agent_ids else None
            if agent_id:
                response = await self.httpx_client.get(f"/api/agents/{agent_id}")
                return response.status_code == 200, agent_id
        return False, None

    async def _update_agent_status(self, agent_ids: list) -> tuple[bool, Optional[str]]:
        """更新Agent状态"""
        if agent_ids:
            agent_id = agent_ids[0] if agent_ids else None
            if agent_id:
                data = {"status": "running"}
                response = await self.httpx_client.put(
                    f"/api/agents/{agent_id}/status", json=data
                )
                return response.status_code == 200, agent_id
        return False, None

    async def test_3_workflow_crud_operations(self):
        """测试3: Workflow CRUD操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试3: Workflow CRUD操作压力测试")
        print("-" * 80)

        if not self.api_available:
            print("  ⏭️ 跳过: API服务不可用")
            return

        test_cases = [
            ("创建Workflow", self._create_workflow),
            ("列出Workflow", self._list_workflows),
            ("执行Workflow", self._execute_workflow),
        ]

        workflow_ids = []

        for name, test_func in test_cases:
            latencies = []
            successes = 0
            failures = 0
            start = time.perf_counter()

            for i in range(50):
                req_start = time.perf_counter()
                try:
                    success, wf_id = await test_func(workflow_ids)
                    latency = (time.perf_counter() - req_start) * 1000
                    latencies.append(latency)
                    if success:
                        successes += 1
                        if wf_id:
                            workflow_ids.append(wf_id)
                    else:
                        failures += 1
                except Exception:
                    failures += 1
                    latencies.append(5000)

            duration = time.perf_counter() - start
            result = self._record_result(
                f"Workflow - {name}",
                "REST API",
                50,
                1,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result, "  📊")

    async def _create_workflow(self, workflow_ids: list) -> tuple[bool, Optional[str]]:
        """创建Workflow"""
        data = {
            "name": f"TestWorkflow_{int(time.time() * 1000)}",
            "description": "压力测试工作流",
            "nodes": [
                {"name": "start", "node_type": "start", "config": {}},
                {"name": "process", "node_type": "agent", "config": {}},
                {"name": "end", "node_type": "end", "config": {}},
            ],
            "edges": [
                {"source": "start", "target": "process"},
                {"source": "process", "target": "end"},
            ],
        }
        response = await self.httpx_client.post("/api/workflows/", json=data)
        if response.status_code == 201:
            result = response.json()
            return True, result.get("workflow_id")
        return False, None

    async def _list_workflows(self, workflow_ids: list) -> tuple[bool, Optional[str]]:
        """列出Workflow"""
        response = await self.httpx_client.get("/api/workflows/?limit=50")
        return response.status_code == 200, None

    async def _execute_workflow(self, workflow_ids: list) -> tuple[bool, Optional[str]]:
        """执行Workflow"""
        if workflow_ids:
            wf_id = workflow_ids[0] if workflow_ids else None
            if wf_id:
                data = {"initial_state": {"test": "data"}}
                response = await self.httpx_client.post(
                    f"/api/workflows/{wf_id}/execute", json=data
                )
                return response.status_code == 200, wf_id
        return False, None

    async def test_4_security_operations(self):
        """测试4: 安全模块操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试4: 安全模块操作压力测试")
        print("-" * 80)

        if not self.api_available:
            print("  ⏭️ 跳过: API服务不可用")
            return

        test_cases = [
            ("安全事件列表", "/api/security/events"),
            ("审批队列", "/api/security/approvals"),
            ("审计日志", "/api/security/audit-trail"),
        ]

        for name, endpoint in test_cases:
            latencies = []
            successes = 0
            failures = 0
            start = time.perf_counter()

            for i in range(100):
                req_start = time.perf_counter()
                try:
                    response = await self.httpx_client.get(endpoint)
                    latency = (time.perf_counter() - req_start) * 1000
                    latencies.append(latency)
                    if response.status_code == 200:
                        successes += 1
                    else:
                        failures += 1
                except Exception:
                    failures += 1
                    latencies.append(5000)

            duration = time.perf_counter() - start
            result = self._record_result(
                f"Security - {name}",
                f"GET {endpoint}",
                100,
                1,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result, "  📊")

    async def test_5_model_operations(self):
        """测试5: 模型管理操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试5: 模型管理操作压力测试")
        print("-" * 80)

        if not self.api_available:
            print("  ⏭️ 跳过: API服务不可用")
            return

        test_cases = [
            ("模型列表", "/api/models/"),
            ("模型健康检查", "/api/models/status"),
            ("模型配置", "/api/models/config"),
        ]

        for name, endpoint in test_cases:
            latencies = []
            successes = 0
            failures = 0
            start = time.perf_counter()

            for i in range(100):
                req_start = time.perf_counter()
                try:
                    response = await self.httpx_client.get(endpoint)
                    latency = (time.perf_counter() - req_start) * 1000
                    latencies.append(latency)
                    if response.status_code == 200:
                        successes += 1
                    else:
                        failures += 1
                except Exception:
                    failures += 1
                    latencies.append(5000)

            duration = time.perf_counter() - start
            result = self._record_result(
                f"Model - {name}",
                f"GET {endpoint}",
                100,
                1,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result, "  📊")

    async def test_6_concurrent_requests(self):
        """测试6: 并发请求压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试6: 并发请求压力测试")
        print("-" * 80)

        if not self.api_available:
            print("  ⏭️ 跳过: API服务不可用")
            return

        concurrent_levels = [10, 25, 50]

        for concurrent in concurrent_levels:
            latencies = []
            successes = 0
            failures = 0
            start = time.perf_counter()

            async def make_request():
                nonlocal successes, failures
                req_start = time.perf_counter()
                try:
                    response = await self.httpx_client.get("/health")
                    latency = (time.perf_counter() - req_start) * 1000
                    latencies.append(latency)
                    if response.status_code == 200:
                        successes += 1
                    else:
                        failures += 1
                except Exception:
                    failures += 1
                    latencies.append(5000)

            tasks = [make_request() for _ in range(concurrent * 10)]
            await asyncio.gather(*tasks)

            duration = time.perf_counter() - start
            result = self._record_result(
                f"并发请求 - {concurrent}用户",
                "HTTP GET",
                concurrent * 10,
                concurrent,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result)

    async def test_7_websocket_connections(self):
        """测试7: WebSocket连接压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试7: WebSocket连接压力测试")
        print("-" * 80)

        if not self.websocket_available or websockets is None:
            print("  ⏭️ 跳过: WebSocket服务不可用")
            self._record_result(
                "WebSocket连接",
                "WebSocket",
                50,
                1,
                1.0,
                [10.0] * 50,
                0,
                50,
            )
            return

        test_connections = 50

        async def test_websocket_connection():
            start = time.perf_counter()
            try:
                async with websockets.connect(
                    f"{WS_BASE_URL}/ws", ping_timeout=10
                ) as ws:
                    await ws.send(json.dumps({"action": "ping"}))
                    await asyncio.wait_for(ws.recv(), timeout=5)
                    latency = (time.perf_counter() - start) * 1000
                    return True, latency
            except Exception:
                latency = (time.perf_counter() - start) * 1000
                return False, latency

        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        for _ in range(test_connections):
            success, latency = await test_websocket_connection()
            latencies.append(latency)
            if success:
                successes += 1
            else:
                failures += 1

        duration = time.perf_counter() - start
        result = self._record_result(
            "WebSocket连接测试",
            "WebSocket Connect",
            test_connections,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_8_taiji_agent_core(self):
        """测试8: Taiji Agent核心模块压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试8: Taiji Agent核心模块压力测试")
        print("-" * 80)

        test_cases = []

        try:
            from taiji_agent import TaijiVerifier, HallucinationDetector, SessionMemory
            test_cases.append(("TaijiVerifier", TaijiVerifier))
            test_cases.append(("HallucinationDetector", HallucinationDetector))
            test_cases.append(("SessionMemory", SessionMemory))
        except ImportError as e:
            print(f"  ⚠️ 无法导入Taiji Agent模块: {e}")
            return

        for name, cls in test_cases:
            latencies = []
            successes = 0
            failures = 0
            start = time.perf_counter()

            try:
                instance = cls()
                iterations = 1000

                for i in range(iterations):
                    req_start = time.perf_counter()
                    try:
                        if name == "TaijiVerifier":
                            instance.verify("测试内容包含一些数字95%和不确定表达据我所知。")
                        elif name == "HallucinationDetector":
                            instance.detect("这是一个正常的内容，包含一些数字如95%。")
                        elif name == "SessionMemory":
                            key = f"test_key_{i}"
                            instance.save(key, f"test_value_{i}")
                            instance.get(key)

                        latency = (time.perf_counter() - req_start) * 1000
                        latencies.append(latency)
                        successes += 1
                    except Exception:
                        failures += 1
                        latencies.append(1.0)

            except Exception as e:
                print(f"  ⚠️ {name} 初始化失败: {e}")
                continue

            duration = time.perf_counter() - start
            result = self._record_result(
                f"TaijiAgent - {name}",
                "Module Stress",
                iterations,
                1,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result)

    async def test_9_govmcp_modules(self):
        """测试9: GovMCP模块压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试9: GovMCP模块压力测试")
        print("-" * 80)

        test_cases = []

        try:
            from taiji_agent.govmcp.crypto import SM3Hash, SM4Encryptor
            from taiji_agent.govmcp.workflow import ApprovalWorkflow
            from taiji_agent.govmcp.tools import GovTools
            test_cases = [
                ("SM3Hash", lambda: SM3Hash.hash(b"test data" * 10)),
                ("ApprovalWorkflow.create_request", lambda: ApprovalWorkflow().create_request(
                    title="Test", description="Test", requester="user", department="dept"
                )),
                ("GovTools.id_number.mask_id_number", lambda: GovTools().id_number.mask_id_number("110101199001011234")),
            ]
        except ImportError as e:
            print(f"  ⚠️ 无法导入GovMCP模块: {e}")
            return

        for name, test_func in test_cases:
            latencies = []
            successes = 0
            failures = 0
            start = time.perf_counter()
            iterations = 1000

            for i in range(iterations):
                req_start = time.perf_counter()
                try:
                    test_func()
                    latency = (time.perf_counter() - req_start) * 1000
                    latencies.append(latency)
                    successes += 1
                except Exception as e:
                    failures += 1
                    latencies.append(1.0)

            duration = time.perf_counter() - start
            result = self._record_result(
                f"GovMCP - {name}",
                "Module Stress",
                iterations,
                1,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result)

    async def test_10_memory_pressure(self):
        """测试10: 内存压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试10: 内存压力测试")
        print("-" * 80)

        gc.collect()
        mem_before = self.process.memory_info().rss / (1024 * 1024)

        instances_created = 0
        iterations = 100

        try:
            from taiji_agent import TaijiAgent, AgentConfig, SessionMemory

            for i in range(iterations):
                agent = TaijiAgent(config=AgentConfig())
                mem = SessionMemory()
                mem.save(f"key_{i}", f"value_{i}" * 100)
                instances_created += 1

        except ImportError:
            print("  ⚠️ Taiji Agent模块不可用，跳过内存压力测试")
            return

        gc.collect()
        mem_after = self.process.memory_info().rss / (1024 * 1024)
        mem_delta = mem_after - mem_before

        print(f"\n  📊 内存压力测试结果:")
        print(f"     创建实例数: {instances_created}")
        print(f"     内存前: {mem_before:.2f} MB")
        print(f"     内存后: {mem_after:.2f} MB")
        print(f"     内存增量: {mem_delta:.2f} MB")
        print(f"     每实例内存: {mem_delta / instances_created:.4f} MB")

        result = StressTestResult(
            name="内存压力测试",
            test_type="Memory Pressure",
            iterations=iterations,
            concurrent_users=1,
            duration_seconds=0,
            total_requests=iterations,
            successful_requests=instances_created,
            failed_requests=0,
            avg_latency_ms=0,
            min_latency_ms=0,
            max_latency_ms=0,
            p50_latency_ms=0,
            p95_latency_ms=0,
            p99_latency_ms=0,
            throughput_rps=0,
            error_rate=0,
            memory_delta_mb=mem_delta,
            cpu_usage_percent=self.process.cpu_percent(),
        )
        self.results.append(result)

    def print_summary(self):
        """打印测试总结"""
        end_time = datetime.now()
        total_duration = (end_time - self.start_time).total_seconds()

        print("\n" + "=" * 80)
        print("📋 EcoMind OS 压力测试总结报告")
        print("=" * 80)
        print(f"\n开始时间: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"结束时间: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"总耗时: {total_duration:.2f} 秒")

        print("\n" + "-" * 80)
        print("📊 测试结果统计:")
        print("-" * 80)

        total_tests = len(self.results)
        successful_tests = sum(1 for r in self.results if r.error_rate == 0)
        failed_tests = total_tests - successful_tests

        print(f"总测试数: {total_tests}")
        print(f"成功测试: {successful_tests} ({successful_tests/total_tests*100:.1f}%)")
        print(f"失败测试: {failed_tests} ({failed_tests/total_tests*100:.1f}%)")

        total_requests = sum(r.total_requests for r in self.results)
        total_success = sum(r.successful_requests for r in self.results)
        total_failures = sum(r.failed_requests for r in self.results)

        print(f"\n总请求数: {total_requests}")
        print(f"成功请求: {total_success} ({total_success/total_requests*100:.1f}%)")
        print(f"失败请求: {total_failures} ({total_failures/total_requests*100:.1f}%)")

        all_latencies = []
        for r in self.results:
            all_latencies.extend([r.avg_latency_ms, r.p50_latency_ms, r.p95_latency_ms])

        if all_latencies:
            avg_latency = statistics.mean(all_latencies)
            p95_latency = sorted(all_latencies)[int(len(all_latencies) * 0.95)]
            print(f"\n平均延迟: {avg_latency:.2f}ms")
            print(f"P95延迟: {p95_latency:.2f}ms")

        total_throughput = sum(r.throughput_rps for r in self.results)
        print(f"总吞吐量: {total_throughput:.2f} req/s")

        print("\n" + "-" * 80)
        print("📈 各测试详细结果:")
        print("-" * 80)

        for i, r in enumerate(self.results, 1):
            status = "✅" if r.error_rate == 0 else "❌"
            print(f"{i}. {status} {r.name}")
            print(f"   类型: {r.test_type} | 请求: {r.total_requests} | "
                  f"吞吐量: {r.throughput_rps:.2f} r/s | "
                  f"P95延迟: {r.p95_latency_ms:.2f}ms | "
                  f"错误率: {r.error_rate*100:.1f}%")

        self._generate_json_report()

        print("\n" + "=" * 80)
        print("🎉 EcoMind OS 压力测试完成!")
        print("=" * 80)

    def _generate_json_report(self):
        """生成JSON格式的测试报告"""
        report_path = BASE_DIR / "docs" / "stress_test_report.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)

        report = {
            "test_info": {
                "project": "EcoMind OS",
                "version": "1.0.0",
                "start_time": self.start_time.isoformat() if self.start_time else None,
                "end_time": datetime.now().isoformat(),
                "api_available": self.api_available,
                "websocket_available": self.websocket_available,
            },
            "summary": {
                "total_tests": len(self.results),
                "successful_tests": sum(1 for r in self.results if r.error_rate == 0),
                "failed_tests": sum(1 for r in self.results if r.error_rate > 0),
                "total_requests": sum(r.total_requests for r in self.results),
                "successful_requests": sum(r.successful_requests for r in self.results),
                "failed_requests": sum(r.failed_requests for r in self.results),
                "total_throughput_rps": sum(r.throughput_rps for r in self.results),
            },
            "results": [
                {
                    "name": r.name,
                    "test_type": r.test_type,
                    "iterations": r.iterations,
                    "concurrent_users": r.concurrent_users,
                    "duration_seconds": r.duration_seconds,
                    "total_requests": r.total_requests,
                    "successful_requests": r.successful_requests,
                    "failed_requests": r.failed_requests,
                    "avg_latency_ms": r.avg_latency_ms,
                    "min_latency_ms": r.min_latency_ms,
                    "max_latency_ms": r.max_latency_ms,
                    "p50_latency_ms": r.p50_latency_ms,
                    "p95_latency_ms": r.p95_latency_ms,
                    "p99_latency_ms": r.p99_latency_ms,
                    "throughput_rps": r.throughput_rps,
                    "error_rate": r.error_rate,
                    "memory_delta_mb": r.memory_delta_mb,
                    "cpu_usage_percent": r.cpu_usage_percent,
                    "timestamp": r.timestamp,
                }
                for r in self.results
            ],
        }

        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(f"\n📄 JSON报告已生成: {report_path}")


async def main():
    """主函数"""
    runner = EcoMindStressTestRunner()

    try:
        await runner.initialize()
        await runner.run_all_tests()
    finally:
        await runner.close()


if __name__ == "__main__":
    asyncio.run(main())
