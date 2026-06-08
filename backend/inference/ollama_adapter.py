"""
OllamaAdapter — 本地 Ollama 推理适配器

支持联邦蒸馏链：72B → 14B → 7B → 3B
适用于离线/内网环境的本地推理部署。

联邦蒸馏流程：
1. 省厅 72B 模型 (qwen3:72b) → 生成高质量标注数据
2. 市级 14B 模型 (qwen2.5:14b) → 蒸馏训练 → 市级推理
3. 县级 7B 模型 (llama3.1:7b) → 轻量推理 → 边缘部署
4. 终端 3B 模型 (phi3:3b) → 嵌入式设备推理

使用方式：
    from inference.ollama_adapter import OllamaAdapter, OllamaConfig

    adapter = OllamaAdapter(OllamaConfig(base_url="http://localhost:11434"))
    response = await adapter.chat([{"role": "user", "content": "长沙今天AQI是多少？"}])
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Optional

import httpx

logger = logging.getLogger(__name__)


class Tier(str, Enum):
    """联邦蒸馏层级"""
    PROVINCE = "province"    # 省级 72B — 高质量生成/标注
    CITY = "city"            # 市级 14B — 日常推理
    COUNTY = "county"        # 县级 7B — 边缘部署
    TERMINAL = "terminal"    # 终端 3B — 嵌入式


@dataclass
class OllamaConfig:
    """Ollama 配置"""
    base_url: str = "http://localhost:11434"
    model: str = "qwen2.5:14b"       # 默认市级模型
    tier: Tier = Tier.CITY
    temperature: float = 0.7
    num_predict: int = 4096
    num_ctx: int = 8192
    timeout: float = 120.0
    keep_alive: str = "5m"
    # 联邦蒸馏配置
    teacher_model: str = "qwen3:72b"  # 教师模型（省级）
    collection_interval: int = 3600   # 数据采集间隔（秒）


@dataclass
class TokenCountResult:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    eval_duration_ms: float = 0.0


@dataclass
class DistillationRecord:
    """蒸馏数据记录"""
    id: str
    prompt: str
    teacher_output: str  # 72B 教师模型输出
    student_output: str  # 14B/7B 学生模型输出
    quality_score: float
    timestamp: float = field(default_factory=time.time)


class OllamaAdapter:
    """
    Ollama 本地推理适配器。

    核心功能：
    - Chat Completion（/api/chat）
    - Generate（/api/generate）
    - Embeddings（/api/embeddings）
    - 模型管理（列出/拉取/删除/复制）
    - 联邦蒸馏数据采集
    - 模型性能基准测试

    端点说明：
    - /api/chat — OpenAI 兼容聊天接口
    - /api/generate — 原始生成接口
    - /api/embeddings — 向量嵌入
    - /api/tags — 模型列表
    - /api/pull — 拉取模型
    - /api/delete — 删除模型
    """

    # ─── 联邦蒸馏模型映射 ───
    FEDERATED_MODELS = {
        Tier.PROVINCE: {
            "primary": "qwen3:72b",
            "fallback": "deepseek-r1:70b",
            "quantization": "q4_K_M",
            "vram_required": "48GB+",
        },
        Tier.CITY: {
            "primary": "qwen2.5:14b",
            "fallback": "llama3.1:14b",
            "quantization": "q4_K_M",
            "vram_required": "16GB+",
        },
        Tier.COUNTY: {
            "primary": "llama3.1:8b",
            "fallback": "qwen3:7b",
            "quantization": "q4_0",
            "vram_required": "8GB+",
        },
        Tier.TERMINAL: {
            "primary": "phi3:3.8b",
            "fallback": "qwen3:3b",
            "quantization": "q4_0",
            "vram_required": "4GB+",
        },
    }

    def __init__(self, config: Optional[OllamaConfig] = None) -> None:
        self.config = config or OllamaConfig()
        self._http = httpx.AsyncClient(
            timeout=httpx.Timeout(self.config.timeout),
            base_url=self.config.base_url.rstrip("/"),
        )
        self._stats = {
            "requests": 0,
            "tokens_generated": 0,
            "total_latency_ms": 0.0,
            "errors": 0,
        }
        self._distillation_records: list[DistillationRecord] = []
        self._available_models: list[str] = []

    # ─── 核心推理接口 ───────────────────────────────────────

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        stream: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Chat Completion（/api/chat 端点）。

        支持多轮对话，自动管理上下文窗口。

        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            model: 模型名称（默认从 config 读取）
            temperature: 采样温度
            stream: 是否流式输出
            **kwargs: 其他 Ollama 参数

        Returns:
            OpenAI 兼容格式的响应
        """
        model = model or self.config.model
        temperature = temperature if temperature is not None else self.config.temperature

        request_body = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": kwargs.get("num_predict", self.config.num_predict),
                "num_ctx": kwargs.get("num_ctx", self.config.num_ctx),
            },
        }

        start_time = time.time()

        try:
            response = await self._http.post("/api/chat", json=request_body)
            response.raise_for_status()
            data = response.json()

            # 转换为 OpenAI 兼容格式
            result = self._to_openai_format(data, model)

            latency_ms = (time.time() - start_time) * 1000
            self._stats["requests"] += 1
            self._stats["tokens_generated"] += data.get("eval_count", 0)
            self._stats["total_latency_ms"] += latency_ms

            return result

        except httpx.HTTPStatusError as e:
            self._stats["errors"] += 1
            logger.error(f"Ollama chat 失败 [{model}]: HTTP {e.response.status_code}")
            raise RuntimeError(f"Ollama API 错误: {e.response.status_code}") from e
        except httpx.TimeoutException as e:
            self._stats["errors"] += 1
            logger.error(f"Ollama chat 超时 [{model}]: {self.config.timeout}s")
            raise RuntimeError(f"Ollama 推理超时 ({self.config.timeout}s)") from e
        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"Ollama chat 异常 [{model}]: {e}")
            raise RuntimeError(f"Ollama 推理错误: {e}") from e

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        流式 Chat Completion。

        通过 SSE 实时输出生成内容，适用于前端打字机效果。
        """
        model = model or self.config.model
        temperature = temperature if temperature is not None else self.config.temperature

        request_body = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": kwargs.get("num_predict", self.config.num_predict),
            },
        }

        start_time = time.time()
        total_content = ""

        try:
            async with self._http.stream("POST", "/api/chat", json=request_body) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if chunk.get("done"):
                        # 最后一条：包含最终统计
                        total_content = chunk.get("message", {}).get("content", total_content)
                        yield {
                            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
                            "object": "chat.completion.chunk",
                            "model": model,
                            "choices": [{
                                "index": 0,
                                "delta": {},
                                "finish_reason": "stop",
                            }],
                            "usage": {
                                "prompt_tokens": chunk.get("prompt_eval_count", 0),
                                "completion_tokens": chunk.get("eval_count", 0),
                                "total_tokens": (
                                    chunk.get("prompt_eval_count", 0)
                                    + chunk.get("eval_count", 0)
                                ),
                            },
                        }
                        break

                    content = chunk.get("message", {}).get("content", "")
                    total_content += content

                    yield {
                        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
                        "object": "chat.completion.chunk",
                        "model": model,
                        "choices": [{
                            "index": 0,
                            "delta": {"content": content},
                            "finish_reason": None,
                        }],
                    }

        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"Ollama stream_chat 异常: {e}")
            raise

        latency_ms = (time.time() - start_time) * 1000
        self._stats["requests"] += 1
        self._stats["tokens_generated"] += len(total_content)
        self._stats["total_latency_ms"] += latency_ms

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        原始生成接口（/api/generate）。

        适用于单轮生成、代码补全、摘要等场景。
        """
        model = model or self.config.model

        request_body: dict = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("num_predict", self.config.num_predict),
            },
        }
        if system:
            request_body["system"] = system

        try:
            response = await self._http.post("/api/generate", json=request_body)
            response.raise_for_status()
            data = response.json()
            self._stats["requests"] += 1
            self._stats["tokens_generated"] += data.get("eval_count", 0)
            return data
        except Exception as e:
            self._stats["errors"] += 1
            raise RuntimeError(f"Ollama generate 失败: {e}") from e

    async def embeddings(
        self,
        text: str | list[str],
        model: Optional[str] = None,
    ) -> list[list[float]]:
        """
        文本向量嵌入（/api/embeddings）。

        Args:
            text: 单个文本或文本列表
            model: 嵌入模型名称（如 "nomic-embed-text"）

        Returns:
            向量列表，每个向量为 float 列表
        """
        model = model or self.config.model

        texts = [text] if isinstance(text, str) else text
        embeddings: list[list[float]] = []

        for t in texts:
            try:
                response = await self._http.post("/api/embeddings", json={
                    "model": model,
                    "prompt": t,
                })
                response.raise_for_status()
                data = response.json()
                embeddings.append(data.get("embedding", []))
            except Exception as e:
                self._stats["errors"] += 1
                raise RuntimeError(f"Ollama embeddings 失败: {e}") from e

        return embeddings

    # ─── 模型管理 ───────────────────────────────────────

    async def list_models(self) -> list[dict[str, Any]]:
        """列出已安装的本地模型。"""
        try:
            response = await self._http.get("/api/tags")
            response.raise_for_status()
            data = response.json()
            models = data.get("models", [])
            self._available_models = [m.get("name", "") for m in models]
            return models
        except Exception as e:
            logger.error(f"获取模型列表失败: {e}")
            return []

    async def pull_model(
        self,
        model_name: str,
        insecure: bool = False,
    ) -> AsyncGenerator[dict, None]:
        """
        从 Ollama 模型库拉取模型（支持流式进度）。

        Args:
            model_name: 模型名称（如 "qwen3:14b"）
            insecure: 是否允许非安全连接

        Yields:
            拉取进度状态字典
        """
        try:
            async with self._http.stream("POST", "/api/pull", json={
                "name": model_name,
                "insecure": insecure,
                "stream": True,
            }) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            yield json.loads(line)
                        except json.JSONDecodeError:
                            pass
        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"模型拉取失败 [{model_name}]: {e}")
            raise

    async def delete_model(self, model_name: str) -> bool:
        """删除本地模型。"""
        try:
            response = await self._http.request("DELETE", "/api/delete", json={
                "name": model_name,
            })
            response.raise_for_status()
            if model_name in self._available_models:
                self._available_models.remove(model_name)
            logger.info(f"模型已删除: {model_name}")
            return True
        except Exception as e:
            logger.error(f"模型删除失败 [{model_name}]: {e}")
            return False

    async def copy_model(self, source: str, destination: str) -> bool:
        """复制模型。"""
        try:
            response = await self._http.post("/api/copy", json={
                "source": source,
                "destination": destination,
            })
            response.raise_for_status()
            self._available_models.append(destination)
            logger.info(f"模型已复制: {source} → {destination}")
            return True
        except Exception as e:
            logger.error(f"模型复制失败 [{source}→{destination}]: {e}")
            return False

    # ─── 联邦蒸馏 ───────────────────────────────────────

    async def distill(
        self,
        prompt: str,
        teacher_model: Optional[str] = None,
        student_model: Optional[str] = None,
    ) -> DistillationRecord:
        """
        联邦蒸馏：用教师模型生成高质量输出，用于训练学生模型。

        流程：
        1. Teacher (72B) 生成参考答案
        2. Student (14B) 生成预测
        3. 计算质量分数（语义相似度 + 格式合规）
        4. 存储蒸馏数据供后续微调使用
        """
        teacher = teacher_model or self.config.teacher_model
        student = student_model or self.config.model

        # 1. 教师模型生成
        teacher_resp = await self.chat(
            [{"role": "user", "content": prompt}],
            model=teacher,
            temperature=0.3,  # 低温度保证质量
        )

        teacher_output = ""
        if teacher_resp.get("choices"):
            teacher_output = teacher_resp["choices"][0]["message"]["content"]

        # 2. 学生模型生成
        student_resp = await self.chat(
            [{"role": "user", "content": prompt}],
            model=student,
            temperature=0.3,
        )

        student_output = ""
        if student_resp.get("choices"):
            student_output = student_resp["choices"][0]["message"]["content"]

        # 3. 计算质量分数
        quality_score = self._compute_quality(teacher_output, student_output)

        record = DistillationRecord(
            id=f"distill-{uuid.uuid4().hex[:8]}",
            prompt=prompt,
            teacher_output=teacher_output,
            student_output=student_output,
            quality_score=quality_score,
        )

        self._distillation_records.append(record)

        logger.info(
            f"[蒸馏] {teacher} → {student} | "
            f"质量分数: {quality_score:.2f} | "
            f"教师输出 {len(teacher_output)} chars → 学生输出 {len(student_output)} chars"
        )

        return record

    def _compute_quality(self, teacher: str, student: str) -> float:
        """
        计算蒸馏质量分数。

        评估维度：
        - 长度比（0~30分）：学生输出与教师输出长度接近度
        - 关键词覆盖（0~30分）：关键术语匹配度
        - 结构合规（0~20分）：输出格式规范
        - 内容相关性（0~20分）：基本语义对齐
        """
        score = 0.0

        # 长度比
        if teacher:
            len_ratio = min(len(student) / len(teacher), 1.5)
            score += min(len_ratio * 30, 30)

        # 关键词覆盖（提取教师输出的特征词）
        teacher_words = set(teacher.split()) if teacher else set()
        student_words = set(student.split()) if student else set()
        if teacher_words:
            overlap = len(teacher_words & student_words) / len(teacher_words)
            score += overlap * 30

        # 结构合规
        if "**" in student or "###" in student:
            score += 15
        if len(student) > 50:
            score += 5

        # 内容相关性（基本启发式）
        if teacher and student:
            # 检查是否包含相似的数字/日期等结构化信息
            import re
            t_nums = set(re.findall(r'\d+', teacher))
            s_nums = set(re.findall(r'\d+', student))
            if t_nums:
                num_overlap = len(t_nums & s_nums) / len(t_nums)
                score += num_overlap * 20

        return min(score, 100.0)

    def export_distillation_data(self) -> list[dict]:
        """导出蒸馏数据用于离线训练。"""
        return [
            {
                "id": r.id,
                "prompt": r.prompt,
                "teacher_output": r.teacher_output,
                "student_output": r.student_output,
                "quality_score": r.quality_score,
                "timestamp": r.timestamp,
            }
            for r in self._distillation_records
        ]

    # ─── 模型基准测试 ───────────────────────────────────────

    async def benchmark(
        self,
        model: Optional[str] = None,
        num_runs: int = 5,
        prompt: str = "请用中文简要介绍湖南省的生态环境保护政策。",
    ) -> dict[str, Any]:
        """
        模型推理性能基准测试。

        Args:
            model: 模型名称
            num_runs: 测试次数
            prompt: 测试提示词

        Returns:
            基准测试结果（延迟、吞吐量、内存等）
        """
        model = model or self.config.model

        latencies: list[float] = []
        tokens_per_second: list[float] = []
        errors = 0

        for i in range(num_runs):
            try:
                start = time.time()
                response = await self.chat(
                    [{"role": "user", "content": prompt}],
                    model=model,
                    temperature=0.0,
                )
                elapsed = time.time() - start
                latencies.append(elapsed)

                # 估算 tokens/s
                usage = response.get("usage", {})
                total_tokens = usage.get("total_tokens", 0)
                if elapsed > 0:
                    tokens_per_second.append(total_tokens / elapsed)

                logger.info(f"[Benchmark {i+1}/{num_runs}] {elapsed:.2f}s, {total_tokens} tokens")

            except Exception as e:
                errors += 1
                logger.error(f"[Benchmark {i+1}/{num_runs}] 失败: {e}")

        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        avg_tps = sum(tokens_per_second) / len(tokens_per_second) if tokens_per_second else 0

        return {
            "model": model,
            "tier": self.config.tier.value,
            "runs": num_runs,
            "errors": errors,
            "avg_latency_s": round(avg_latency, 3),
            "min_latency_s": round(min(latencies), 3) if latencies else 0,
            "max_latency_s": round(max(latencies), 3) if latencies else 0,
            "avg_tokens_per_sec": round(avg_tps, 1),
            "total_runs_ok": len(latencies),
        }

    # ─── 工具方法 ───────────────────────────────────────

    async def check_health(self) -> dict[str, Any]:
        """检查 Ollama 服务健康状态。"""
        try:
            response = await self._http.get("/api/tags")
            models = response.json().get("models", [])
            return {
                "status": "healthy",
                "ollama_url": self.config.base_url,
                "model_count": len(models),
                "available_models": [m.get("name") for m in models[:10]],
                "stats": self._stats,
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "ollama_url": self.config.base_url,
                "error": str(e),
            }

    def _to_openai_format(self, data: dict, model: str) -> dict[str, Any]:
        """将 Ollama 响应转换为 OpenAI 兼容格式。"""
        message = data.get("message", {})
        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": data.get("model", model),
            "choices": [{
                "index": 0,
                "message": {
                    "role": message.get("role", "assistant"),
                    "content": message.get("content", ""),
                },
                "finish_reason": "stop" if data.get("done", True) else None,
            }],
            "usage": {
                "prompt_tokens": data.get("prompt_eval_count", 0),
                "completion_tokens": data.get("eval_count", 0),
                "total_tokens": (
                    data.get("prompt_eval_count", 0)
                    + data.get("eval_count", 0)
                ),
            },
            "done_reason": data.get("done_reason", "stop"),
            "total_duration_ms": data.get("total_duration", 0) / 1_000_000,
            "load_duration_ms": data.get("load_duration", 0) / 1_000_000,
        }

    def get_stats(self) -> dict[str, Any]:
        """获取推理统计信息。"""
        avg_latency = (
            self._stats["total_latency_ms"] / max(self._stats["requests"], 1)
        )
        return {
            "model": self.config.model,
            "tier": self.config.tier.value,
            "ollama_url": self.config.base_url,
            "distillation_records": len(self._distillation_records),
            **self._stats,
            "avg_latency_ms": round(avg_latency, 2),
        }

    async def close(self) -> None:
        """关闭 HTTP 客户端。"""
        await self._http.aclose()


# ─── 快速启动函数 ───────────────────────────────────────


async def create_ollama_adapter(
    tier: Tier = Tier.CITY,
    base_url: str = "http://localhost:11434",
) -> OllamaAdapter:
    """
    按层级创建 Ollama 适配器。

    示例:
        # 省级（72B）
        adapter = await create_ollama_adapter(Tier.PROVINCE)

        # 市级（14B）
        adapter = await create_ollama_adapter(Tier.CITY)

        # 县级（7B）
        adapter = await create_ollama_adapter(Tier.COUNTY)
    """
    config = OllamaConfig(
        base_url=base_url,
        model=OllamaAdapter.FEDERATED_MODELS[tier]["primary"],
        tier=tier,
    )
    return OllamaAdapter(config)
