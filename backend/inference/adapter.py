"""
EcomodelAdapter — 非 OpenAI-compatible 国产模型适配器

适配需要特殊 header、请求格式或 token 计数方式的国产模型 API。
支持通义千问(DashScope)、文心一言等非标准 OpenAI 格式的 API。
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Optional

import httpx

logger = logging.getLogger(__name__)


# 错误码映射：国产模型 API 错误码 → OpenAI 标准错误码
ERROR_CODE_MAP: dict[str, str] = {
    # 通义千问 DashScope 错误码
    "InvalidApiKey": "invalid_api_key",
    "InsufficientQuota": "insufficient_quota",
    "RateLimitExceeded": "rate_limit_exceeded",
    "ModelNotFound": "model_not_found",
    "InternalError": "server_error",
    "ServiceUnavailable": "server_error",
    "Throttling": "rate_limit_exceeded",
    "DataInspectionFailed": "content_filter",
    # 文心一言错误码
    "110": "invalid_api_key",
    "111": "invalid_api_key",
    "336": "rate_limit_exceeded",
    "1000": "server_error",
    "2002": "insufficient_quota",
    # 智谱 GLM 错误码
    "1001": "rate_limit_exceeded",
    "1002": "insufficient_quota",
    "1003": "invalid_api_key",
    "1004": "content_filter",
}


@dataclass
class AdapterConfig:
    """适配器配置"""
    provider: str
    api_base: str
    api_key: str
    model_name: str
    timeout: float = 60.0
    max_retries: int = 3
    extra_headers: dict[str, str] = field(default_factory=dict)
    request_transform: str = "openai"  # openai | dashscope | wenxin | zhipu
    response_transform: str = "openai"  # openai | dashscope | wenxin | zhipu


@dataclass
class TokenCountResult:
    """Token 计数结果"""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class EcomodelAdapter:
    """
    国产模型适配器

    为非 OpenAI-compatible 的国产模型 API 提供统一适配层：
    - 请求格式转换（OpenAI → 目标 API 格式）
    - 响应格式转换（目标 API → OpenAI 格式）
    - 特殊 header 处理（如 DashScope Authorization）
    - 错误码映射
    - Token 计数差异处理
    - Rate Limit 感知
    """

    def __init__(self, config: AdapterConfig) -> None:
        self.config = config
        self._request_count: int = 0
        self._error_count: int = 0
        self._total_latency_ms: float = 0.0
        self._rate_limit_remaining: dict[str, int] = {}

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        发送聊天请求并返回 OpenAI 兼容格式的响应。

        流程：
        1. 将 OpenAI 格式消息转换为目标 API 格式
        2. 构建请求（添加特殊 header）
        3. 发送请求
        4. 转换响应为 OpenAI 格式
        5. 处理错误码映射

        Args:
            messages: OpenAI 格式消息列表
            model: 模型名称（覆盖配置中的默认值）
            temperature: 生成温度
            max_tokens: 最大 token 数
            stream: 是否流式
            **kwargs: 其他参数

        Returns:
            OpenAI 兼容格式的响应字典
        """
        model = model or self.config.model_name
        start_time = time.time()

        # 转换请求格式
        request_body = self._transform_request(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
            **kwargs,
        )

        # 构建请求头
        headers = self._build_headers()

        # 发送请求（带重试）
        response_data = await self._send_with_retry(
            headers=headers,
            body=request_body,
            stream=stream,
        )

        # 转换响应格式
        openai_response = self._transform_response(response_data, model)

        # 更新统计
        latency_ms = (time.time() - start_time) * 1000
        self._request_count += 1
        self._total_latency_ms += latency_ms

        return openai_response

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        流式聊天请求，返回 OpenAI 兼容格式的 SSE 数据块。

        Args:
            messages: OpenAI 格式消息列表
            model: 模型名称
            temperature: 生成温度
            max_tokens: 最大 token 数

        Yields:
            OpenAI 兼容格式的流式数据块
        """
        model = model or self.config.model_name

        request_body = self._transform_request(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs,
        )

        headers = self._build_headers()
        headers["Accept"] = "text/event-stream"

        url = self._get_endpoint()

        try:
            async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                async with client.stream("POST", url, json=request_body, headers=headers) as response:
                    if response.status_code != 200:
                        error_body = await response.aread()
                        error_data = json.loads(error_body) if error_body else {}
                        mapped_error = self._map_error_code(error_data)
                        raise RuntimeError(f"Stream request failed: {mapped_error}")

                    async for line in response.aiter_lines():
                        if not line or line.startswith(":"):
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                yield {"choices": [], "finish_reason": "stop"}
                                break
                            try:
                                chunk = json.loads(data_str)
                                openai_chunk = self._transform_stream_chunk(chunk, model)
                                yield openai_chunk
                            except json.JSONDecodeError:
                                continue

        except httpx.HTTPStatusError as e:
            self._error_count += 1
            raise RuntimeError(f"HTTP error: {e.response.status_code}") from e
        except Exception as e:
            self._error_count += 1
            raise RuntimeError(f"Stream error: {e}") from e

    def count_tokens(self, text: str, model: Optional[str] = None) -> TokenCountResult:
        """
        估算 token 数量。

        不同国产模型的 tokenizer 不同，这里提供近似估算。
        对于精确计数，应使用各模型的官方 tokenizer。

        估算规则：
        - 中文：1 字 ≈ 1.5 token
        - 英文：1 词 ≈ 1.3 token（按空格分词）
        - 代码：1 字符 ≈ 0.3 token

        Args:
            text: 待计数文本
            model: 模型名称（不同模型可能有不同计数方式）

        Returns:
            Token 计数结果
        """
        # 简化估算
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        total_chars = len(text)
        english_chars = total_chars - chinese_chars

        # 中文字符按 1.5 token，英文按 0.25 token 估算
        estimated_tokens = int(chinese_chars * 1.5 + english_chars * 0.25)

        return TokenCountResult(
            prompt_tokens=estimated_tokens,
            completion_tokens=0,
            total_tokens=estimated_tokens,
        )

    def get_stats(self) -> dict[str, Any]:
        """获取适配器统计信息。"""
        avg_latency = self._total_latency_ms / max(self._request_count, 1)
        return {
            "provider": self.config.provider,
            "model": self.config.model_name,
            "request_count": self._request_count,
            "error_count": self._error_count,
            "avg_latency_ms": round(avg_latency, 2),
            "rate_limit_remaining": self._rate_limit_remaining,
        }

    def _transform_request(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        stream: bool,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """将 OpenAI 格式请求转换为目标 API 格式。"""
        transform = self.config.request_transform

        if transform == "openai":
            # 标准 OpenAI 格式，无需转换
            return {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream,
                **kwargs,
            }
        elif transform == "dashscope":
            # 通义千问 DashScope 格式
            return {
                "model": model,
                "input": {
                    "messages": messages,
                },
                "parameters": {
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "result_format": "message",
                    "incremental_output": stream,
                },
            }
        elif transform == "wenxin":
            # 文心一言格式（需要单独的 access_token）
            return {
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream,
            }
        elif transform == "zhipu":
            # 智谱 GLM 格式（与 OpenAI 基本兼容）
            return {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream,
                **kwargs,
            }
        else:
            # 默认使用 OpenAI 格式
            return {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream,
            }

    def _transform_response(self, response_data: dict[str, Any], model: str) -> dict[str, Any]:
        """将目标 API 响应转换为 OpenAI 兼容格式。"""
        transform = self.config.response_transform

        if transform == "openai":
            return response_data
        elif transform == "dashscope":
            return self._dashscope_to_openai(response_data, model)
        elif transform == "wenxin":
            return self._wenxin_to_openai(response_data, model)
        elif transform == "zhipu":
            return self._zhipu_to_openai(response_data, model)
        else:
            return response_data

    def _dashscope_to_openai(self, data: dict[str, Any], model: str) -> dict[str, Any]:
        """通义千问 DashScope 响应 → OpenAI 格式。"""
        output = data.get("output", {})
        usage = data.get("usage", {})

        content = ""
        choices = []
        if "choices" in output:
            for choice in output["choices"]:
                message = choice.get("message", {})
                content = message.get("content", "")
                choices.append({
                    "index": choice.get("index", 0),
                    "message": {
                        "role": message.get("role", "assistant"),
                        "content": content,
                    },
                    "finish_reason": choice.get("finish_reason", "stop"),
                })
        elif "text" in output:
            content = output["text"]
            choices = [{
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }]

        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": choices,
            "usage": {
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
        }

    def _wenxin_to_openai(self, data: dict[str, Any], model: str) -> dict[str, Any]:
        """文心一言响应 → OpenAI 格式。"""
        result = data.get("result", "")
        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": result},
                "finish_reason": "stop" if data.get("is_end", True) else None,
            }],
            "usage": {
                "prompt_tokens": data.get("prompt_tokens", 0),
                "completion_tokens": data.get("completion_tokens", 0),
                "total_tokens": data.get("total_tokens", 0),
            },
        }

    def _zhipu_to_openai(self, data: dict[str, Any], model: str) -> dict[str, Any]:
        """智谱 GLM 响应 → OpenAI 格式（基本兼容，少量字段映射）。"""
        if "choices" in data:
            # 已是 OpenAI 格式
            data.setdefault("id", f"chatcmpl-{uuid.uuid4().hex[:12]}")
            data.setdefault("object", "chat.completion")
            data.setdefault("model", model)
            return data

        content = data.get("content", "")
        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }],
            "usage": data.get("usage", {}),
        }

    def _transform_stream_chunk(self, chunk: dict[str, Any], model: str) -> dict[str, Any]:
        """将流式数据块转换为 OpenAI 格式。"""
        transform = self.config.response_transform

        if transform == "openai" or "choices" in chunk:
            chunk.setdefault("model", model)
            return chunk

        # DashScope 流式
        if "output" in chunk:
            output = chunk["output"]
            text = output.get("text", "")
            finish_reason = "stop" if output.get("finish_reason") == "stop" else None
            return {
                "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {"content": text},
                    "finish_reason": finish_reason,
                }],
            }

        # 默认处理
        content = chunk.get("content", chunk.get("text", ""))
        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "delta": {"content": content},
                "finish_reason": None,
            }],
        }

    def _build_headers(self) -> dict[str, str]:
        """构建请求头，根据不同 provider 添加特殊 header。"""
        headers: dict[str, str] = {
            "Content-Type": "application/json",
        }

        provider = self.config.provider.lower()

        if provider == "qwen" or provider == "dashscope":
            # 通义千问使用 Bearer token
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        elif provider == "wenxin":
            # 文心一言使用 access_token（需要先用 API Key 换取）
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        elif provider == "zhipu" or provider == "glm":
            # 智谱 GLM 使用 Bearer token
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        else:
            headers["Authorization"] = f"Bearer {self.config.api_key}"

        # 添加额外自定义 header
        headers.update(self.config.extra_headers)

        return headers

    def _get_endpoint(self) -> str:
        """获取 API 端点 URL。"""
        api_base = self.config.api_base.rstrip("/")
        return f"{api_base}/chat/completions"

    async def _send_with_retry(
        self,
        headers: dict[str, str],
        body: dict[str, Any],
        stream: bool = False,
    ) -> dict[str, Any]:
        """带重试的请求发送。"""
        url = self._get_endpoint()
        last_error: Optional[Exception] = None

        for attempt in range(self.config.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                    response = await client.post(url, json=body, headers=headers)

                    # 处理 rate limit
                    remaining = response.headers.get("x-ratelimit-remaining")
                    if remaining:
                        self._rate_limit_remaining["default"] = int(remaining)

                    if response.status_code == 429:
                        # Rate limit — 指数退避
                        wait_time = 2 ** attempt
                        logger.warning(f"Rate limit hit, 等待 {wait_time}s 后重试...")
                        await asyncio.sleep(wait_time)
                        continue

                    if response.status_code >= 500:
                        # 服务端错误 — 短暂等待后重试
                        wait_time = 1 * (attempt + 1)
                        logger.warning(f"服务端错误 {response.status_code}, 等待 {wait_time}s 后重试...")
                        await asyncio.sleep(wait_time)
                        continue

                    response.raise_for_status()
                    return response.json()

            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(f"请求超时 (attempt {attempt + 1}/{self.config.max_retries})")
            except httpx.HTTPStatusError as e:
                last_error = e
                self._error_count += 1
                raise RuntimeError(f"HTTP {e.response.status_code}: {e.response.text}") from e
            except Exception as e:
                last_error = e
                logger.error(f"请求异常 (attempt {attempt + 1}): {e}")

        self._error_count += 1
        raise RuntimeError(f"请求失败，已重试 {self.config.max_retries} 次: {last_error}")

    def _map_error_code(self, error_data: dict[str, Any]) -> str:
        """将国产模型错误码映射为 OpenAI 标准错误码。"""
        # 尝试多种错误码字段
        code = (
            error_data.get("code")
            or error_data.get("error_code")
            or error_data.get("error", {}).get("code", "")
        )
        code_str = str(code)
        return ERROR_CODE_MAP.get(code_str, code_str or "unknown_error")
