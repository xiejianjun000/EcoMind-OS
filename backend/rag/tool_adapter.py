"""
EcoMind RAG — 注册到 EcoToolRegistry

将 RAG 能力暴露为 Agent 可调用的工具：
  - regulatory_search — 法规语义搜索
  - regulatory_ask   — 法规 RAG 问答

Usage:
    from rag.tool_adapter import register_rag_tools
    register_rag_tools(registry)
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


async def _regulatory_search_handler(params: dict) -> str:
    """工具处理器: 法规语义搜索"""
    query = params.get("query", "")
    limit = min(params.get("limit", 5), 20)
    category = params.get("category", "")

    from rag.retriever import HybridRetriever

    filters = {}
    if category:
        filters["category"] = category

    retriever = HybridRetriever.get_instance()
    results = await retriever.search(query, top_k=limit, filters=filters)

    if not results:
        return json.dumps({"hits": 0, "message": "未找到相关法规"}, ensure_ascii=False)

    formatted = []
    for r in results:
        meta = r.get("metadata", {})
        formatted.append({
            "law": meta.get("law_name", ""),
            "article": meta.get("article", ""),
            "excerpt": r.get("text", "")[:300],
            "category": meta.get("category", ""),
            "score": r.get("score", r.get("rrf_score", 0)),
        })

    return json.dumps({"hits": len(formatted), "results": formatted}, ensure_ascii=False)


async def _regulatory_ask_handler(params: dict) -> str:
    """工具处理器: 法规 RAG 问答"""
    question = params.get("question", "")
    limit = min(params.get("limit", 5), 10)

    from rag.retriever import HybridRetriever
    retriever = HybridRetriever.get_instance()
    hits = await retriever.search(question, top_k=limit)

    if not hits:
        return "未找到相关法规条文。"

    context = "\n\n".join([
        f"【{h.get('metadata', {}).get('law_name', '')} "
        f"{h.get('metadata', {}).get('article', '')}】{h.get('text', '')}"
        for h in hits
    ])

    try:
        import httpx
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "http://localhost:8000/deepseek/v1/chat/completions",
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": f"根据以下法规回答问题:\n{context}"},
                        {"role": "user", "content": question},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1024,
                },
            )
            data = resp.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "生成回答失败")
    except Exception as e:
        return f"法规检索完成，但回答生成失败: {e}"


def register_rag_tools(registry) -> None:
    """向 EcoToolRegistry 注册 RAG 工具"""
    from engine.tool_registry import EcoTool

    registry.register(EcoTool(
        name="regulatory_search",
        description=(
            "搜索生态环境法规。根据自然语言查询找到最相关的法律条文。"
            "支持按领域过滤（大气/水/固废/环评/土壤/噪声/核安全/生态保护）。"
            "示例: regulatory_search(query='废气排放标准', category='大气')"
        ),
        handler=_regulatory_search_handler,
        category="regulation",
        requires_approval=False,
        permission_level=1,
        parameters={
            "query": {"type": "string", "description": "自然语言搜索查询"},
            "limit": {"type": "integer", "description": "返回条数（默认5）"},
            "category": {"type": "string", "description": "法规领域过滤"},
        },
    ))

    registry.register(EcoTool(
        name="regulatory_ask",
        description=(
            "法规问答。基于现行法规回答生态环境法律问题，自动引用相关法条。"
            "示例: regulatory_ask(question='化工厂排放超标如何处罚')"
        ),
        handler=_regulatory_ask_handler,
        category="regulation",
        requires_approval=False,
        permission_level=1,
        parameters={
            "question": {"type": "string", "description": "法规问题"},
            "limit": {"type": "integer", "description": "检索法条数量（默认5）"},
        },
    ))

    logger.info("RAG 工具已注册: regulatory_search, regulatory_ask")
