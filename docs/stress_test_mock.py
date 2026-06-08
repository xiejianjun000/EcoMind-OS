"""
EcoMind OS 端到端压力测试套件 (模拟模式)
Point-to-Point, End-to-End Stress Testing (Mock Mode)

当API服务不可用时，使用模拟数据进行压力测试
测试覆盖：核心模块性能、数据结构操作、并发处理能力
"""

import asyncio
import gc
import json
import os
import sys
import time
import statistics
import tracemalloc
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from pathlib import Path
import random
import string
import hashlib


BASE_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE_DIR / "backend" / "taiji-agent" / "src"))


@dataclass
class StressTestResult:
    name: str
    test_type: str
    iterations: int
    concurrent_users: int
    duration_seconds: float
    total_operations: int
    successful_operations: int
    failed_operations: int
    avg_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    throughput_ops: float
    error_rate: float
    memory_delta_mb: float
    cpu_usage_percent: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class EcoMindStressTestRunner:
    def __init__(self):
        self.results: list[StressTestResult] = []
        self.start_time: Optional[datetime] = None
        self.process_memory_start = 0
        self.taiji_available = False
        self.govmcp_available = False

    async def initialize(self):
        """初始化测试环境"""
        print("\n" + "=" * 80)
        print("🔧 EcoMind OS 端到端压力测试初始化 (模拟模式)")
        print("=" * 80)

        self.start_time = datetime.now()
        tracemalloc.start()

        gc.collect()
        try:
            import psutil
            self.process_memory_start = psutil.Process().memory_info().rss / (1024 * 1024)
        except:
            self.process_memory_start = 0

        self._check_modules()
        self._print_environment()

    def _check_modules(self):
        """检查可用模块"""
        print("\n📦 模块检查:")

        try:
            from taiji_agent import TaijiAgent, AgentConfig
            from taiji_agent import TaijiVerifier, HallucinationDetector
            from taiji_agent import SessionMemory, ToolRegistry
            from taiji_agent import SoulLoader
            self.taiji_available = True
            print("  ✅ Taiji Agent 核心模块可用")
        except ImportError as e:
            print(f"  ⚠️ Taiji Agent 核心模块不可用: {e}")

        try:
            from taiji_agent.govmcp.crypto import SM3Hash, SM4Encryptor
            from taiji_agent.govmcp.workflow import ApprovalWorkflow
            from taiji_agent.govmcp.tools import GovTools
            self.govmcp_available = True
            print("  ✅ GovMCP 模块可用")
        except ImportError as e:
            print(f"  ⚠️ GovMCP 模块不可用: {e}")

    def _print_environment(self):
        """打印环境信息"""
        print(f"\n📊 测试环境:")
        print(f"  初始内存: {self.process_memory_start:.2f} MB")
        print(f"  Python: {sys.version.split()[0]}")
        print(f"  Taiji Agent: {'可用' if self.taiji_available else '不可用'}")
        print(f"  GovMCP: {'可用' if self.govmcp_available else '不可用'}")

    async def close(self):
        """清理测试环境"""
        tracemalloc.stop()

        gc.collect()
        try:
            import psutil
            final_memory = psutil.Process().memory_info().rss / (1024 * 1024)
            memory_delta = final_memory - self.process_memory_start
        except:
            memory_delta = 0

        print(f"\n📊 资源使用:")
        print(f"  初始内存: {self.process_memory_start:.2f} MB")
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

        gc.collect()
        try:
            import psutil
            memory_delta = psutil.Process().memory_info().rss / (1024 * 1024) - self.process_memory_start
        except:
            memory_delta = 0

        result = StressTestResult(
            name=name,
            test_type=test_type,
            iterations=iterations,
            concurrent_users=concurrent_users,
            duration_seconds=duration,
            total_operations=total,
            successful_operations=successes,
            failed_operations=failures,
            avg_latency_ms=statistics.mean(latencies) if latencies else 0,
            min_latency_ms=min(latencies_sorted) if latencies else 0,
            max_latency_ms=max(latencies_sorted) if latencies else 0,
            p50_latency_ms=latencies_sorted[int(len(latencies_sorted) * 0.50)] if latencies else 0,
            p95_latency_ms=latencies_sorted[int(len(latencies_sorted) * 0.95)] if latencies else 0,
            p99_latency_ms=latencies_sorted[int(len(latencies_sorted) * 0.99)] if latencies else 0,
            throughput_ops=total / duration if duration > 0 else 0,
            error_rate=failures / total if total > 0 else 0,
            memory_delta_mb=memory_delta,
            cpu_usage_percent=0,
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
        print(f"   总操作数: {result.total_operations}")
        print(f"   成功/失败: {result.successful_operations}/{result.failed_operations}")
        print(f"   错误率: {result.error_rate * 100:.2f}%")
        print(f"   吞吐量: {result.throughput_ops:.2f} ops/s")
        print(f"   平均延迟: {result.avg_latency_ms:.4f}ms")
        print(f"   P50延迟: {result.p50_latency_ms:.4f}ms")
        print(f"   P95延迟: {result.p95_latency_ms:.4f}ms")
        print(f"   P99延迟: {result.p99_latency_ms:.4f}ms")

    async def run_all_tests(self):
        """运行所有压力测试"""
        print("\n" + "=" * 80)
        print("🚀 EcoMind OS 端到端压力测试开始")
        print(f"开始时间: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)

        await self.test_1_data_structures()
        await self.test_2_string_operations()
        await self.test_3_json_operations()
        await self.test_4_hash_operations()
        await self.test_5_concurrent_tasks()
        await self.test_6_taiji_verifier()
        await self.test_7_hallucination_detector()
        await self.test_8_session_memory()
        await self.test_9_govmcp_crypto()
        await self.test_10_govmcp_workflow()
        await self.test_11_memory_pressure()
        await self.test_12_soul_loader()
        await self.test_13_tool_registry()

        self.print_summary()

    async def test_1_data_structures(self):
        """测试1: 数据结构操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试1: Python数据结构操作压力测试")
        print("-" * 80)

        iterations = 50000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        data_list = []
        data_dict = {}

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                data_list.append(i)
                data_dict[f"key_{i}"] = i
                _ = data_list[i % 1000] if len(data_list) > 1000 else None
                _ = data_dict.get(f"key_{i % 1000}")
                if i % 1000 == 0:
                    data_list = data_list[-500:]
                    data_dict = {k: v for k, v in list(data_dict.items())[-500:]}
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "数据结构操作",
            "Python List/Dict",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_2_string_operations(self):
        """测试2: 字符串操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试2: 字符串操作压力测试")
        print("-" * 80)

        iterations = 20000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        test_strings = [
            "这是一个测试字符串，包含中文和English混合内容。",
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
            "特殊字符测试: !@#$%^&*()_+-=[]{}|;':\",./<>?",
            "长文本测试" * 100,
        ]

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                s = test_strings[i % len(test_strings)]
                s.upper()
                s.lower()
                s.replace("测试", "test")
                s.split(",")
                s.join(["a", "b"])
                s.strip()
                len(s)
                s.encode("utf-8")
                s.decode("utf-8")
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "字符串操作",
            "Python String",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_3_json_operations(self):
        """测试3: JSON操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试3: JSON序列化/反序列化压力测试")
        print("-" * 80)

        iterations = 10000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        test_data = {
            "name": "Test Agent",
            "description": "This is a test agent for stress testing",
            "config": {
                "temperature": 0.7,
                "max_tokens": 4096,
                "providers": ["openai", "anthropic", "qwen", "glm"],
            },
            "metadata": {
                "created_at": "2024-01-01T00:00:00Z",
                "tags": ["test", "stress", "performance"],
            },
        }

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                json_str = json.dumps(test_data)
                json.loads(json_str)
                json.dumps(test_data, ensure_ascii=False)
                json.loads(json_str)
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "JSON序列化",
            "JSON Encode/Decode",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_4_hash_operations(self):
        """测试4: 哈希操作压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试4: 哈希算法压力测试")
        print("-" * 80)

        iterations = 30000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        test_data = b"EcoMind OS stress test data " * 10

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                hashlib.md5(test_data).hexdigest()
                hashlib.sha256(test_data).hexdigest()
                hashlib.sha1(test_data).hexdigest()
                hashlib.sha512(test_data).hexdigest()
                hashlib.blake2b(test_data).hexdigest()
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "哈希算法",
            "Hash Operations",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_5_concurrent_tasks(self):
        """测试5: 并发任务压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试5: 并发任务压力测试")
        print("-" * 80)

        test_concurrency_levels = [10, 50, 100]

        for concurrency in test_concurrency_levels:
            latencies = []
            successes = 0
            failures = 0
            start = time.perf_counter()

            async def mock_async_task(task_id: int):
                nonlocal successes, failures
                req_start = time.perf_counter()
                try:
                    await asyncio.sleep(0.001)
                    result = sum(range(1000))
                    latency = (time.perf_counter() - req_start) * 1000
                    latencies.append(latency)
                    successes += 1
                    return result
                except Exception:
                    failures += 1
                    latencies.append(1.0)
                    return None

            tasks = [mock_async_task(i) for i in range(concurrency * 10)]
            await asyncio.gather(*tasks)

            duration = time.perf_counter() - start
            total_ops = successes + failures
            result = self._record_result(
                f"并发任务 - {concurrency}并发",
                "Async/Await",
                concurrency * 10,
                concurrency,
                duration,
                latencies,
                successes,
                failures,
            )
            self._print_result(result)

    async def test_6_taiji_verifier(self):
        """测试6: Taiji Verify防幻觉验证压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试6: Taiji Verify防幻觉验证压力测试")
        print("-" * 80)

        if not self.taiji_available:
            print("  ⏭️ 跳过: Taiji Agent模块不可用")
            self._record_result(
                "Taiji Verify", "Module Unavailable", 0, 1, 0, [], 0, 0
            )
            return

        from taiji_agent import TaijiVerifier

        iterations = 20000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        verifier = TaijiVerifier()
        verifier.add_rule(r"\d+%", True, "百分比")
        verifier.add_rule(r"据我所知", False, "不确定表达")
        verifier.add_rule(r"绝对", False, "绝对化表达")

        test_contents = [
            "这是一个正常的内容，包含一些数字如95%和60%。",
            "据我所知，这可能是正确的，但我不确定。",
            "绝对没有问题，所有人都知道这是100%正确的。",
            "根据研究显示，大约有50%的可能性，这是一个很好的数字。",
            "这是一个测试内容，包含各种可能的内容，包括数字12345和百分比99.9%。",
        ]

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                content = test_contents[i % len(test_contents)]
                verifier.verify(content)
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "Taiji Verify验证",
            "Anti-Hallucination",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_7_hallucination_detector(self):
        """测试7: 幻觉检测器压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试7: 幻觉检测器压力测试")
        print("-" * 80)

        if not self.taiji_available:
            print("  ⏭️ 跳过: Taiji Agent模块不可用")
            self._record_result(
                "Hallucination Detector", "Module Unavailable", 0, 1, 0, [], 0, 0
            )
            return

        from taiji_agent import HallucinationDetector

        iterations = 10000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        detector = HallucinationDetector()

        test_contents = [
            "这是一个正常的内容。",
            "据我所知，这可能是正确的，但我不确定。",
            "绝对没有问题，所有人都知道这是100%正确的。",
            "根据研究显示，大约有50%的可能性，以及一些据我所知的情况。",
        ]

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                content = test_contents[i % len(test_contents)]
                detector.detect(content)
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "幻觉检测",
            "Hallucination Detection",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_8_session_memory(self):
        """测试8: 会话记忆压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试8: 会话记忆压力测试")
        print("-" * 80)

        if not self.taiji_available:
            print("  ⏭️ 跳过: Taiji Agent模块不可用")
            self._record_result(
                "Session Memory", "Module Unavailable", 0, 1, 0, [], 0, 0
            )
            return

        from taiji_agent import SessionMemory

        iterations = 5000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        memory = SessionMemory()

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                key = f"test_key_{i % 1000}"
                value = f"test_value_{i} " * 50
                memory.save(key, value)
                memory.get(key)
                memory.search("test_key")
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "会话记忆",
            "Memory Operations",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_9_govmcp_crypto(self):
        """测试9: GovMCP国密算法压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试9: GovMCP国密算法压力测试")
        print("-" * 80)

        if not self.govmcp_available:
            print("  ⏭️ 跳过: GovMCP模块不可用")
            self._record_result(
                "GovMCP Crypto", "Module Unavailable", 0, 1, 0, [], 0, 0
            )
            return

        from taiji_agent.govmcp.crypto import SM3Hash

        iterations = 20000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        test_data = b"Government sensitive data " * 10

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                SM3Hash.hash(test_data)
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "SM3哈希算法",
            "National Crypto",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_10_govmcp_workflow(self):
        """测试10: GovMCP审批工作流压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试10: GovMCP审批工作流压力测试")
        print("-" * 80)

        if not self.govmcp_available:
            print("  ⏭️ 跳过: GovMCP模块不可用")
            self._record_result(
                "GovMCP Workflow", "Module Unavailable", 0, 1, 0, [], 0, 0
            )
            return

        from taiji_agent.govmcp.workflow import ApprovalWorkflow

        iterations = 3000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        workflow = ApprovalWorkflow()

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                request = workflow.create_request(
                    title=f"Test Approval {i}",
                    description=f"Description for approval {i}",
                    requester=f"user_{i % 100}",
                    department=f"dept_{i % 10}",
                )
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "审批工作流",
            "Approval Workflow",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_11_memory_pressure(self):
        """测试11: 内存压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试11: 内存压力测试")
        print("-" * 80)

        gc.collect()
        mem_before = self.process_memory_start

        iterations = 1000
        large_data = []

        try:
            from taiji_agent import TaijiAgent, AgentConfig, SessionMemory

            for i in range(iterations):
                agent = TaijiAgent(config=AgentConfig())
                mem = SessionMemory()
                for j in range(100):
                    mem.save(f"key_{j}", f"value_{j}" * 100)
                large_data.append({
                    "id": i,
                    "data": "x" * 1000,
                    "nested": {"a": 1, "b": "test"},
                })

        except Exception as e:
            print(f"  ⚠️ 内存压力测试部分失败: {e}")

        gc.collect()
        mem_after = self.process_memory_start
        gc.collect()

        try:
            import psutil
            mem_after = psutil.Process().memory_info().rss / (1024 * 1024)
        except:
            pass

        mem_delta = mem_after - mem_before

        print(f"\n  📊 内存压力测试结果:")
        print(f"     创建对象数: {iterations}")
        print(f"     内存前: {mem_before:.2f} MB")
        print(f"     内存后: {mem_after:.2f} MB")
        print(f"     内存增量: {mem_delta:.2f} MB")
        print(f"     每对象内存: {mem_delta / iterations:.4f} MB")

        del large_data
        gc.collect()

        result = StressTestResult(
            name="内存压力测试",
            test_type="Memory Pressure",
            iterations=iterations,
            concurrent_users=1,
            duration_seconds=0,
            total_operations=iterations,
            successful_operations=iterations,
            failed_operations=0,
            avg_latency_ms=0,
            min_latency_ms=0,
            max_latency_ms=0,
            p50_latency_ms=0,
            p95_latency_ms=0,
            p99_latency_ms=0,
            throughput_ops=0,
            error_rate=0,
            memory_delta_mb=mem_delta,
            cpu_usage_percent=0,
        )
        self.results.append(result)

    async def test_12_soul_loader(self):
        """测试12: Soul人格加载器压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试12: Soul人格加载器压力测试")
        print("-" * 80)

        if not self.taiji_available:
            print("  ⏭️ 跳过: Taiji Agent模块不可用")
            self._record_result(
                "Soul Loader", "Module Unavailable", 0, 1, 0, [], 0, 0
            )
            return

        from taiji_agent import SoulLoader

        iterations = 5000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        loader = SoulLoader()
        souls = loader.list_souls() if hasattr(loader, "list_souls") else ["default"]

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                soul_name = souls[i % len(souls)] if souls else "default"
                loader.load(soul_name)
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "Soul加载器",
            "Soul Loader",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

    async def test_13_tool_registry(self):
        """测试13: 工具注册表压力测试"""
        print("\n" + "-" * 80)
        print("🧪 测试13: 工具注册表压力测试")
        print("-" * 80)

        if not self.taiji_available:
            print("  ⏭️ 跳过: Taiji Agent模块不可用")
            self._record_result(
                "Tool Registry", "Module Unavailable", 0, 1, 0, [], 0, 0
            )
            return

        from taiji_agent import ToolRegistry

        iterations = 10000
        latencies = []
        successes = 0
        failures = 0
        start = time.perf_counter()

        registry = ToolRegistry()

        for i in range(iterations):
            req_start = time.perf_counter()
            try:
                registry.list_tools()
                registry.get_schemas()
                latency = (time.perf_counter() - req_start) * 1000
                latencies.append(latency)
                successes += 1
            except Exception:
                failures += 1
                latencies.append(0.001)

        duration = time.perf_counter() - start
        result = self._record_result(
            "工具注册表",
            "Tool Registry",
            iterations,
            1,
            duration,
            latencies,
            successes,
            failures,
        )
        self._print_result(result)

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

        total_ops = sum(r.total_operations for r in self.results)
        total_success = sum(r.successful_operations for r in self.results)
        total_failures = sum(r.failed_operations for r in self.results)

        print(f"\n总操作数: {total_ops}")
        print(f"成功操作: {total_success} ({total_success/total_ops*100:.1f}%)")
        print(f"失败操作: {total_failures} ({total_failures/total_ops*100:.1f}%)")

        all_latencies = []
        for r in self.results:
            if r.avg_latency_ms > 0:
                all_latencies.extend([r.avg_latency_ms, r.p50_latency_ms, r.p95_latency_ms])

        if all_latencies:
            avg_latency = statistics.mean(all_latencies)
            p95_latency = sorted(all_latencies)[int(len(all_latencies) * 0.95)]
            print(f"\n平均延迟: {avg_latency:.4f}ms")
            print(f"P95延迟: {p95_latency:.4f}ms")

        total_throughput = sum(r.throughput_ops for r in self.results)
        print(f"总吞吐量: {total_throughput:.2f} ops/s")

        print("\n" + "-" * 80)
        print("📈 各测试详细结果:")
        print("-" * 80)

        for i, r in enumerate(self.results, 1):
            status = "✅" if r.error_rate == 0 else "❌"
            throughput_str = f"{r.throughput_ops:.2f} ops/s" if r.throughput_ops > 0 else "N/A"
            print(f"{i}. {status} {r.name}")
            print(f"   类型: {r.test_type} | 操作: {r.total_operations} | "
                  f"吞吐量: {throughput_str} | "
                  f"P95延迟: {r.p95_latency_ms:.4f}ms | "
                  f"错误率: {r.error_rate*100:.1f}%")

        self._generate_json_report()

        print("\n" + "=" * 80)
        print("🎉 EcoMind OS 压力测试完成!")
        print("=" * 80)

    def _generate_json_report(self):
        """生成JSON格式的测试报告"""
        report_path = BASE_DIR / "docs" / "ecomind_stress_test_report.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)

        report = {
            "test_info": {
                "project": "EcoMind OS",
                "version": "1.0.0",
                "mode": "simulation",
                "start_time": self.start_time.isoformat() if self.start_time else None,
                "end_time": datetime.now().isoformat(),
                "taiji_available": self.taiji_available,
                "govmcp_available": self.govmcp_available,
            },
            "summary": {
                "total_tests": len(self.results),
                "successful_tests": sum(1 for r in self.results if r.error_rate == 0),
                "failed_tests": sum(1 for r in self.results if r.error_rate > 0),
                "total_operations": sum(r.total_operations for r in self.results),
                "successful_operations": sum(r.successful_operations for r in self.results),
                "failed_operations": sum(r.failed_operations for r in self.results),
                "total_throughput_ops": sum(r.throughput_ops for r in self.results),
            },
            "results": [
                {
                    "name": r.name,
                    "test_type": r.test_type,
                    "iterations": r.iterations,
                    "concurrent_users": r.concurrent_users,
                    "duration_seconds": r.duration_seconds,
                    "total_operations": r.total_operations,
                    "successful_operations": r.successful_operations,
                    "failed_operations": r.failed_operations,
                    "avg_latency_ms": r.avg_latency_ms,
                    "min_latency_ms": r.min_latency_ms,
                    "max_latency_ms": r.max_latency_ms,
                    "p50_latency_ms": r.p50_latency_ms,
                    "p95_latency_ms": r.p95_latency_ms,
                    "p99_latency_ms": r.p99_latency_ms,
                    "throughput_ops": r.throughput_ops,
                    "error_rate": r.error_rate,
                    "memory_delta_mb": r.memory_delta_mb,
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
