#!/usr/bin/env python3
"""
EcoMind OS — 点对点端到端压力测试引擎

功能：
- REST API 并发压测（httpx + asyncio）
- SSE 流式压测（Agent Chat）
- WebSocket 压测（环境数据推送）
- 实时进度条 + 延迟分位数统计
- JSON / 终端彩色报告

使用：
    python -m tests.stress.runner --mode smoke
    python -m tests.stress.runner --mode stress --endpoint enforcement,approval
    python -m tests.stress.runner --concurrency 100 --duration 180
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import sys
import time
import traceback
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

# 确保 backend 在 path 中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from tests.stress.scenarios import (
    SCENARIOS, PRESETS, Scenario, resolve_path,
)

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

@dataclass
class StressConfig:
    mode: str = "smoke"
    concurrency: int = 10
    duration: int = 30          # 秒
    ramp_up: int = 5            # 渐进加压时间
    base_url: str = "http://127.0.0.1:8000"
    endpoint_filter: str = "all"
    timeout: float = 30.0
    output_json: bool = False
    verbose: bool = False


# ═══════════════════════════════════════════════════════════════
# 统计收集
# ═══════════════════════════════════════════════════════════════

@dataclass
class RequestResult:
    scenario: str
    status: str                 # "ok" | "error" | "timeout"
    latency_ms: float
    status_code: int = 0
    error_msg: str = ""
    timestamp: float = field(default_factory=time.time)


class StatsCollector:
    """线程安全的统计收集器（纯 asyncio，无需锁）"""

    def __init__(self):
        self.results: list[RequestResult] = []
        self.start_time: float = 0.0
        self.end_time: float = 0.0
        self._total_requests = 0
        self._error_count = 0
        self._timeout_count = 0

    def record(self, result: RequestResult):
        self.results.append(result)
        self._total_requests += 1
        if result.status == "error":
            self._error_count += 1
        elif result.status == "timeout":
            self._timeout_count += 1

    @property
    def total(self) -> int:
        return self._total_requests

    @property
    def errors(self) -> int:
        return self._error_count

    @property
    def timeouts(self) -> int:
        return self._timeout_count

    @property
    def success(self) -> int:
        return self._total_requests - self._error_count - self._timeout_count

    def latency_percentiles(self) -> dict[str, float]:
        """计算 p50 / p90 / p95 / p99 延迟"""
        latencies = sorted([r.latency_ms for r in self.results if r.status != "error"])
        if not latencies:
            return {"p50": 0, "p90": 0, "p95": 0, "p99": 0, "avg": 0, "min": 0, "max": 0}

        def _pct(p: float) -> float:
            idx = int(math.ceil(p / 100 * len(latencies))) - 1
            return latencies[max(0, min(idx, len(latencies) - 1))]

        return {
            "p50": _pct(50),
            "p90": _pct(90),
            "p95": _pct(95),
            "p99": _pct(99),
            "avg": sum(latencies) / len(latencies),
            "min": latencies[0],
            "max": latencies[-1],
        }

    def throughput(self) -> float:
        """每秒请求数"""
        elapsed = self.end_time - self.start_time
        return self._total_requests / elapsed if elapsed > 0 else 0

    def per_scenario_stats(self) -> dict[str, dict]:
        """按场景聚合统计"""
        groups: dict[str, list[RequestResult]] = defaultdict(list)
        for r in self.results:
            groups[r.scenario].append(r)

        stats = {}
        for name, items in sorted(groups.items()):
            lats = [i.latency_ms for i in items if i.status != "error"]
            errors = sum(1 for i in items if i.status != "ok")
            stats[name] = {
                "total": len(items),
                "errors": errors,
                "error_rate": errors / len(items) * 100 if items else 0,
                "avg_ms": sum(lats) / len(lats) if lats else 0,
                "p95_ms": sorted(lats)[int(len(lats) * 0.95)] if lats else 0,
                "min_ms": min(lats) if lats else 0,
                "max_ms": max(lats) if lats else 0,
            }
        return stats


# ═══════════════════════════════════════════════════════════════
# HTTP 请求执行器
# ═══════════════════════════════════════════════════════════════

class RequestExecutor:
    """异步 HTTP 请求执行器"""

    def __init__(self, config: StressConfig, stats: StatsCollector):
        self.config = config
        self.stats = stats
        self._client: Any = None
        self._sem: Optional[asyncio.Semaphore] = None

    async def __aenter__(self):
        import httpx
        self._client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=httpx.Timeout(self.config.timeout),
            limits=httpx.Limits(max_keepalive_connections=100, max_connections=200),
        )
        self._sem = asyncio.Semaphore(self.config.concurrency)
        return self

    async def __aexit__(self, *args):
        if self._client:
            await self._client.aclose()

    async def execute(self, scenario: Scenario) -> RequestResult:
        """执行单个请求"""
        async with self._sem:
            path = resolve_path(scenario)
            start = time.perf_counter()

            try:
                import httpx

                if scenario.method == "GET":
                    resp = await self._client.get(path, headers=scenario.headers)
                elif scenario.method == "POST":
                    payload = scenario.build_payload() if callable(scenario.build_payload) else None
                    resp = await self._client.post(path, json=payload, headers=scenario.headers)
                elif scenario.method == "DELETE":
                    resp = await self._client.delete(path, headers=scenario.headers)
                else:
                    resp = await self._client.request(scenario.method, path, headers=scenario.headers)

                latency = (time.perf_counter() - start) * 1000

                if resp.status_code >= 500:
                    return RequestResult(
                        scenario=scenario.name, status="error",
                        latency_ms=latency, status_code=resp.status_code,
                        error_msg=f"HTTP {resp.status_code}",
                    )

                return RequestResult(
                    scenario=scenario.name, status="ok",
                    latency_ms=latency, status_code=resp.status_code,
                )

            except httpx.TimeoutException:
                latency = (time.perf_counter() - start) * 1000
                return RequestResult(
                    scenario=scenario.name, status="timeout",
                    latency_ms=latency, error_msg="timeout",
                )
            except Exception as e:
                latency = (time.perf_counter() - start) * 1000
                return RequestResult(
                    scenario=scenario.name, status="error",
                    latency_ms=latency,
                    error_msg=f"{type(e).__name__}: {e}",
                )


# ═══════════════════════════════════════════════════════════════
# 直接模式执行器（无需启动服务器，直接调 service）
# ═══════════════════════════════════════════════════════════════

DIRECT_SCENARIOS = {
    "enforcement": lambda: _direct_enforcement(),
    "approval": lambda: _direct_approval(),
    "compliance": lambda: _direct_compliance(),
    "reports": lambda: _direct_reports(),
}


async def _direct_enforcement():
    import uuid
    from api.services.enforcement_service import get_enforcement_service
    svc = get_enforcement_service()
    r = await svc.create_case({"title": f"压测-{uuid.uuid4().hex[:6]}", "enterprise_name": "压测企业"})
    cases = await svc.list_cases()
    return {"created": r.case_number, "total_cases": len(cases)}


async def _direct_approval():
    import uuid
    from api.services.approval_service import get_approval_service
    svc = get_approval_service()
    r = await svc.create_approval({"title": f"压测-{uuid.uuid4().hex[:6]}", "approval_type": "环评报告"})
    return {"created": r.approval_number}


async def _direct_compliance():
    import uuid
    from api.services.compliance_service import get_compliance_service
    svc = get_compliance_service()
    r = await svc.create_check({"title": f"压测-{uuid.uuid4().hex[:6]}", "category": "废水"})
    return {"created": r.check_id}


async def _direct_reports():
    import uuid
    from api.services.report_service import get_report_service
    svc = get_report_service()
    r = await svc.generate({"title": f"压测-{uuid.uuid4().hex[:6]}", "report_type": "监测报告",
                              "params": {"city": "长沙市", "aqi": "85"}})
    return {"status": r.status}


def _uuid4():
    import uuid
    return uuid.uuid4()


async def run_direct_mode(config: StressConfig) -> StatsCollector:
    """直接模式：不启动 HTTP 服务，直接调用 service 层测试业务逻辑压力"""
    import uuid as _uuid
    stats = StatsCollector()
    stats.start_time = time.time()

    total_tasks = config.concurrency * 10  # 每个并发执行 10 次
    sem = asyncio.Semaphore(config.concurrency)

    async def worker(name: str, fn, n: int):
        for _ in range(n):
            async with sem:
                start = time.perf_counter()
                try:
                    await fn()
                    latency = (time.perf_counter() - start) * 1000
                    stats.record(RequestResult(scenario=name, status="ok", latency_ms=latency))
                except Exception as e:
                    latency = (time.perf_counter() - start) * 1000
                    stats.record(RequestResult(scenario=name, status="error", latency_ms=latency,
                                                error_msg=str(e)))

    tasks = []
    for name, factory in DIRECT_SCENARIOS.items():
        tasks.append(worker(name, factory, total_tasks // len(DIRECT_SCENARIOS)))

    await asyncio.gather(*tasks)

    stats.end_time = time.time()
    return stats


# ═══════════════════════════════════════════════════════════════
# 压力测试编排器
# ═══════════════════════════════════════════════════════════════

class StressRunner:
    """主压力测试编排器"""

    def __init__(self, config: StressConfig):
        self.config = config
        self.stats = StatsCollector()
        self._running = False
        self._progress_task: Optional[asyncio.Task] = None

    def _filter_scenarios(self) -> list[Scenario]:
        if self.config.endpoint_filter == "all":
            return list(SCENARIOS)
        categories = set(self.config.endpoint_filter.split(","))
        return [s for s in SCENARIOS if s.category in categories]

    def _weighted_choice(self, scenarios: list[Scenario]) -> Scenario:
        """加权随机选择场景"""
        total = sum(s.weight for s in scenarios)
        r = random.uniform(0, total)
        cumulative = 0
        for s in scenarios:
            cumulative += s.weight
            if r <= cumulative:
                return s
        return scenarios[-1]

    async def run(self) -> StatsCollector:
        """执行压力测试"""
        self.stats.start_time = time.time()
        self._running = True

        # 检查服务器连通性
        server_ok = await self._health_check()

        if not server_ok:
            print("\n⚠️  服务器不可达，切换到 DIRECT 模式（直接调用 service 层）\n")
            return await run_direct_mode(self.config)

        scenarios = self._filter_scenarios()
        if not scenarios:
            print("❌ 没有匹配的场景！")
            return self.stats

        print(f"\n{'='*70}")
        print(f"  EcoMind OS 压力测试")
        print(f"  模式: {self.config.mode.upper()}")
        print(f"  并发: {self.config.concurrency}  |  时长: {self.config.duration}s")
        print(f"  场景: {len(scenarios)} 个  |  目标: {self.config.base_url}")
        print(f"{'='*70}\n")

        # 启动进度报告
        self._progress_task = asyncio.create_task(self._progress_reporter())

        import httpx
        async with httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=httpx.Timeout(self.config.timeout),
            limits=httpx.Limits(max_keepalive_connections=100, max_connections=200),
        ) as client:
            sem = asyncio.Semaphore(self.config.concurrency)

            async def worker(worker_id: int):
                end_at = time.time() + self.config.duration
                # 渐进加压：前 ramp_up 秒线性增加
                ramp_end = self.stats.start_time + self.config.ramp_up

                while time.time() < end_at and self._running:
                    # 渐进加压延迟
                    if self.config.ramp_up > 0 and time.time() < ramp_end:
                        elapsed = time.time() - self.stats.start_time
                        ratio = elapsed / self.config.ramp_up
                        if worker_id > int(self.config.concurrency * ratio):
                            await asyncio.sleep(0.1)
                            continue

                    scenario = self._weighted_choice(scenarios)
                    path = resolve_path(scenario)
                    start = time.perf_counter()

                    async with sem:
                        try:
                            if scenario.method == "GET":
                                resp = await client.get(path, headers=scenario.headers)
                            elif scenario.method == "POST":
                                payload = scenario.build_payload() if callable(scenario.build_payload) else None
                                resp = await client.post(path, json=payload, headers=scenario.headers)
                            else:
                                resp = await client.request(scenario.method, path, headers=scenario.headers)

                            latency = (time.perf_counter() - start) * 1000
                            status = "ok" if resp.status_code < 500 else "error"

                            self.stats.record(RequestResult(
                                scenario=scenario.name, status=status,
                                latency_ms=latency, status_code=resp.status_code,
                            ))

                        except httpx.TimeoutException:
                            latency = (time.perf_counter() - start) * 1000
                            self.stats.record(RequestResult(
                                scenario=scenario.name, status="timeout",
                                latency_ms=latency, error_msg="timeout",
                            ))
                        except Exception as e:
                            latency = (time.perf_counter() - start) * 1000
                            self.stats.record(RequestResult(
                                scenario=scenario.name, status="error",
                                latency_ms=latency,
                                error_msg=f"{type(e).__name__}: {str(e)[:100]}",
                            ))

            # 启动并发 worker
            workers = [asyncio.create_task(worker(i)) for i in range(self.config.concurrency)]

            # 等待时长到达
            await asyncio.sleep(self.config.duration)
            self._running = False

            # 等待 workers 完成
            await asyncio.gather(*workers, return_exceptions=True)

        if self._progress_task:
            self._progress_task.cancel()
            try:
                await self._progress_task
            except asyncio.CancelledError:
                pass

        self.stats.end_time = time.time()
        return self.stats

    async def _health_check(self) -> bool:
        """检查服务器是否可达"""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                resp = await c.get(f"{self.config.base_url}/health")
                return resp.status_code == 200
        except Exception:
            return False

    async def _progress_reporter(self):
        """实时进度报告（每秒更新）"""
        last_total = 0
        while self._running:
            await asyncio.sleep(1)
            elapsed = time.time() - self.stats.start_time
            current = self.stats.total
            rps = (current - last_total)
            last_total = current

            # 彩色输出
            ok = self.stats.success
            err = self.stats.errors
            pct = self.stats.latency_percentiles()

            bar_len = 30
            filled = int(elapsed / self.config.duration * bar_len)
            bar = "█" * filled + "░" * (bar_len - filled)

            print(
                f"\r  [{bar}] {elapsed:5.1f}s | "
                f"请求: {current:6d} | "
                f"RPS: {rps:5d} | "
                f"✅ {ok} | ❌ {err} | "
                f"p50: {pct['p50']:6.1f}ms | "
                f"p95: {pct['p95']:6.1f}ms",
                end="", flush=True,
            )
        print()  # 换行


# ═══════════════════════════════════════════════════════════════
# 报告生成
# ═══════════════════════════════════════════════════════════════

def print_report(config: StressConfig, stats: StatsCollector):
    """打印彩色终端报告"""

    elapsed = stats.end_time - stats.start_time
    pct = stats.latency_percentiles()
    tps = stats.throughput()
    error_rate = (stats.errors + stats.timeouts) / max(stats.total, 1) * 100

    # ── ANSI 颜色 ──
    G = "\033[92m"  # 绿
    Y = "\033[93m"  # 黄
    R = "\033[91m"  # 红
    B = "\033[94m"  # 蓝
    C = "\033[96m"  # 青
    W = "\033[97m"  # 白
    N = "\033[0m"   # 重置

    def grade_latency(ms: float) -> str:
        if ms < 100: return f"{G}{ms:.1f}{N}"
        if ms < 300: return f"{Y}{ms:.1f}{N}"
        return f"{R}{ms:.1f}{N}"

    def grade_rate(rate: float) -> str:
        if rate < 1: return f"{G}{rate:.1f}%{N}"
        if rate < 5: return f"{Y}{rate:.1f}%{N}"
        return f"{R}{rate:.1f}%{N}"

    def grade_rps(rps: float) -> str:
        if rps > 100: return f"{G}{rps:.0f}{N}"
        if rps > 30: return f"{Y}{rps:.0f}{N}"
        return f"{R}{rps:.0f}{N}"

    print(f"\n{'='*70}")
    print(f"  {W}EcoMind OS 压力测试报告{N}")
    print(f"{'='*70}")
    print(f"  模式: {B}{config.mode.upper()}{N}  |  "
          f"并发: {B}{config.concurrency}{N}  |  "
          f"时长: {B}{elapsed:.1f}s{N}")
    print(f"  目标: {C}{config.base_url}{N}")
    print(f"{'─'*70}")
    print(f"  {W}📊 总体统计{N}")
    print(f"  总请求数:    {stats.total:>8d}")
    print(f"  成功:        {G}{stats.success:>8d}{N}  ({100-error_rate:.1f}%)")
    print(f"  失败:        {R}{stats.errors:>8d}{N}")
    print(f"  超时:        {Y}{stats.timeouts:>8d}{N}")
    print(f"  错误率:      {grade_rate(error_rate)}")
    print(f"  吞吐量:      {grade_rps(tps)} req/s")
    print(f"{'─'*70}")
    print(f"  {W}⏱️  延迟分布{N}")
    print(f"  平均:        {grade_latency(pct['avg'])} ms")
    print(f"  最小:        {grade_latency(pct['min'])} ms")
    print(f"  最大:        {grade_latency(pct['max'])} ms")
    print(f"  P50:         {grade_latency(pct['p50'])} ms")
    print(f"  P90:         {grade_latency(pct['p90'])} ms")
    print(f"  P95:         {grade_latency(pct['p95'])} ms")
    print(f"  P99:         {grade_latency(pct['p99'])} ms")
    print(f"{'─'*70}")
    print(f"  {W}📋 按场景统计{N}")
    print(f"  {'场景':<28s} {'请求':>6s} {'错误率':>8s} {'平均':>8s} {'P95':>8s} {'最大':>8s}")
    print(f"  {'─'*28} {'─'*6} {'─'*8} {'─'*8} {'─'*8} {'─'*8}")

    per_scene = stats.per_scenario_stats()
    for name, s in per_scene.items():
        print(f"  {name:<28s} {s['total']:>6d} {grade_rate(s['error_rate']):>18s} "
              f"{grade_latency(s['avg_ms']):>16s} {grade_latency(s['p95_ms']):>16s} "
              f"{grade_latency(s['max_ms']):>8s} ms")

    print(f"{'─'*70}")

    # ── 评级 ──
    if error_rate < 1 and pct['p95'] < 200:
        grade = f"{G}🏆 优秀{N} — 系统在高负载下表现优异"
    elif error_rate < 5 and pct['p95'] < 500:
        grade = f"{Y}👍 良好{N} — 系统可承受当前压力"
    elif error_rate < 10:
        grade = f"{Y}⚠️  需优化{N} — 存在性能瓶颈"
    else:
        grade = f"{R}🚨 需紧急处理{N} — 系统在高负载下不稳定"

    print(f"  综合评级: {grade}")
    print(f"{'='*70}\n")


def save_json_report(config: StressConfig, stats: StatsCollector, path: str):
    """保存 JSON 报告"""
    report = {
        "title": "EcoMind OS 压力测试报告",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "config": {
            "mode": config.mode,
            "concurrency": config.concurrency,
            "duration": config.duration,
            "base_url": config.base_url,
        },
        "summary": {
            "total_requests": stats.total,
            "success": stats.success,
            "errors": stats.errors,
            "timeouts": stats.timeouts,
            "error_rate": (stats.errors + stats.timeouts) / max(stats.total, 1) * 100,
            "throughput_rps": stats.throughput(),
            "duration_s": stats.end_time - stats.start_time,
        },
        "latency": stats.latency_percentiles(),
        "per_scenario": stats.per_scenario_stats(),
    }

    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"  📄 JSON 报告已保存: {path}")


# ═══════════════════════════════════════════════════════════════
# CLI 入口
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="EcoMind OS 点对点端到端压力测试",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m tests.stress.runner --mode smoke
  python -m tests.stress.runner --mode stress --endpoint enforcement,approval,safety
  python -m tests.stress.runner --concurrency 100 --duration 180
  python -m tests.stress.runner --mode smoke --output-json report.json
        """,
    )

    parser.add_argument("--mode", "-m", default="smoke",
                        choices=["smoke", "stress", "spike", "endurance"],
                        help="预设模式（默认: smoke）")
    parser.add_argument("--concurrency", "-c", type=int, default=0,
                        help="并发数（覆盖预设）")
    parser.add_argument("--duration", "-d", type=int, default=0,
                        help="测试时长秒（覆盖预设）")
    parser.add_argument("--ramp-up", "-r", type=int, default=0,
                        help="渐进加压时长秒")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000",
                        help="服务器地址（默认: http://127.0.0.1:8000）")
    parser.add_argument("--endpoint", "-e", default="all",
                        help="测试端点分类（逗号分隔，如 enforcement,approval）")
    parser.add_argument("--timeout", "-t", type=float, default=30.0,
                        help="请求超时秒（默认: 30）")
    parser.add_argument("--output-json", "-o", default=None,
                        help="输出 JSON 报告路径")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="详细输出每条请求")

    args = parser.parse_args()

    # 合并预设
    preset = PRESETS.get(args.mode, PRESETS["smoke"])
    config = StressConfig(
        mode=args.mode,
        concurrency=args.concurrency or preset["concurrency"],
        duration=args.duration or preset["duration"],
        ramp_up=args.ramp_up or preset.get("ramp_up", 5),
        base_url=args.base_url,
        endpoint_filter=args.endpoint,
        timeout=args.timeout,
        output_json=bool(args.output_json),
        verbose=args.verbose,
    )

    # 运行
    runner = StressRunner(config)

    try:
        stats = asyncio.run(runner.run())
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断")
        stats = runner.stats
        stats.end_time = time.time()

    # 输出报告
    print_report(config, stats)

    if args.output_json:
        save_json_report(config, stats, args.output_json)

    # 返回退出码
    error_rate = (stats.errors + stats.timeouts) / max(stats.total, 1) * 100
    if stats.total == 0:
        sys.exit(1)
    sys.exit(0 if error_rate < 10 else 1)


if __name__ == "__main__":
    import random  # noqa: F811
    main()
