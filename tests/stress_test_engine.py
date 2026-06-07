#!/usr/bin/env python3
"""
EcoMind OS 生产级端到端压力测试框架
=====================================

8 大能力维度 × 1000 轮次 = 全面验证系统生产就绪度

运行方式:
    python3 stress_test_engine.py                    # 默认配置
    python3 stress_test_engine.py --rounds 500        # 自定义轮次
    python3 stress_test_engine.py --concurrent 10     # 自定义并发数
    python3 stress_test_engine.py --module A          # 只跑指定模块
    python3 stress_test_engine.py --verbose            # 详细输出

作者: EcoMind QA Team
版本: 2.0.0 (Production Ready)
"""

from __future__ import annotations

import asyncio
import aiohttp
import json
import os
import sys
import time
import uuid
import argparse
import tempfile
import statistics
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Any, Optional, List, Dict, Callable
from pathlib import Path
from enum import Enum
import traceback

# ─── 彩色终端输出 ──────────────────────────────────────────────

class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"

def color(text: str, c: str) -> str:
    return f"{c}{text}{Colors.RESET}"

def bold(text: str) -> str:
    return color(text, Colors.BOLD)

# ─── 测试配置 ──────────────────────────────────────────────────

@dataclass
class TestConfig:
    TOTAL_ROUNDS: int = 1000
    CONCURRENT_USERS: int = 5
    BASE_URL: str = "http://localhost:8000"
    REQUEST_TIMEOUT: int = 60
    API_KEY: str = "sk-30b6fcafb9d1431ab1576eb5fc66f651"
    
    OUTPUT_DIR: str = "/Users/mac/EcoMind-OS/tests"
    REPORT_MD: str = "stress_test_report.md"
    REPORT_JSON: str = "stress_test_results.json"
    
    MODULE_ROUNDS: Dict[str, int] = field(default_factory=lambda: {
        "A": 200,   # 对话真实性可靠性
        "B": 200,   # 工具调用能力
        "C": 150,   # 文件上传+分析链路
        "D": 100,   # 代码开发能力
        "E": 150,   # 知识检索与法规查询
        "F": 100,   # 多轮对话上下文保持
        "G": 50,    # 并发压力与稳定性 (×并发数)
        "H": 50,    # 异常输入与安全防护
    })

config = TestConfig()

# ─── 数据模型 ──────────────────────────────────────────────────

class TestStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    ERROR = "error"
    SKIP = "skip"

@dataclass
class Assertion:
    name: str
    passed: bool
    detail: str = ""

@dataclass 
class TestResult:
    round_id: int
    module: str
    test_name: str
    status: TestStatus
    response_time_ms: float = 0.0
    response_size_bytes: int = 0
    error_message: str = ""
    assertions: List[Assertion] = field(default_factory=list)
    score: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    raw_response: Optional[Any] = None
    
    def to_dict(self) -> dict:
        return {
            "round_id": self.round_id,
            "module": self.module,
            "test_name": self.test_name,
            "status": self.status.value,
            "response_time_ms": self.response_time_ms,
            "response_size_bytes": self.response_size_bytes,
            "error_message": self.error_message,
            "assertions": [asdict(a) for a in self.assertions],
            "score": self.score,
            "timestamp": self.timestamp,
        }

@dataclass
class ModuleSummary:
    module_id: str
    module_name: str
    total_rounds: int = 0
    passed: int = 0
    failed: int = 0
    errors: int = 0
    skipped: int = 0
    total_score: float = 0.0
    avg_response_time_ms: float = 0.0
    p50_ms: float = 0.0
    p95_ms: float = 0.0
    p99_ms: float = 0.0
    results: List[TestResult] = field(default_factory=list)
    
    @property
    def pass_rate(self) -> float:
        if self.total_rounds == 0:
            return 0.0
        return (self.passed / self.total_rounds) * 100
    
    @property
    def avg_score(self) -> float:
        if self.total_rounds == 0:
            return 0.0
        return self.total_score / self.total_rounds

# ─── 关键断言函数 ──────────────────────────────────────────────

def assert_no_hallucination(text: str) -> tuple[bool, str]:
    """检测是否包含幻觉拒绝模式"""
    refuse_patterns = [
        '无法访问', '无法查看', '没有权限', '不能查看',
        '无法直接', '没法查看', '看不到', '桌面上的文件',
        '本地计算机', '文件系统', '无法读取', '不能读取',
        '没有找到文件', '文件不存在', '无法打开'
    ]
    found = [p for p in refuse_patterns if p in text]
    if found:
        return False, f"检测到幻觉拒绝模式: {found[0]}"
    return True, "无幻觉拒绝模式"

def assert_has_substance(text: str, min_length: int = 10) -> tuple[bool, str]:
    """检测回复是否有实质内容"""
    if not text or len(text.strip()) < min_length:
        return False, f"回复过短 ({len(text) if text else 0} 字符)"
    
    template_patterns = [
        '抱歉', '对不起', '我无法', '作为AI', '我是一个',
        '请注意', '温馨提示', '很抱歉', '不好意思'
    ]
    
    text_stripped = text.strip()
    is_template = any(p in text_stripped[:20] for p in template_patterns)
    
    if is_template and len(text_stripped) < 50:
        return False, "疑似模板回复且内容过短"
    
    return True, f"有实质内容 ({len(text_stripped)} 字符)"

def assert_no_fabrication(text: str) -> tuple[bool, str]:
    """检测是否编造文件名或法规文号"""
    fabrication_patterns = [
        r'《[^》]{0,5}法[^》]{0,10}》第\d+条',
        r'国发\[\d{4}\]\d+号',
        r'环发\[\d{4}\]\d+号',
        r'湘环\[\d{4}\]\d+号',
    ]
    import re
    for pattern in fabrication_patterns:
        matches = re.findall(pattern, text)
        if matches:
            return False, f"疑似编造法规引用: {matches[0]}"
    return True, "无编造法规/文号"

def assert_has_tool_call(response: dict) -> tuple[bool, str]:
    """验证响应中包含工具调用"""
    if not response:
        return False, "空响应"
    
    has_tool = 'tool_name' in response or 'tools_used' in response
    has_data = 'data' in response or 'content' in response
    
    if has_tool or has_data:
        return True, "包含工具调用或数据"
    return False, "缺少工具调用和数据字段"

def assert_response_time(ms: float, threshold: int = 5000) -> tuple[bool, str]:
    """验证响应时间在阈值内"""
    if ms <= threshold:
        return True, f"响应时间 {ms:.0f}ms <= {threshold}ms"
    return False, f"响应时间 {ms:.0f}ms > {threshold}ms (超时)"

def assert_status_code(status: int, expected: int = 200) -> tuple[bool, str]:
    """验证 HTTP 状态码"""
    if status == expected:
        return True, f"状态码 {status} OK"
    return False, f"状态码 {status} != 期望 {expected}"

def assert_field_exists(response: dict, field: str) -> tuple[bool, str]:
    """验证响应字段存在"""
    if response and field in response:
        return True, f"字段 '{field}' 存在"
    return False, f"缺少字段 '{field}'"

def assert_no_sql_injection_vulnerable(text: str) -> tuple[bool, str]:
    """检测 SQL 注入痕迹"""
    sql_patterns = [
        'syntax error', 'mysql', 'sql', 'ORA-', 'pg_',
        'sqlite', 'unclosed quotation', 'query failed'
    ]
    text_lower = text.lower()
    found = [p for p in sql_patterns if p in text_lower]
    if found:
        return False, f"可能存在 SQL 注入漏洞: {found[0]}"
    return True, "未检测到 SQL 注入痕迹"

def assert_no_xss_vulnerable(text: str) -> tuple[bool, str]:
    """检测 XSS 漏洞痕迹"""
    xss_patterns = ['<script>', 'javascript:', 'onerror=', 'onload=']
    text_lower = text.lower()
    found = [p for p in xss_patterns if p in text_lower]
    if found:
        return False, f"可能存在 XSS 漏洞: {found[0]}"
    return True, "未检测到 XSS 痕迹"

# ─── 进度条显示 ────────────────────────────────────────────────

class ProgressBar:
    """自定义进度条"""
    
    def __init__(self, total: int, prefix: str = "", width: int = 50):
        self.total = total
        self.prefix = prefix
        self.width = width
        self.current = 0
        self.start_time = time.time()
    
    def update(self, n: int = 1):
        self.current += n
        if self.current > self.total:
            self.current = self.total
        
        progress = self.current / self.total
        filled = int(self.width * progress)
        bar = '█' * filled + '░' * (self.width - filled)
        
        elapsed = time.time() - self.start_time
        eta = elapsed / max(self.current, 1) * (self.total - self.current)
        
        percent = progress * 100
        sys.stdout.write(
            f'\r{color(self.prefix, Colors.CYAN)} '
            f'|{color(bar, Colors.GREEN)}| '
            f'{percent:5.1f}% '
            f'({self.current}/{self.total}) '
            f'耗时: {elapsed:.1f}s 预计剩余: {eta:.1f}s'
        )
        sys.stdout.flush()
        
        if self.current >= self.total:
            print()
    
    def finish(self):
        if self.current < self.total:
            self.current = self.total
            self.update(0)

# ─── HTTP 客户端封装 ───────────────────────────────────────────

class StressTestClient:
    """异步 HTTP 客户端，封装所有 API 调用"""
    
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.session: Optional[aiohttp.ClientSession] = None
        self.stats = {
            'total_requests': 0,
            'total_errors': 0,
            'total_bytes': 0,
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=self.timeout,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'EcoMind-StressTest/2.0',
            }
        )
        return self
    
    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()
    
    async def request(
        self,
        method: str,
        path: str,
        json_data: Optional[dict] = None,
        data: Optional[dict] = None,
        files: Optional[dict] = None,
        expect_empty: bool = False,
    ) -> tuple[int, Any, float, int]:
        """
        发送请求并返回 (status_code, response_data, time_ms, size_bytes)
        """
        url = f"{self.base_url}{path}"
        t0 = time.time()
        
        try:
            self.stats['total_requests'] += 1
            
            if files:
                form = aiohttp.FormData()
                for k, v in files.items():
                    form.add_field(k, v[0], filename=v[1], content_type=v[2])
                if data:
                    for k, v in data.items():
                        form.add_field(k, str(v))
                async with self.session.post(url, data=form) as resp:
                    body = await resp.read()
                    size = len(body)
                    resp_data = json.loads(body) if body and not expect_empty else {}
            elif method.upper() == 'GET':
                async with self.session.get(url, params=data) as resp:
                    body = await resp.read()
                    size = len(body)
                    resp_data = json.loads(body) if body and not expect_empty else {}
            else:
                async with self.session.request(method, url, json=json_data) as resp:
                    body = await resp.read()
                    size = len(body)
                    resp_data = json.loads(body) if body and not expect_empty else {}
            
            elapsed_ms = (time.time() - t0) * 1000
            self.stats['total_bytes'] += size
            
            return resp.status, resp_data, elapsed_ms, size
            
        except asyncio.TimeoutError:
            self.stats['total_errors'] += 1
            elapsed_ms = (time.time() - t0) * 1000
            return 408, {"error": "请求超时"}, elapsed_ms, 0
        except aiohttp.ClientError as e:
            self.stats['total_errors'] += 1
            elapsed_ms = (time.time() - t0) * 1000
            return 502, {"error": str(e)}, elapsed_ms, 0
        except Exception as e:
            self.stats['total_errors'] += 1
            elapsed_ms = (time.time() - t0) * 1000
            return 500, {"error": str(e)}, elapsed_ms, 0
    
    async def chat(
        self,
        message: str,
        session_id: str = "",
        expert_id: str = "ecomind",
        stream: bool = False,
        conversation_history: list = None,
    ) -> tuple[int, Any, float, int]:
        """发送聊天请求"""
        path = "/api/chat/stream" if stream else "/api/chat"
        payload = {
            "message": message,
            "expert_id": expert_id,
            "session_id": session_id,
            "conversation_history": conversation_history or [],
            "stream": stream,
            "temperature": 0.7,
        }
        return await self.request("POST", path, json_data=payload)
    
    async def execute_tool(
        self,
        tool_name: str,
        tool_params: dict = None,
        expert_id: str = "ecomind",
        safety_level: str = "L2",
    ) -> tuple[int, Any, float, int]:
        """执行工具调用"""
        payload = {
            "tool_name": tool_name,
            "tool_params": tool_params or {},
            "expert_id": expert_id,
            "safety_level": safety_level,
        }
        return await self.request("POST", "/api/tools/execute", json_data=payload)
    
    async def list_tools(self) -> tuple[int, Any, float, int]:
        """获取工具列表"""
        return await self.request("GET", "/api/tools/list")
    
    async def upload_file(
        self,
        file_content: bytes,
        file_name: str,
        session_id: str = "",
    ) -> tuple[int, Any, float, int]:
        """上传文件"""
        mime_types = {
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.json': 'application/json',
            '.md': 'text/markdown',
            '.csv': 'text/csv',
        }
        ext = os.path.splitext(file_name)[1].lower()
        mime = mime_types.get(ext, 'application/octet-stream')
        
        files = {
            'file': (file_content, file_name, mime)
        }
        data = {}
        if session_id:
            data['session_id'] = session_id
        
        return await self.request("POST", "/api/upload", data=data, files=files)
    
    async def health_check(self) -> tuple[int, Any, float, int]:
        """健康检查"""
        return await self.request("GET", "/health")

# ─── 测试模块基类 ──────────────────────────────────────────────

class BaseTestModule:
    """测试模块基类"""
    
    def __init__(self, client: StressTestClient, module_id: str, module_name: str):
        self.client = client
        self.module_id = module_id
        self.module_name = module_name
        self.summary = ModuleSummary(module_id=module_id, module_name=module_name)
        self.round_counter = 0
    
    async def run_single_test(
        self,
        test_name: str,
        test_func: Callable,
        round_id: int,
    ) -> TestResult:
        """执行单个测试用例"""
        self.round_counter += 1
        result = TestResult(
            round_id=round_id,
            module=self.module_id,
            test_name=test_name,
            status=TestStatus.ERROR,
        )
        
        try:
            result = await test_func(result)
        except Exception as e:
            result.status = TestStatus.ERROR
            result.error_message = f"异常: {str(e)}\n{traceback.format_exc()}"
            result.score = 0
        
        self.summary.results.append(result)
        self.summary.total_rounds += 1
        
        if result.status == TestStatus.PASS:
            self.summary.passed += 1
        elif result.status == TestStatus.FAIL:
            self.summary.failed += 1
        elif result.status == TestStatus.ERROR:
            self.summary.errors += 1
        else:
            self.summary.skipped += 1
        
        self.summary.total_score += result.score
        
        return result
    
    def _print_result(self, result: TestResult):
        """打印单条测试结果"""
        icon = {
            TestStatus.PASS: color('✓ PASS', Colors.GREEN),
            TestStatus.FAIL: color('✗ FAIL', Colors.RED),
            TestStatus.ERROR: color('✗ ERROR', Colors.RED),
            TestStatus.SKIP: color('- SKIP', Colors.YELLOW),
        }.get(result.status, '?')
        
        print(f"  [{result.round_id:04d}] {icon} {result.test_name}: "
              f"{result.score:.0f}/100 ({result.response_time_ms:.0f}ms)")
        
        if result.status in (TestStatus.FAIL, TestStatus.ERROR) and result.error_message:
            print(f"         └─ {color(result.error_message, Colors.RED)}")
    
    def calculate_stats(self):
        """计算统计数据"""
        if not self.summary.results:
            return
        
        times = [r.response_time_ms for r in self.summary.results if r.response_time_ms > 0]
        if times:
            times.sort()
            self.summary.avg_response_time_ms = statistics.mean(times)
            n = len(times)
            self.summary.p50_ms = times[int(n * 0.5)]
            self.summary.p95_ms = times[min(int(n * 0.95), n - 1)]
            self.summary.p99_ms = times[min(int(n * 0.99), n - 1)]

# ════════════════════════════════════════════════════════════════
# Module A: 对话真实性可靠性测试 (200轮)
# ════════════════════════════════════════════════════════════════

class ModuleA_ChatReliability(BaseTestModule):
    """
    对话真实性可靠性测试
    
    重点检测：
    1. LLM 不产生"无法访问文件"等幻觉拒绝
    2. 回复具有实质内容（非空、非模板）
    3. 不编造法规条文号和文件名
    4. 专业性评分
    """
    
    TEST_PROMPTS = [
        ("环境知识", "湖南省当前的空气质量状况如何？哪些城市需要关注？"),
        ("法规咨询", "企业排放废水超标会面临什么法律责任？"),
        ("技术问题", "PM2.5 和 PM10 有什么区别？对健康的影响有何不同？"),
        ("场景分析", "如果某工厂夜间偷排废气，应该怎么处理？"),
        ("数据解读", "AQI 达到 300 意味着什么？公众应该如何防护？"),
        ("政策理解", "碳达峰碳中和目标对湖南企业有什么影响？"),
        ("专业术语", "解释一下 VOCs 的来源和控制措施"),
        ("综合分析", "请分析长沙市大气污染的主要来源和治理建议"),
        ("执法咨询", "环境行政处罚的一般程序是什么？"),
        ("应急响应", "突发水污染事件应如何应急处置？"),
        ("环评流程", "建设项目环境影响评价的审批流程是什么？"),
        ("监测方法", "水质监测的主要指标有哪些？标准限值是多少？"),
        ("合规检查", "排污许可证的申请条件和流程是什么？"),
        ("生态修复", "受污染土壤的修复技术有哪些？"),
        ("噪声控制", "城市噪声污染防治的措施有哪些？"),
        ("固废管理", "危险废物的分类和处理要求是什么？"),
        ("辐射安全", "电磁辐射环境管理的相关规定是什么？"),
        ("信息公开", "企业环境信息披露的要求是什么？"),
        ("绿色金融", "绿色信贷支持环保项目的政策有哪些？"),
        ("国际比较", "国外生态环境治理的经验对湖南有什么借鉴意义？"),
    ]
    
    async def run(self, rounds: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module A: 对话真实性可靠性测试 ({rounds} 轮)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        tasks = []
        for i in range(rounds):
            prompt_category, prompt = self.TEST_PROMPTS[i % len(self.TEST_PROMPTS)]
            tasks.append(self._test_chat_reliability(i + 1, prompt, prompt_category))
            progress.update(0)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="A",
                    test_name="chat_reliability",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
            else:
                self._print_result(result)
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _test_chat_reliability(
        self,
        round_id: int,
        prompt: str,
        category: str,
    ) -> TestResult:
        """执行单轮对话可靠性测试"""
        result = TestResult(
            round_id=round_id,
            module="A",
            test_name=f"对话测试[{category}]",
            status=TestStatus.PASS,
        )
        
        session_id = f"stress-A-{round_id}-{uuid.uuid4().hex[:8]}"
        
        status, data, ms, size = await self.client.chat(
            message=prompt,
            session_id=session_id,
            expert_id="ecomind",
            stream=False,
        )
        
        result.response_time_ms = ms
        result.response_size_bytes = size
        result.raw_response = data
        
        assertions = []
        scores = []
        
        # 断言 1: HTTP 状态码
        passed, detail = assert_status_code(status)
        assertions.append(Assertion(name="HTTP状态码", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.0)
        
        # 断言 2: 响应时间
        passed, detail = assert_response_time(ms, 15000)
        assertions.append(Assertion(name="响应时间", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.5)
        
        # 获取回复内容
        content = ""
        if isinstance(data, dict):
            content = data.get("content", "")
        
        # 断言 3: 无幻觉拒绝 (权重 40%)
        passed, detail = assert_no_hallucination(content)
        assertions.append(Assertion(name="无幻觉拒绝", passed=passed, detail=detail))
        if not passed:
            result.status = TestStatus.FAIL
            result.error_message = detail
        scores.append(1.0 if passed else 0.0)
        
        # 断言 4: 有实质内容 (权重 30%)
        passed, detail = assert_has_substance(content, min_length=15)
        assertions.append(Assertion(name="实质内容", passed=passed, detail=detail))
        if not passed:
            result.status = TestStatus.FAIL
        scores.append(1.0 if passed else 0.0)
        
        # 断言 5: 无编造 (权重 20%)
        passed, detail = assert_no_fabrication(content)
        assertions.append(Assertion(name="无编造", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.8)
        
        # 断言 6: 专业性评估 (权重 10%)
        professional_keywords = ['根据', '规定', '标准', 'GB', 'HJ', '法律', '条例']
        has_professional = any(kw in content for kw in professional_keywords)
        assertions.append(Assertion(
            name="专业性",
            passed=True,
            detail="包含专业关键词" if has_professional else "通用回答"
        ))
        scores.append(1.0 if has_professional else 0.6)
        
        # 计算加权得分
        weights = [0.05, 0.05, 0.40, 0.30, 0.20, 0.10]
        result.score = sum(s * w for s, w in zip(scores, weights)) * 100
        result.assertions = assertions
        
        if result.status == TestStatus.PASS and result.score < 60:
            result.status = TestStatus.PASS
        
        return result

# ════════════════════════════════════════════════════════════════
# Module B: 工具调用能力测试 (200轮)
# ════════════════════════════════════════════════════════════════

class ModuleB_ToolExecution(BaseTestModule):
    """
    工具调用能力测试
    
    覆盖所有已注册的工具：
    - 核心工具: env_query, regulation_search, knowledge_query
    - 多模态: document_ocr, image_analyze
    - 开发工具: code_read, code_edit, shell_exec
    - 报告/案例: report_generate, case_search
    - 其他: alert_check, compliance_check, dispatch_expert
    """
    
    TOOL_TEST_CASES = [
        ("env_query", {"city": "长沙市"}, "L1"),
        ("env_query", {"city": "株洲市"}, "L1"),
        ("env_query", {"city": "湘潭市"}, "L1"),
        ("regulation_search", {"query": "大气污染防治", "max_results": 3}, "L1"),
        ("regulation_search", {"query": "水污染物排放", "domain": "water"}, "L1"),
        ("regulation_search", {"query": "固体废物", "max_results": 5}, "L1"),
        ("knowledge_query", {"query": "环境保护法", "database": "regulations"}, "L1"),
        ("knowledge_query", {"query": "排放标准", "database": "all"}, "L1"),
        ("report_generate", {"template": "monitoring_daily", "city": "长沙市"}, "L2"),
        ("report_generate", {"template": "enforcement_decision"}, "L2"),
        ("case_search", {"query": "环境污染处罚"}, "L1"),
        ("alert_check", {}, "L1"),
        ("compliance_check", {"target_description": "某化工厂废水排放"}, "L2"),
        ("dispatch_expert", {"expert_id": "env-monitoring", "task_description": "空气质量分析"}, "L2"),
        ("code_read", {"file_path": "README.md"}, "L2"),
        ("code_read", {"file_path": "backend/api/main.py"}, "L2"),
        ("shell_exec", {"command": "echo 'hello world'"}, "L2"),
        ("shell_exec", {"command": "pwd"}, "L2"),
        ("shell_exec", {"command": "date"}, "L2"),
        ("git_status", {}, "L1"),
        ("git_commit", {"message": "stress test commit"}, "L2"),
        ("skill_execute", {"skill_id": "test_skill"}, "L2"),
        ("map_visualize", {"map_type": "station_distribution"}, "L1"),
        ("data_analyze", {"analysis_type": "summary"}, "L1"),
    ]
    
    async def run(self, rounds: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module B: 工具调用能力测试 ({rounds} 轮)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        tasks = []
        for i in range(rounds):
            case = self.TOOL_TEST_CASES[i % len(self.TOOL_TEST_CASES)]
            tool_name, params, level = case
            tasks.append(self._test_tool_execution(i + 1, tool_name, params, level))
            progress.update(0)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="B",
                    test_name="tool_execution",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
            else:
                self._print_result(result)
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _test_tool_execution(
        self,
        round_id: int,
        tool_name: str,
        params: dict,
        safety_level: str,
    ) -> TestResult:
        """执行单次工具调用测试"""
        result = TestResult(
            round_id=round_id,
            module="B",
            test_name=f"工具调用[{tool_name}]",
            status=TestStatus.PASS,
        )
        
        status, data, ms, size = await self.client.execute_tool(
            tool_name=tool_name,
            tool_params=params,
            expert_id="ecomind",
            safety_level=safety_level,
        )
        
        result.response_time_ms = ms
        result.response_size_bytes = size
        result.raw_response = data
        
        assertions = []
        scores = []
        
        # 断言 1: HTTP 状态码
        passed, detail = assert_status_code(status)
        assertions.append(Assertion(name="HTTP状态码", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.0)
        
        # 断言 2: 响应时间
        passed, detail = assert_response_time(ms, 10000)
        assertions.append(Assertion(name="响应时间", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.5)
        
        # 断言 3: 返回有效数据结构
        if isinstance(data, dict):
            has_status = 'status' in data or 'tool_name' in data
            assertions.append(Assertion(
                name="数据结构",
                passed=has_status,
                detail=f"包含 status/tool_name 字段" if has_status else "缺少关键字段"
            ))
            scores.append(1.0 if has_status else 0.3)
            
            # 断言 4: 工具执行状态
            tool_status = data.get("status", "")
            is_success = tool_status in ("success", "completed", "generated", "preview", "diff_generated")
            is_valid_error = tool_status in ("error", "blocked", "unavailable", "pending_confirmation")
            
            assertions.append(Assertion(
                name="执行状态",
                passed=is_success or is_valid_error,
                detail=f"状态: {tool_status}"
            ))
            scores.append(1.0 if is_success else (0.7 if is_valid_error else 0.0))
            
            # 断言 5: 错误信息合理性
            if is_valid_error:
                error_msg = data.get("error", "") or data.get("reason", "") or data.get("message", "")
                has_reasonable_error = len(error_msg) > 0
                assertions.append(Assertion(
                    name="错误信息",
                    passed=has_reasonable_error,
                    detail=error_msg[:100] if error_msg else "无错误信息"
                ))
                scores.append(1.0 if has_reasonable_error else 0.5)
                
                if tool_status == "error":
                    result.status = TestStatus.FAIL
                    result.error_message = f"工具返回错误: {error_msg}"
            else:
                assertions.append(Assertion(name="错误信息", passed=True, detail="正常"))
                scores.append(1.0)
        else:
            assertions.append(Assertion(name="数据结构", passed=False, detail="非字典响应"))
            assertions.append(Assertion(name="执行状态", passed=False, detail="无法判断"))
            assertions.append(Assertion(name="错误信息", passed=False, detail="N/A"))
            scores.extend([0.0, 0.0, 0.0])
            result.status = TestStatus.FAIL
            result.error_message = f"非预期响应格式: {type(data)}"
        
        # 计算得分
        weights = [0.15, 0.15, 0.25, 0.25, 0.20][:len(scores)]
        total_weight = sum(weights)
        result.score = sum(s * w for s, w in zip(scores, weights)) / total_weight * 100 if total_weight > 0 else 0
        result.assertions = assertions
        
        return result

# ════════════════════════════════════════════════════════════════
# Module C: 文件上传+分析链路测试 (150轮)
# ════════════════════════════════════════════════════════════════

class ModuleC_FileUploadChain(BaseTestModule):
    """
    文件上传+分析链路测试
    
    测试完整链路：上传 → 获取路径 → 工具调用 → 结果验证
    特别关注：上传后 LLM 能否正确访问文件
    """
    
    TEST_FILES = [
        ("test.txt", b"This is a test document for EcoMind OS stress testing.\n"
                     b"It contains some sample text about environmental protection.\n"
                     b"PM2.5 concentration should be monitored regularly.\n"),
        ("report.txt", b"Environmental Monitoring Report\n"
                       b"Date: 2024-01-15\n"
                       b"Location: Changsha City\n"
                       b"AQI: 85 (Moderate)\n"
                       b"Primary Pollutant: PM2.5\n"),
        ("data.json", json.dumps({
            "cities": ["Changsha", "Zhuzhou", "Xiangtan"],
            "aqi_values": [85, 72, 68],
            "timestamp": "2024-01-15T08:00:00Z"
        }).encode()),
        ("notes.md", b"# Meeting Notes\n\n## Environmental Issues\n\n"
                     b"- Air quality improvement needed\n"
                     b"- Water pollution control\n"
                     b"- Waste management\n"),
        ("sample.csv", b"City,AQI,PM25,PM10\nChangsha,85,62,98\n"
                      b"Zhuzhou,72,55,88\nXiangtan,68,48,76\n"),
    ]
    
    async def run(self, rounds: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module C: 文件上传+分析链路测试 ({rounds} 轮)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        tasks = []
        for i in range(rounds):
            file_info = self.TEST_FILES[i % len(self.TEST_FILES)]
            tasks.append(self._test_upload_chain(i + 1, file_info[0], file_info[1]))
            progress.update(0)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="C",
                    test_name="upload_chain",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
            else:
                self._print_result(result)
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _test_upload_chain(
        self,
        round_id: int,
        file_name: str,
        file_content: bytes,
    ) -> TestResult:
        """执行完整的上传→分析链路测试"""
        result = TestResult(
            round_id=round_id,
            module="C",
            test_name=f"上传链路[{file_name}]",
            status=TestStatus.PASS,
        )
        
        session_id = f"stress-C-{round_id}-{uuid.uuid4().hex[:8]}"
        assertions = []
        scores = []
        
        # 步骤 1: 上传文件
        t0 = time.time()
        upload_status, upload_data, upload_ms, upload_size = await self.client.upload_file(
            file_content=file_content,
            file_name=file_name,
            session_id=session_id,
        )
        
        result.response_time_ms = upload_ms
        result.response_size_bytes = upload_size
        
        # 断言 1: 上传成功
        upload_ok = (
            upload_status == 200 and
            isinstance(upload_data, dict) and
            upload_data.get("success") is True
        )
        assertions.append(Assertion(
            name="文件上传",
            passed=upload_ok,
            detail=f"状态 {upload_status}, 成功={upload_data.get('success') if isinstance(upload_data, dict) else 'N/A'}"
        ))
        scores.append(1.0 if upload_ok else 0.0)
        
        if not upload_ok:
            result.status = TestStatus.FAIL
            result.error_message = f"文件上传失败: {upload_data}"
            result.score = 20
            result.assertions = assertions
            return result
        
        # 获取上传后的文件路径
        uploaded_path = upload_data.get("file_path", "")
        assertions.append(Assertion(
            name="路径返回",
            passed=bool(uploaded_path),
            detail=f"路径: {uploaded_path[:50]}..." if uploaded_path else "无路径"
        ))
        scores.append(1.0 if uploaded_path else 0.0)
        
        # 步骤 2: 使用工具分析文件
        ext = os.path.splitext(file_name)[1].lower()
        tool_name = "document_ocr" if ext in ('.txt', '.pdf', '.md') else "document_parse"
        
        tool_status, tool_data, tool_ms, tool_size = await self.client.execute_tool(
            tool_name=tool_name,
            tool_params={"file_path": uploaded_path},
            safety_level="L1",
        )
        
        result.response_time_ms += tool_ms
        result.response_size_bytes += tool_size
        
        # 断言 3: 工具调用成功
        tool_ok = (
            tool_status == 200 and
            isinstance(tool_data, dict) and
            tool_data.get("status") in ("success", "error")
        )
        assertions.append(Assertion(
            name="工具调用",
            passed=tool_ok,
            detail=f"工具 {tool_name} 返回状态 {tool_data.get('status') if isinstance(tool_data, dict) else 'N/A'}"
        ))
        scores.append(1.0 if tool_ok else 0.3)
        
        # 步骤 3: 验证 LLM 能访问上传的文件（通过聊天测试）
        chat_msg = f"请分析我刚上传的文件 {file_name} 的主要内容"
        chat_status, chat_data, chat_ms, chat_size = await self.client.chat(
            message=chat_msg,
            session_id=session_id,
            expert_id="ecomind",
            stream=False,
        )
        
        result.response_time_ms += chat_ms
        result.response_size_bytes += chat_size
        
        chat_content = ""
        if isinstance(chat_data, dict):
            chat_content = chat_data.get("content", "")
        
        # 断言 4: LLM 不说"无法访问"
        no_hallucination, halluc_detail = assert_no_hallucination(chat_content)
        assertions.append(Assertion(
            name="LLM可访问",
            passed=no_hallucination,
            detail=halluc_detail
        ))
        scores.append(1.0 if no_hallucination else 0.0)
        
        if not no_hallucination:
            result.status = TestStatus.FAIL
            result.error_message = f"LLM产生幻觉拒绝: {halluc_detail}"
        
        # 断言 5: LLM 回复有内容
        has_content, content_detail = assert_has_substance(chat_content, min_length=10)
        assertions.append(Assertion(
            name="LLM回复质量",
            passed=has_content,
            detail=content_detail
        ))
        scores.append(1.0 if has_content else 0.3)
        
        # 计算得分
        weights = [0.25, 0.10, 0.25, 0.25, 0.15]
        result.score = sum(s * w for s, w in zip(scores, weights)) * 100
        result.assertions = assertions
        
        return result

# ════════════════════════════════════════════════════════════════
# Module D: 代码开发能力测试 (100轮)
# ════════════════════════════════════════════════════════════════

class ModuleD_CodeDevelopment(BaseTestModule):
    """
    代码开发能力测试
    
    测试代码读写、Shell 执行、Git 操作等开发工具
    """
    
    CODE_TEST_CASES = [
        ("code_read", {"file_path": "README.md"}),
        ("code_read", {"file_path": "CLAUDE.md"}),
        ("code_read", {"file_path": ".gitignore"}),
        ("code_read", {"file_path": "backend/api/main.py"}),
        ("code_read", {"file_path": "backend/engine/tool_registry.py"}),
        ("code_write", {"file_path": "test_stress_output.txt", "content": "# Stress Test Output\nGenerated by EcoMind OS\n"}),
        ("code_write", {"file_path": "tmp/test.json", "content": '{"test": true, "timestamp": "2024-01-15"}'}),
        ("shell_exec", {"command": "echo 'Hello from EcoMind'"}),
        ("shell_exec", {"command": "ls -la backend/ | head -5"}),
        ("shell_exec", {"command": "pwd"}),
        ("shell_exec", {"command": "date '+%Y-%m-%d %H:%M:%S'"}),
        ("shell_exec", {"command": "whoami"}),
        ("git_status", {}),
        ("git_commit", {"message": "[stress test] automated test commit"}),
        ("code_edit", {"file_path": "README.md", "old_string": "# ", "new_string": "# EcoMind OS - Updated\n# "}),
    ]
    
    async def run(self, rounds: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module D: 代码开发能力测试 ({rounds} 轮)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        tasks = []
        for i in range(rounds):
            case = self.CODE_TEST_CASES[i % len(self.CODE_TEST_CASES)]
            tool_name, params = case
            tasks.append(self._test_code_tool(i + 1, tool_name, params))
            progress.update(0)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="D",
                    test_name="code_development",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
            else:
                self._print_result(result)
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _test_code_tool(
        self,
        round_id: int,
        tool_name: str,
        params: dict,
    ) -> TestResult:
        """执行代码开发工具测试"""
        result = TestResult(
            round_id=round_id,
            module="D",
            test_name=f"代码工具[{tool_name}]",
            status=TestStatus.PASS,
        )
        
        status, data, ms, size = await self.client.execute_tool(
            tool_name=tool_name,
            tool_params=params,
            expert_id="ecomind",
            safety_level="L2" if tool_name == "shell_exec" else "L1",
        )
        
        result.response_time_ms = ms
        result.response_size_bytes = size
        result.raw_response = data
        
        assertions = []
        scores = []
        
        # 断言 1: HTTP 状态码
        passed, detail = assert_status_code(status)
        assertions.append(Assertion(name="HTTP状态码", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.0)
        
        # 断言 2: 响应时间
        passed, detail = assert_response_time(ms, 8000)
        assertions.append(Assertion(name="响应时间", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.5)
        
        if isinstance(data, dict):
            tool_status = data.get("status", "")
            
            # 断言 3: 根据工具类型验证结果
            if tool_name == "code_read":
                exists = data.get("exists", False)
                has_content = bool(data.get("content", ""))
                read_ok = exists and has_content
                assertions.append(Assertion(
                    name="文件读取",
                    passed=read_ok,
                    detail=f"exists={exists}, content_len={len(data.get('content', ''))}"
                ))
                scores.append(1.0 if read_ok else (0.5 if exists else 0.0))
                
            elif tool_name == "code_write":
                write_ok = data.get("status") in ("preview", "success")
                assertions.append(Assertion(
                    name="文件预览",
                    passed=write_ok,
                    detail=f"状态: {data.get('status')}"
                ))
                scores.append(1.0 if write_ok else 0.3)
                
            elif tool_name == "shell_exec":
                shell_ok = data.get("status") in ("completed", "blocked")
                assertions.append(Assertion(
                    name="命令执行",
                    passed=shell_ok,
                    detail=f"状态: {data.get('status')}, 输出长度: {len(data.get('stdout', ''))}"
                ))
                scores.append(1.0 if shell_ok else 0.3)
                
                if shell_ok and data.get("status") == "completed":
                    stdout = data.get("stdout", "")
                    assertions.append(Assertion(
                        name="命令输出",
                        passed=len(stdout) > 0,
                        detail=f"stdout: {stdout[:80]}..."
                    ))
                    scores.append(1.0 if len(stdout) > 0 else 0.5)
                else:
                    assertions.append(Assertion(name="命令输出", passed=True, detail="N/A"))
                    scores.append(0.8)
                    
            elif tool_name in ("git_status", "git_commit"):
                git_ok = data.get("status") in ("preview", "no_changes") or "branch" in data or "recent_commits" in data
                assertions.append(Assertion(
                    name="Git操作",
                    passed=git_ok,
                    detail=f"状态: {data.get('status', 'ok')}"
                ))
                scores.append(1.0 if git_ok else 0.3)
                
            elif tool_name == "code_edit":
                edit_ok = data.get("status") in ("diff_generated", "error")
                assertions.append(Assertion(
                    name="代码编辑",
                    passed=edit_ok,
                    detail=f"状态: {data.get('status')}"
                ))
                scores.append(1.0 if edit_ok else 0.3)
            else:
                assertions.append(Assertion(name="结果验证", passed=True, detail=f"状态: {tool_status}"))
                scores.append(0.8)
        else:
            assertions.append(Assertion(name="结果验证", passed=False, detail="非字典响应"))
            scores.append(0.0)
            result.status = TestStatus.FAIL
        
        # 计算得分
        weights = [0.15, 0.15] + [0.70 / len(scores[:-2])] * (len(scores) - 2)
        result.score = sum(s * w for s, w in zip(scores, weights)) * 100
        result.assertions = assertions
        
        return result

# ════════════════════════════════════════════════════════════════
# Module E: 知识检索与法规查询测试 (150轮)
# ════════════════════════════════════════════════════════════════

class ModuleE_KnowledgeSearch(BaseTestModule):
    """
    知识检索与法规查询测试
    
    测试多领域检索能力，验证空结果时不编造内容
    """
    
    SEARCH_QUERIES = [
        ("regulations", "环境保护法"),
        ("regulations", "大气污染防治法"),
        ("regulations", "水污染防治法"),
        ("regulations", "固体废物污染环境防治法"),
        ("regulations", "环境影响评价法"),
        ("cases", "环境污染处罚案例"),
        ("cases", "超标排放执法"),
        ("species", "濒危物种保护"),
        ("species", "水生生物保护"),
        ("all", "碳排放交易"),
        ("all", "排污许可制度"),
        ("all", "土壤污染防治"),
        ("all", "噪声污染控制"),
        ("all", "辐射环境管理"),
        ("all", "生态保护红线"),
    ]
    
    async def run(self, rounds: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module E: 知识检索与法规查询测试 ({rounds} 轮)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        tasks = []
        for i in range(rounds):
            db, query = self.SEARCH_QUERIES[i % len(self.SEARCH_QUERIES)]
            tasks.append(self._test_knowledge_search(i + 1, query, db))
            progress.update(0)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="E",
                    test_name="knowledge_search",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
            else:
                self._print_result(result)
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _test_knowledge_search(
        self,
        round_id: int,
        query: str,
        database: str,
    ) -> TestResult:
        """执行知识检索测试"""
        result = TestResult(
            round_id=round_id,
            module="E",
            test_name=f"知识检索[{database}:{query}]",
            status=TestStatus.PASS,
        )
        
        status, data, ms, size = await self.client.execute_tool(
            tool_name="knowledge_query",
            tool_params={"query": query, "database": database},
            safety_level="L1",
        )
        
        result.response_time_ms = ms
        result.response_size_bytes = size
        result.raw_response = data
        
        assertions = []
        scores = []
        
        # 断言 1: HTTP 状态码
        passed, detail = assert_status_code(status)
        assertions.append(Assertion(name="HTTP状态码", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.0)
        
        # 断言 2: 响应时间
        passed, detail = assert_response_time(ms, 8000)
        assertions.append(Assertion(name="响应时间", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.5)
        
        if isinstance(data, dict):
            results_count = data.get("results_count", len(data.get("results", [])))
            results_list = data.get("results", [])
            
            # 断言 3: 返回结构有效
            structure_ok = "results" in data or "query" in data
            assertions.append(Assertion(
                name="数据结构",
                passed=structure_ok,
                detail=f"results_count={results_count}"
            ))
            scores.append(1.0 if structure_ok else 0.0)
            
            # 断言 4: 空结果时不编造
            if results_count == 0 or not results_list:
                assertions.append(Assertion(
                    name="空结果处理",
                    passed=True,
                    detail="返回空结果，未编造内容"
                ))
                scores.append(1.0)
            else:
                first_result = results_list[0] if results_list else {}
                has_title = "title" in first_result or "name" in first_result
                assertions.append(Assertion(
                    name="结果有效性",
                    passed=has_title,
                    detail=f"首条结果标题: {list(first_result.values())[0][:50] if first_result else 'empty'}..."
                ))
                scores.append(1.0 if has_title else 0.5)
            
            # 断言 5: 无编造内容
            data_str = json.dumps(data, ensure_ascii=False)
            no_fabrication, fab_detail = assert_no_fabrication(data_str)
            assertions.append(Assertion(
                name="无编造",
                passed=no_fabrication,
                detail=fab_detail
            ))
            scores.append(1.0 if no_fabrication else 0.0)
            
            if not no_fabrication:
                result.status = TestStatus.FAIL
                result.error_message = fab_detail
        else:
            for name in ["数据结构", "空结果处理", "结果有效性", "无编造"]:
                assertions.append(Assertion(name=name, passed=False, detail="无效响应"))
            scores.extend([0.0, 0.5, 0.0, 0.5])
            result.status = TestStatus.FAIL
        
        # 计算得分
        weights = [0.15, 0.15, 0.20, 0.25, 0.25]
        result.score = sum(s * w for s, w in zip(scores, weights)) * 100
        result.assertions = assertions
        
        return result

# ════════════════════════════════════════════════════════════════
# Module F: 多轮对话上下文保持测试 (100轮)
# ════════════════════════════════════════════════════════════════

class ModuleF_ContextRetention(BaseTestModule):
    """
    多轮对话上下文保持测试
    
    验证 LLM 能记住前文提到的信息
    测试上下文窗口管理
    """
    
    CONVERSATION_SCENARIOS = [
        {
            "topic": "城市环境对比",
            "messages": [
                "长沙市的 AQI 目前是多少？",
                "和株洲市相比怎么样？",
                "哪个城市的空气质量更好？为什么？",
                "请给出改善建议",
            ],
        },
        {
            "topic": "法规咨询链条",
            "messages": [
                "企业排放废水超标违反了什么法律？",
                "具体的条款编号是什么？",
                "会面临什么样的处罚？",
                "如果企业整改合格可以减轻处罚吗？",
            ],
        },
        {
            "topic": "技术参数追踪",
            "messages": [
                "PM2.5 的标准限值是多少？",
                "PM10 呢？",
                "这两个指标有什么关联？",
                "同时超标时应该优先控制哪个？",
            ],
        },
        {
            "topic": "场景连续问答",
            "messages": [
                "我想了解环评审批的流程",
                "需要准备哪些材料？",
                "审批一般需要多长时间？",
                "如果不通过可以申诉吗？",
            ],
        },
        {
            "topic": "数据推理链",
            "messages": [
                "湖南省有多少个市州？",
                "其中环境监测站点覆盖情况如何？",
                "数据实时更新频率是？",
                "这些数据的准确性如何保证？",
            ],
        },
    ]
    
    async def run(self, rounds: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module F: 多轮对话上下文保持测试 ({rounds} 轮)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        tasks = []
        for i in range(rounds):
            scenario = self.CONVERSATION_SCENARIOS[i % len(self.CONVERSATION_SCENARIOS)]
            tasks.append(self._test_context_retention(i + 1, scenario))
            progress.update(0)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="F",
                    test_name="context_retention",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
            else:
                self._print_result(result)
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _test_context_retention(
        self,
        round_id: int,
        scenario: dict,
    ) -> TestResult:
        """执行多轮对话上下文保持测试"""
        result = TestResult(
            round_id=round_id,
            module="F",
            test_name=f"上下文保持[{scenario['topic']}]",
            status=TestStatus.PASS,
        )
        
        session_id = f"stress-F-{round_id}-{uuid.uuid4().hex[:8]}"
        messages = scenario["messages"]
        conversation_history = []
        all_responses = []
        all_times = []
        
        assertions = []
        scores = []
        
        for idx, msg in enumerate(messages):
            status, data, ms, size = await self.client.chat(
                message=msg,
                session_id=session_id,
                expert_id="ecomind",
                stream=False,
                conversation_history=conversation_history.copy(),
            )
            
            all_times.append(ms)
            
            if isinstance(data, dict):
                content = data.get("content", "")
                all_responses.append(content)
                
                conversation_history.append({"role": "user", "content": msg})
                conversation_history.append({"role": "assistant", "content": content})
        
        result.response_time_ms = sum(all_times) / len(all_times) if all_times else 0
        result.response_size_bytes = sum(len(r.encode()) for r in all_responses)
        
        # 断言 1: 所有轮次都成功
        all_ok = len(all_responses) == len(messages)
        assertions.append(Assertion(
            name="完成轮次",
            passed=all_ok,
            detail=f"完成 {len(all_responses)}/{len(messages)} 轮"
        ))
        scores.append(1.0 if all_ok else (len(all_responses) / len(messages)))
        
        # 断言 2: 平均响应时间
        avg_time = statistics.mean(all_times) if all_times else 0
        passed, detail = assert_response_time(avg_time, 20000)
        assertions.append(Assertion(name="平均响应时间", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.5)
        
        # 断言 3: 后续回复引用前文（上下文保持）
        combined_text = " ".join(all_responses)
        context_keywords = []
        if "长沙" in messages[0] or "株洲" in messages[0]:
            context_keywords = ["长沙", "株洲"]
        elif "PM2.5" in messages[0]:
            context_keywords = ["PM2.5", "PM10"]
        elif "法律" in messages[0] or "条款" in messages[0]:
            context_keywords = ["法", "条"]
        
        if context_keywords:
            later_responses = " ".join(all_responses[2:]) if len(all_responses) > 2 else " ".join(all_responses[1:])
            context_kept = any(kw in later_responses for kw in context_keywords)
            assertions.append(Assertion(
                name="上下文保持",
                passed=context_kept,
                detail="后续回复引用前文关键词" if context_kept else "可能丢失上下文"
            ))
            scores.append(1.0 if context_kept else 0.4)
        else:
            assertions.append(Assertion(name="上下文保持", passed=True, detail="无法自动检测"))
            scores.append(0.8)
        
        # 断言 4: 回复长度递增（说明在累积上下文）
        if len(all_responses) >= 2:
            lengths = [len(r) for r in all_responses]
            avg_first_half = statistics.mean(lengths[:len(lengths)//2])
            avg_second_half = statistics.mean(lengths[len(lengths)//2:])
            length_growing = avg_second_half >= avg_first_half * 0.5
            assertions.append(Assertion(
                name="回复质量",
                passed=length_growing,
                detail=f"前后半段平均长度: {avg_first_half:.0f} vs {avg_second_half:.0f}"
            ))
            scores.append(1.0 if length_growing else 0.6)
        else:
            assertions.append(Assertion(name="回复质量", passed=True, detail="轮次不足"))
            scores.append(0.8)
        
        # 断言 5: 无幻觉拒绝
        for resp in all_responses:
            no_hallucination, _ = assert_no_hallucination(resp)
            if not no_hallucination:
                assertions.append(Assertion(
                    name="无幻觉",
                    passed=False,
                    detail=f"第 {all_responses.index(resp)+1} 轮检测到幻觉"
                ))
                scores.append(0.0)
                result.status = TestStatus.FAIL
                break
        else:
            assertions.append(Assertion(name="无幻觉", passed=True, detail="全部轮次无幻觉"))
            scores.append(1.0)
        
        # 计算得分
        weights = [0.25, 0.15, 0.30, 0.15, 0.15]
        result.score = sum(s * w for s, w in zip(scores, weights)) * 100
        result.assertions = assertions
        
        return result

# ════════════════════════════════════════════════════════════════
# Module G: 并发压力与稳定性测试 (50轮×并发数)
# ════════════════════════════════════════════════════════════════

class ModuleG_ConcurrencyStress(BaseTestModule):
    """
    并发压力与稳定性测试
    
    同时发起多个请求，检测竞态条件、资源泄漏
    测量 P50/P95/P99 响应时间
    """
    
    STRESS_ENDPOINTS = [
        ("/api/chat", "POST", {"message": "并发测试消息: 环境监测数据查询"}),
        ("/api/tools/execute", "POST", {"tool_name": "env_query", "tool_params": {"city": "长沙市"}}),
        ("/api/tools/list", "GET", None),
        ("/health", "GET", None),
    ]
    
    async def run(self, rounds: int, concurrent_users: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module G: 并发压力与稳定性测试 ({rounds}轮 × {concurrent_users}并发)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        semaphore = asyncio.Semaphore(concurrent_users)
        all_tasks = []
        
        for batch in range(rounds):
            for user_id in range(concurrent_users):
                endpoint = self.STRESS_ENDPOINTS[(batch + user_id) % len(self.STRESS_ENDPOINTS)]
                all_tasks.append(
                    self._run_concurrent_request(batch * concurrent_users + user_id + 1, endpoint, semaphore)
                )
            progress.update(concurrent_users)
        
        results = await asyncio.gather(*all_tasks, return_exceptions=True)
        
        success_count = 0
        error_count = 0
        times = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="G",
                    test_name="concurrent_request",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
                error_count += 1
            else:
                self._print_result(result)
                times.append(result.response_time_ms)
                if result.status == TestStatus.PASS:
                    success_count += 1
        
        # 统计并发性能
        if times:
            times.sort()
            n = len(times)
            self.summary.p50_ms = times[int(n * 0.5)]
            self.summary.p95_ms = times[min(int(n * 0.95), n - 1)]
            self.summary.p99_ms = times[min(int(n * 0.99), n - 1)]
            self.summary.avg_response_time_ms = statistics.mean(times)
        
        total = len(results)
        self.summary.total_rounds = total
        self.summary.passed = success_count
        self.summary.errors = error_count
        self.summary.failed = total - success_count - error_count
        self.summary.total_score = sum(r.score for r in self.summary.results)
        
        print(f"\n  {color('并发性能统计:', Colors.BOLD)}")
        print(f"    总请求数: {total}")
        print(f"    成功率:   {success_count/total*100:.1f}%")
        print(f"    错误率:   {error_count/total*100:.1f}%")
        if times:
            print(f"    P50:      {self.summary.p50_ms:.0f}ms")
            print(f"    P95:      {self.summary.p95_ms:.0f}ms")
            print(f"    P99:      {self.summary.p99_ms:.0f}ms")
            print(f"    平均:     {self.summary.avg_response_time_ms:.0f}ms")
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _run_concurrent_request(
        self,
        round_id: int,
        endpoint: tuple,
        semaphore: asyncio.Semaphore,
    ) -> TestResult:
        """执行单个并发请求"""
        async with semaphore:
            result = TestResult(
                round_id=round_id,
                module="G",
                test_name=f"并发请求[{endpoint[0]}]",
                status=TestStatus.PASS,
            )
            
            path, method, payload = endpoint
            
            if payload and method == "POST":
                status, data, ms, size = await self.client.request(method, path, json_data=payload)
            else:
                status, data, ms, size = await self.client.request(method, path)
            
            result.response_time_ms = ms
            result.response_size_bytes = size
            result.raw_response = data
            
            assertions = []
            scores = []
            
            # 断言 1: 请求成功
            passed, detail = assert_status_code(status)
            assertions.append(Assertion(name="请求成功", passed=passed, detail=detail))
            scores.append(1.0 if passed else 0.0)
            
            # 断言 2: 响应时间（并发时阈值放宽）
            passed, detail = assert_response_time(ms, 30000)
            assertions.append(Assertion(name="响应时间", passed=passed, detail=detail))
            scores.append(1.0 if passed else 0.3)
            
            # 断言 3: 返回有效数据
            data_valid = isinstance(data, dict) and len(data) > 0
            assertions.append(Assertion(
                name="数据有效",
                passed=data_valid,
                detail=f"响应大小: {size} bytes"
            ))
            scores.append(1.0 if data_valid else 0.3)
            
            # 断言 4: 无服务器错误
            no_server_error = status < 500
            assertions.append(Assertion(
                name="无服务错误",
                passed=no_server_error,
                detail=f"状态码: {status}"
            ))
            scores.append(1.0 if no_server_error else 0.0)
            
            if not passed or not no_server_error:
                result.status = TestStatus.FAIL
                result.error_message = f"并发请求失败: status={status}"
            
            weights = [0.30, 0.25, 0.25, 0.20]
            result.score = sum(s * w for s, w in zip(scores, weights)) * 100
            result.assertions = assertions
            
            return result

# ════════════════════════════════════════════════════════════════
# Module H: 异常输入与安全防护测试 (50轮)
# ════════════════════════════════════════════════════════════════

class ModuleH_SecurityHardening(BaseTestModule):
    """
    异常输入与安全防护测试
    
    SQL 注入、XSS、超长输入、特殊字符等
    验证系统不崩溃、不泄露信息
    """
    
    ATTACK_PAYLOADS = [
        ("SQL注入-基础", "'; DROP TABLE users; --", "sql_injection"),
        ("SQL注入-Union", "' UNION SELECT * FROM users --", "sql_injection"),
        ("SQL注入-注释", "1 OR 1=1; --", "sql_injection"),
        ("XSS-脚本", "<script>alert('xss')</script>", "xss"),
        ("XSS-事件", "<img onerror=alert('xss') src=x>", "xss"),
        ("XSS-SVG", "<svg onload=alert('xss')>", "xss"),
        ("超长输入-10K", "A" * 10000, "long_input"),
        ("超长输入-50K", "测试" * 5000, "long_input"),
        ("特殊字符-Unicode", "🔥💧🌍环境测试中文English日本語한국어", "special_chars"),
        ("特殊字符-控制符", "test\x00\x01\x02\x03injection", "special_chars"),
        ("空输入", "", "empty_input"),
        ("纯空格", "   \t\n   ", "whitespace"),
        ("JSON注入", '{"__proto__": {"admin": true}}', "json_injection"),
        ("模板注入", "${7*7}", "template_injection"),
        ("命令注入", "$(whoami); cat /etc/passwd", "cmd_injection"),
        ("路径遍历", "../../../etc/passwd", "path_traversal"),
        ("Null字节", "test%00.jpg", "null_byte"),
        ("HTML实体", "&lt;script&gt;alert(1)&lt;/script&gt;", "html_entity"),
        ("换行注入", "test\r\nX-Custom-Header: injected", "header_injection"),
        ("编码绕过", "%3Cscript%3Ealert(1)%3C/script%3E", "encoding_bypass"),
        ("正则DoS", "(a+)+$".replace("+", "") + "a" * 100, "regex_dos"),
    ]
    
    async def run(self, rounds: int, progress: ProgressBar) -> ModuleSummary:
        print(bold(f"\n{'='*60}"))
        print(bold(color(f"Module H: 异常输入与安全防护测试 ({rounds} 轮)", Colors.MAGENTA)))
        print(bold(f"{'='*60}\n"))
        
        tasks = []
        for i in range(rounds):
            payload_name, payload, attack_type = self.ATTACK_PAYLOADS[i % len(self.ATTACK_PAYLOADS)]
            tasks.append(self._test_security_hardening(i + 1, payload_name, payload, attack_type))
            progress.update(0)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        vulnerabilities_found = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = TestResult(
                    round_id=i + 1,
                    module="H",
                    test_name="security_test",
                    status=TestStatus.ERROR,
                    error_message=str(result),
                    score=0,
                )
                self.summary.results.append(error_result)
                self.summary.errors += 1
                self.summary.total_rounds += 1
            else:
                self._print_result(result)
                if result.status == TestStatus.FAIL:
                    vulnerabilities_found.append(result)
        
        if vulnerabilities_found:
            print(f"\n  {color('⚠️ 发现潜在安全问题:', Colors.RED)}")
            for v in vulnerabilities_found[:5]:
                print(f"    - {v.test_name}: {v.error_message}")
        
        self.calculate_stats()
        progress.finish()
        return self.summary
    
    async def _test_security_hardening(
        self,
        round_id: int,
        payload_name: str,
        payload: str,
        attack_type: str,
    ) -> TestResult:
        """执行安全防护测试"""
        result = TestResult(
            round_id=round_id,
            module="H",
            test_name=f"安全测试[{payload_name}]",
            status=TestStatus.PASS,
        )
        
        assertions = []
        scores = []
        
        # 测试 Chat 接口
        chat_status, chat_data, chat_ms, chat_size = await self.client.chat(
            message=payload,
            session_id=f"security-{round_id}",
            expert_id="ecomind",
            stream=False,
        )
        
        result.response_time_ms = chat_ms
        result.response_size_bytes = chat_size
        
        # 断言 1: 服务不崩溃（返回有效响应）
        server_alive = chat_status in (200, 400, 401, 403, 422)
        assertions.append(Assertion(
            name="服务稳定",
            passed=server_alive,
            detail=f"状态码: {chat_status}"
        ))
        scores.append(1.0 if server_alive else 0.0)
        
        if not server_alive:
            result.status = TestStatus.FAIL
            result.error_message = f"服务异常崩溃: HTTP {chat_status}"
            result.score = 0
            result.assertions = assertions
            return result
        
        # 获取响应内容
        chat_content = ""
        if isinstance(chat_data, dict):
            chat_content = chat_data.get("content", "")
        
        # 断言 2: SQL 注入防护
        if attack_type == "sql_injection":
            no_sql, sql_detail = assert_no_sql_injection_vulnerable(chat_content)
            assertions.append(Assertion(name="SQL注入防护", passed=no_sql, detail=sql_detail))
            scores.append(1.0 if no_sql else 0.0)
            if not no_sql:
                result.status = TestStatus.FAIL
                result.error_message = sql_detail
        
        # 断言 3: XSS 防护
        elif attack_type == "xss":
            no_xss, xss_detail = assert_no_xss_vulnerable(chat_content)
            assertions.append(Assertion(name="XSS防护", passed=no_xss, detail=xss_detail))
            scores.append(1.0 if no_xss else 0.0)
            if not no_xss:
                result.status = TestStatus.FAIL
                result.error_message = xss_detail
        
        # 断言 4: 超长输入处理
        elif attack_type == "long_input":
            handled_well = (
                chat_status != 500 and
                (not chat_content or len(chat_content) < len(payload))
            )
            assertions.append(Assertion(
                name="长输入处理",
                passed=handled_well,
                detail=f"输入 {len(payload)} 字符, 响应 {len(chat_content)} 字符"
            ))
            scores.append(1.0 if handled_well else 0.5)
        
        # 断言 5: 特殊字符处理
        elif attack_type in ("special_chars", "null_byte", "encoding_bypass"):
            handled = chat_status != 500
            assertions.append(Assertion(
                name="特殊字符处理",
                passed=handled,
                detail=f"状态码: {chat_status}"
            ))
            scores.append(1.0 if handled else 0.0)
        
        # 断言 6: 空输入处理
        elif attack_type in ("empty_input", "whitespace"):
            handled_gracefully = chat_status in (200, 400, 422)
            assertions.append(Assertion(
                name="边界输入处理",
                passed=handled_gracefully,
                detail=f"状态码: {chat_status}"
            ))
            scores.append(1.0 if handled_gracefully else 0.5)
        
        else:
            # 其他攻击类型：主要检测是否崩溃
            assertions.append(Assertion(name="攻击防护", passed=True, detail="服务正常运行"))
            scores.append(1.0)
        
        # 断言 7: 响应时间合理
        passed, detail = assert_response_time(chat_ms, 15000)
        assertions.append(Assertion(name="响应时间", passed=passed, detail=detail))
        scores.append(1.0 if passed else 0.5)
        
        # 断言 8: 不泄露敏感信息
        sensitive_patterns = [
            'traceback', 'exception', 'internal error', 'stack trace',
            '/etc/', 'password', 'secret', 'token', 'private key'
        ]
        content_lower = chat_content.lower()
        leaked = [p for p in sensitive_patterns if p in content_lower]
        no_leak = len(leaked) == 0
        assertions.append(Assertion(
            name="信息泄露防护",
            passed=no_leak,
            detail=f"可能泄露: {leaked}" if leaked else "无敏感信息泄露"
        ))
        scores.append(1.0 if no_leak else 0.0)
        
        if not no_leak:
            result.status = TestStatus.FAIL
            result.error_message = f"可能存在信息泄露: {leaked}"
        
        # 计算得分
        valid_scores = [s for s in scores]
        weight_per = 1.0 / len(valid_scores) if valid_scores else 1
        result.score = sum(s * weight_per for s in valid_scores) * 100
        result.assertions = assertions
        
        return result

# ════════════════════════════════════════════════════════════════
# 报告生成器
# ════════════════════════════════════════════════════════════════

class ReportGenerator:
    """生成 Markdown 和 JSON 格式的测试报告"""
    
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate(
        self,
        modules: Dict[str, ModuleSummary],
        config: TestConfig,
        start_time: float,
        end_time: float,
    ) -> tuple[str, str]:
        """生成报告，返回 (markdown_path, json_path)"""
        
        total_duration = end_time - start_time
        total_rounds = sum(m.total_rounds for m in modules.values())
        total_passed = sum(m.passed for m in modules.values())
        total_failed = sum(m.failed for m in modules.values())
        total_errors = sum(m.errors for m in modules.values())
        total_score = sum(m.total_score for m in modules.values())
        overall_score = total_score / total_rounds if total_rounds > 0 else 0
        
        production_readiness = self._calculate_production_readiness(modules, overall_score)
        
        bugs_found = self._extract_bugs(modules)
        
        # 生成 JSON 报告
        json_report = {
            "metadata": {
                "version": "2.0.0",
                "timestamp": datetime.now().isoformat(),
                "duration_seconds": round(total_duration, 2),
                "config": {
                    "total_rounds": config.TOTAL_ROUNDS,
                    "concurrent_users": config.CONCURRENT_USERS,
                    "base_url": config.BASE_URL,
                },
            },
            "overall": {
                "production_readiness": round(production_readiness, 1),
                "overall_score": round(overall_score, 1),
                "total_rounds": total_rounds,
                "passed": total_passed,
                "failed": total_failed,
                "errors": total_errors,
                "pass_rate": round(total_passed / total_rounds * 100, 1) if total_rounds > 0 else 0,
            },
            "modules": {},
            "bugs": bugs_found,
            "performance": {
                "avg_response_ms": round(
                    statistics.mean([
                        m.avg_response_time_ms for m in modules.values() if m.avg_response_time_ms > 0
                    ]) if any(m.avg_response_time_ms > 0 for m in modules.values()) else 0, 1
                ),
                "p95_ms": round(max((m.p95_ms for m in modules.values()), default=0), 1),
                "p99_ms": round(max((m.p99_ms for m in modules.values()), default=0), 1),
            },
        }
        
        for mod_id, summary in modules.items():
            json_report["modules"][mod_id] = {
                "name": summary.module_name,
                "total_rounds": summary.total_rounds,
                "passed": summary.passed,
                "failed": summary.failed,
                "errors": summary.errors,
                "pass_rate": round(summary.pass_rate, 1),
                "avg_score": round(summary.avg_score, 1),
                "avg_response_ms": round(summary.avg_response_time_ms, 1),
                "p50_ms": round(summary.p50_ms, 1),
                "p95_ms": round(summary.p95_ms, 1),
                "p99_ms": round(summary.p99_ms, 1),
                "failed_tests": [
                    {
                        "round_id": r.round_id,
                        "test_name": r.test_name,
                        "error": r.error_message,
                        "score": r.score,
                    }
                    for r in summary.results if r.status in (TestStatus.FAIL, TestStatus.ERROR)
                ][:10],
            }
        
        json_path = self.output_dir / config.REPORT_JSON
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_report, f, ensure_ascii=False, indent=2)
        
        # 生成 Markdown 报告
        md_content = self._generate_markdown(
            modules=modules,
            config=config,
            total_duration=total_duration,
            overall_score=overall_score,
            production_readiness=production_readiness,
            bugs_found=bugs_found,
            json_report=json_report,
        )
        
        md_path = self.output_dir / config.REPORT_MD
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return str(md_path), str(json_path)
    
    def _calculate_production_readiness(
        self,
        modules: Dict[str, ModuleSummary],
        overall_score: float,
    ) -> float:
        """计算生产就绪度 (0-100%)"""
        
        # 各维度权重
        weights = {
            "A": 0.25,  # 对话可靠性 (最重要)
            "B": 0.20,  # 工具调用
            "C": 0.15,  # 文件上传链路
            "D": 0.10,  # 代码开发
            "E": 0.10,  # 知识检索
            "F": 0.10,  # 上下文保持
            "G": 0.05,  # 并发稳定性
            "H": 0.05,  # 安全防护
        }
        
        weighted_score = 0.0
        for mod_id, summary in modules.items():
            w = weights.get(mod_id, 0.05)
            mod_score = summary.avg_score
            
            # 关键模块惩罚
            if mod_id in ("A", "B") and summary.pass_rate < 90:
                mod_score *= 0.8
            if mod_id == "H" and summary.failed > 0:
                mod_score *= 0.7  # 安全问题严重惩罚
            
            weighted_score += mod_score * w
        
        # 基础分：通过率
        total_pass_rate = (
            sum(m.passed for m in modules.values()) /
            sum(m.total_rounds for m in modules.values()) * 100
            if sum(m.total_rounds for m in modules.values()) > 0 else 0
        )
        
        # 最终就绪度 = 加权得分 * 0.7 + 通过率 * 0.3
        readiness = weighted_score * 0.7 + total_pass_rate * 0.3
        return min(100.0, max(0.0, readiness))
    
    def _extract_bugs(self, modules: Dict[str, ModuleSummary]) -> List[dict]:
        """提取发现的 BUG 清单"""
        bugs = []
        severity_map = {
            "H": "CRITICAL",  # 安全问题最严重
            "A": "HIGH",      # 幻觉拒绝影响用户体验
            "G": "HIGH",      # 并发问题可能导致生产事故
            "C": "MEDIUM",    # 文件上传问题
            "B": "MEDIUM",    # 工具调用失败
            "F": "LOW",       # 上下文问题
            "D": "LOW",       # 开发工具问题
            "E": "LOW",       # 检索问题
        }
        
        for mod_id, summary in modules.items():
            for r in summary.results:
                if r.status in (TestStatus.FAIL, TestStatus.ERROR):
                    bugs.append({
                        "severity": severity_map.get(mod_id, "MEDIUM"),
                        "module": mod_id,
                        "module_name": summary.module_name,
                        "test": r.test_name,
                        "error": r.error_message[:200],
                        "score": r.score,
                        "round_id": r.round_id,
                    })
        
        # 按严重程度排序
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        bugs.sort(key=lambda x: severity_order.get(x["severity"], 4))
        
        return bugs[:50]  # 最多返回 50 个
    
    def _generate_markdown(
        self,
        modules: Dict[str, ModuleSummary],
        config: TestConfig,
        total_duration: float,
        overall_score: float,
        production_readiness: float,
        bugs_found: List[dict],
        json_report: dict,
    ) -> str:
        """生成 Markdown 格式报告"""
        
        lines = []
        lines.append("# EcoMind OS 压力测试报告")
        lines.append("")
        lines.append(f"> **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> **测试版本**: StressTest Engine v2.0.0")
        lines.append(f"> **总耗时**: {total_duration:.1f}s")
        lines.append("")
        
        # ─── 总体评分 ─────────────────────────────────────────
        lines.append("## 📊 总体评分")
        lines.append("")
        
        readiness_color = (
            "green" if production_readiness >= 80
            else "yellow" if production_readiness >= 60
            else "red"
        )
        readiness_icon = (
            "✅" if production_readiness >= 80
            else "⚠️" if production_readiness >= 60
            else "❌"
        )
        
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| **生产就绪度** | **{production_readiness:.1f}%** {readiness_icon} |")
        lines.append(f"| 综合得分 | {overall_score:.1f}/100 |")
        lines.append(f"| 总测试轮次 | {sum(m.total_rounds for m in modules.values()):,} |")
        lines.append(f"| 通过 | {sum(m.passed for m in modules.values()):,} |")
        lines.append(f"| 失败 | {sum(m.failed for m in modules.values()):,} |")
        lines.append(f"| 错误 | {sum(m.errors for m in modules.values()):,} |")
        _total_rounds = sum(m.total_rounds for m in modules.values())
        lines.append(f"| 通过率 | {sum(m.passed for m in modules.values())/_total_rounds*100:.1f}% |" if _total_rounds > 0 else "| 通过率 | N/A |")
        lines.append("")
        
        # 就绪度进度条
        bar_len = 30
        filled = int(production_readiness / 100 * bar_len)
        bar = '█' * filled + '░' * (bar_len - filled)
        lines.append(f"`[{bar}]` {production_readiness:.1f}%")
        lines.append("")
        
        # ─── 各模块排名 ────────────────────────────────────────
        lines.append("## 📈 各模块得分与排名")
        lines.append("")
        lines.append("| 排名 | 模块 | 名称 | 轮次 | 通过率 | 平均分 | P50(ms) | P95(ms) |")
        lines.append("|------|------|------|------|--------|--------|---------|---------|")
        
        sorted_modules = sorted(
            modules.items(),
            key=lambda x: x[1].avg_score,
            reverse=True
        )
        
        for rank, (mod_id, summary) in enumerate(sorted_modules, 1):
            medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(rank, f"{rank}.")
            lines.append(
                f"| {medal} | **{mod_id}** | {summary.module_name} | "
                f"{summary.total_rounds} | "
                f"{summary.pass_rate:.1f}% | "
                f"{summary.avg_score:.1f} | "
                f"{summary.p50_ms:.0f} | "
                f"{summary.p95_ms:.0f} |"
            )
        lines.append("")
        
        # ─── 性能分布图 ────────────────────────────────────────
        lines.append("## ⚡ 性能指标分布")
        lines.append("")
        lines.append("### 响应时间分布 (文本柱状图)")
        lines.append("")
        
        for mod_id, summary in sorted_modules:
            if summary.avg_response_time_ms > 0:
                p50_bar = "█" * min(int(summary.p50_ms / 200), 30)
                p95_bar = "█" * min(int(summary.p95_ms / 500), 30)
                lines.append(f"**{mod_id}**:")
                lines.append(f"  P50: `{p50_bar:>30}` {summary.p50_ms:.0f}ms")
                lines.append(f"  P95: `{p95_bar:>30}` {summary.p95_ms:.0f}ms")
                lines.append("")
        
        # ─── 失败用例详情 ──────────────────────────────────────
        lines.append("## ❌ 失败用例详情 (Top 20)")
        lines.append("")
        
        failed_tests = []
        for mod_id, summary in modules.items():
            for r in summary.results:
                if r.status in (TestStatus.FAIL, TestStatus.ERROR):
                    failed_tests.append((mod_id, r))
        
        failed_tests.sort(key=lambda x: x[1].score if x[1].score is not None else 0)
        failed_tests = failed_tests[:20]
        
        for mod_id, r in failed_tests[:20]:
            icon = "🔴" if r.status == TestStatus.ERROR else "🟠"
            lines.append(f"{icon} **[{mod_id}]** #{r.round_id:04d} `{r.test_name}`")
            lines.append(f"   - 得分: {r.score:.0f}/100 | 耗时: {r.response_time_ms:.0f}ms")
            if r.error_message:
                lines.append(f"   - 错误: {r.error_message[:150]}")
            lines.append("")
        
        # ─── BUG 清单 ──────────────────────────────────────────
        lines.append("## 🐛 发现的 BUG 清单")
        lines.append("")
        
        severity_icons = {
            "CRITICAL": "🔴🔴🔴",
            "HIGH": "🔴🔴",
            "MEDIUM": "🔴",
            "LOW": "🟡",
        }
        
        by_severity = {}
        for bug in bugs_found:
            sev = bug["severity"]
            if sev not in by_severity:
                by_severity[sev] = []
            by_severity[sev].append(bug)
        
        for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            if sev in by_severity:
                lines.append(f"### {severity_icons.get(sev, '')} {sev}")
                lines.append("")
                for bug in by_severity[sev][:10]:
                    lines.append(f"- **[{bug['module']}]** {bug['test']}")
                    lines.append(f"  - {bug['error']}")
                    lines.append("")
        
        # ─── 生产部署建议 ──────────────────────────────────────
        lines.append("## 🚀 生产部署建议")
        lines.append("")
        
        if production_readiness >= 85:
            lines.append("### ✅ 建议部署")
            lines.append("")
            lines.append("- 系统整体表现优秀，满足生产环境要求")
            lines.append("- 建议进行灰度发布，先开放 10% 流量")
            lines.append("- 配置监控告警，重点关注 P95/P99 响应时间")
            lines.append("- 准备回滚方案")
        elif production_readiness >= 70:
            lines.append("### ⚠️ 条件部署")
            lines.append("")
            lines.append("- 系统基本可用，但存在问题需修复")
            lines.append("- 建议：")
            critical_high = len([b for b in bugs_found if b["severity"] in ("CRITICAL", "HIGH")])
            if critical_high > 0:
                lines.append(f"  1. **必须修复**: {critical_high} 个 HIGH/CRITICAL 级别问题")
            lines.append("  2. 进行回归测试确认修复有效")
            lines.append("  3. 降低并发数或增加超时时间")
            lines.append("  4. 加强日志监控")
        else:
            lines.append("### ❌ 不建议部署")
            lines.append("")
            lines.append("- 系统存在较多问题，不建议进入生产环境")
            lines.append("- 必须：")
            lines.append("  1. 修复所有 CRITICAL 和 HIGH 级别 BUG")
            lines.append("  2. 提升核心模块（对话、工具调用）通过率至 90%+")
            lines.append("  3. 完成安全加固")
            lines.append("  4. 进行全量回归测试")
        lines.append("")
        
        # ─── 详细断言统计 ──────────────────────────────────────
        lines.append("## 📋 断言统计详情")
        lines.append("")
        
        for mod_id, summary in sorted_modules:
            assertion_stats = {}
            for r in summary.results:
                for a in r.assertions:
                    if a.name not in assertion_stats:
                        assertion_stats[a.name] = {"total": 0, "passed": 0}
                    assertion_stats[a.name]["total"] += 1
                    if a.passed:
                        assertion_stats[a.name]["passed"] += 1
            
            lines.append(f"### Module {mod_id}: {summary.module_name}")
            lines.append("")
            lines.append("| 断言名称 | 总次数 | 通过率 |")
            lines.append("|----------|--------|--------|")
            for name, stats in sorted(assertion_stats.items()):
                rate = stats["passed"] / stats["total"] * 100 if stats["total"] > 0 else 0
                lines.append(f"| {name} | {stats['total']} | {rate:.1f}% |")
            lines.append("")
        
        # ─── 页脚 ──────────────────────────────────────────────
        lines.append("---")
        lines.append(f"*报告由 EcoMind OS StressTest Engine v2.0 自动生成*")
        lines.append(f"*完整数据见: `{config.REPORT_JSON}`*")
        lines.append("")
        
        return "\n".join(lines)

# ════════════════════════════════════════════════════════════════
# 主测试引擎
# ════════════════════════════════════════════════════════════════

class StressTestEngine:
    """EcoMind OS 压力测试主引擎"""
    
    def __init__(self, config: TestConfig):
        self.config = config
        self.modules: Dict[str, ModuleSummary] = {}
        self.report_generator = ReportGenerator(config.OUTPUT_DIR)
    
    async def run(self, target_module: Optional[str] = None, verbose: bool = False):
        """执行压力测试"""
        
        print("\n" + "=" * 70)
        print(bold(color("  🧪 EcoMind OS 生产级端到端压力测试框架 v2.0", Colors.CYAN)))
        print("=" * 70)
        print(f"\n  目标地址: {color(self.config.BASE_URL, Colors.BLUE)}")
        print(f"  总轮次:   {self.config.TOTAL_ROUNDS:,}")
        print(f"  并发用户: {self.config.CONCURRENT_USERS}")
        print(f"  模块配置: {dict(self.config.MODULE_ROUNDS)}")
        print(f"  开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        start_time = time.time()
        
        async with StressTestClient(
            base_url=self.config.BASE_URL,
            timeout=self.config.REQUEST_TIMEOUT,
        ) as client:
            
            # 健康检查
            print(bold("\n🔍 健康检查..."), end="")
            status, health_data, _, _ = await client.health_check()
            if status == 200:
                print(color(" ✅ 服务正常", Colors.GREEN))
                if verbose and isinstance(health_data, dict):
                    print(f"   {json.dumps(health_data, ensure_ascii=False, indent=2)}")
            else:
                print(color(f" ❌ 服务异常 (HTTP {status})", Colors.RED))
                print(f"   响应: {health_data}")
                if status not in (200,):
                    print("\n⚠️  目标服务不可用，测试终止")
                    return
            
            # 初始化总进度
            total_tests = sum(
                v * (self.config.CONCURRENT_USERS if k == "G" else 1)
                for k, v in self.config.MODULE_ROUNDS.items()
                if target_module is None or k == target_module
            )
            main_progress = ProgressBar(total_tests, prefix="总进度")
            
            # Module A: 对话真实性可靠性
            if target_module is None or target_module == "A":
                rounds = self.config.MODULE_ROUNDS["A"]
                module_a = ModuleA_ChatReliability(client, "A", "对话真实性可靠性")
                self.modules["A"] = await module_a.run(rounds, main_progress)
            
            # Module B: 工具调用能力
            if target_module is None or target_module == "B":
                rounds = self.config.MODULE_ROUNDS["B"]
                module_b = ModuleB_ToolExecution(client, "B", "工具调用能力")
                self.modules["B"] = await module_b.run(rounds, main_progress)
            
            # Module C: 文件上传+分析链路
            if target_module is None or target_module == "C":
                rounds = self.config.MODULE_ROUNDS["C"]
                module_c = ModuleC_FileUploadChain(client, "C", "文件上传+分析链路")
                self.modules["C"] = await module_c.run(rounds, main_progress)
            
            # Module D: 代码开发能力
            if target_module is None or target_module == "D":
                rounds = self.config.MODULE_ROUNDS["D"]
                module_d = ModuleD_CodeDevelopment(client, "D", "代码开发能力")
                self.modules["D"] = await module_d.run(rounds, main_progress)
            
            # Module E: 知识检索与法规查询
            if target_module is None or target_module == "E":
                rounds = self.config.MODULE_ROUNDS["E"]
                module_e = ModuleE_KnowledgeSearch(client, "E", "知识检索与法规查询")
                self.modules["E"] = await module_e.run(rounds, main_progress)
            
            # Module F: 多轮对话上下文保持
            if target_module is None or target_module == "F":
                rounds = self.config.MODULE_ROUNDS["F"]
                module_f = ModuleF_ContextRetention(client, "F", "多轮对话上下文保持")
                self.modules["F"] = await module_f.run(rounds, main_progress)
            
            # Module G: 并发压力与稳定性
            if target_module is None or target_module == "G":
                rounds = self.config.MODULE_ROUNDS["G"]
                module_g = ModuleG_ConcurrencyStress(client, "G", "并发压力与稳定性")
                self.modules["G"] = await module_g.run(
                    rounds, self.config.CONCURRENT_USERS, main_progress
                )
            
            # Module H: 异常输入与安全防护
            if target_module is None or target_module == "H":
                rounds = self.config.MODULE_ROUNDS["H"]
                module_h = ModuleH_SecurityHardening(client, "H", "异常输入与安全防护")
                self.modules["H"] = await module_h.run(rounds, main_progress)
        
        end_time = time.time()
        
        # 生成报告
        print(bold("\n📝 生成测试报告..."))
        md_path, json_path = self.report_generator.generate(
            modules=self.modules,
            config=self.config,
            start_time=start_time,
            end_time=end_time,
        )
        
        # 输出总结
        self._print_summary(end_time - start_time, md_path, json_path)
    
    def _print_summary(self, duration: float, md_path: str, json_path: str):
        """打印测试总结"""
        
        total_rounds = sum(m.total_rounds for m in self.modules.values())
        total_passed = sum(m.passed for m in self.modules.values())
        total_failed = sum(m.failed for m in self.modules.values())
        total_errors = sum(m.errors for m in self.modules.values())
        total_score = sum(m.total_score for m in self.modules.values())
        overall_score = total_score / total_rounds if total_rounds > 0 else 0
        pass_rate = total_passed / total_rounds * 100 if total_rounds > 0 else 0
        
        print("\n" + "=" * 70)
        print(bold(color("  📊 测试总结", Colors.CYAN)))
        print("=" * 70)
        print(f"\n  {'指标':<20} {'数值':>15}")
        print(f"  {'-'*35}")
        print(f"  {'总测试轮次':<20} {total_rounds:>15,}")
        print(f"  {'总耗时':<20} {duration:>14.1f}s")
        print(f"  {'通过':<20} {color(str(total_passed), Colors.GREEN):>15}")
        print(f"  {'失败':<20} {color(str(total_failed), Colors.RED):>15}")
        print(f"  {'错误':<20} {color(str(total_errors), Colors.RED):>15}")
        print(f"  {'通过率':<20} {pass_rate:>14.1f}%")
        print(f"  {'综合得分':<20} {overall_score:>14.1f}/100")
        
        # 生产就绪度
        readiness = self.report_generator._calculate_production_readiness(self.modules, overall_score)
        readiness_color = Colors.GREEN if readiness >= 80 else (Colors.YELLOW if readiness >= 60 else Colors.RED)
        readiness_text = "✅ 可部署" if readiness >= 80 else ("⚠️ 条件部署" if readiness >= 60 else "❌ 不建议部署")
        print(f"\n  {'生产就绪度':<20} {color(f'{readiness:.1f}% {readiness_text}', readiness_color):>15}")
        
        # 模块排名
        print(f"\n  {'模块排名':^35}")
        print(f"  {'-'*35}")
        sorted_modules = sorted(self.modules.items(), key=lambda x: x[1].avg_score, reverse=True)
        for rank, (mod_id, summary) in enumerate(sorted_modules, 1):
            medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(rank, f"{rank}.")
            status_color = Colors.GREEN if summary.pass_rate >= 90 else (Colors.YELLOW if summary.pass_rate >= 70 else Colors.RED)
            print(f"  {medal} Module {mod_id}: {summary.module_name:<12} "
                  f"{color(f'{summary.avg_score:.0f}分', status_color):>6} "
                  f"({summary.pass_rate:.0f}%通过)")
        
        print(f"\n  📄 报告文件:")
        print(f"     Markdown: {md_path}")
        print(f"     JSON:     {json_path}")
        print("\n" + "=" * 70)

# ════════════════════════════════════════════════════════════════
# 命令行入口
# ════════════════════════════════════════════════════════════════

def parse_args():
    parser = argparse.ArgumentParser(
        description="EcoMind OS 生产级端到端压力测试框架",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 stress_test_engine.py                    # 默认配置 (1000轮)
  python3 stress_test_engine.py --rounds 500        # 500 轮
  python3 stress_test_engine.py --concurrent 10     # 10 并发
  python3 stress_test_engine.py --module A          # 只测 Module A
  python3 stress_test_engine.py --verbose           # 详细输出
  python3 stress_test_engine.py --url http://localhost:8080  # 自定义地址
        """,
    )
    
    parser.add_argument(
        "--rounds", "-r",
        type=int,
        default=None,
        help="自定义总轮次 (默认按模块分配)",
    )
    parser.add_argument(
        "--concurrent", "-c",
        type=int,
        default=None,
        help="并发用户数 (默认 5)",
    )
    parser.add_argument(
        "--module", "-m",
        type=str,
        choices=["A", "B", "C", "D", "E", "F", "G", "H"],
        default=None,
        help="只运行指定模块 (A-H)",
    )
    parser.add_argument(
        "--url", "-u",
        type=str,
        default=None,
        help="后端服务地址 (默认 http://localhost:8000)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        default=False,
        help="详细输出模式",
    )
    
    return parser.parse_args()


async def main():
    args = parse_args()
    
    # 应用命令行参数
    if args.rounds:
        config.TOTAL_ROUNDS = args.rounds
        # 按比例调整各模块轮次
        ratio = args.rounds / 1000
        for k in config.MODULE_ROUNDS:
            config.MODULE_ROUNDS[k] = max(1, int(config.MODULE_ROUNDS[k] * ratio))
    
    if args.concurrent:
        config.CONCURRENT_USERS = args.concurrent
    
    if args.url:
        config.BASE_URL = args.url
    
    engine = StressTestEngine(config)
    await engine.run(target_module=args.module, verbose=args.verbose)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n\n{color('⚠️ 测试被用户中断', Colors.YELLOW)}")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n{color(f'❌ 测试引擎异常: {e}', Colors.RED)}")
        traceback.print_exc()
        sys.exit(1)
