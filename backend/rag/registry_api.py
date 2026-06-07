"""
EcoMind RAG — FastAPI REST 端点

端点:
  POST /api/rag/search     — 混合检索（语义 + 关键词）
  POST /api/rag/ask        — 法规 RAG 问答
  POST /api/rag/ingest     — 触发向量注入
  GET  /api/rag/status     — 向量库状态
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rag", tags=["RAG"])


# ── Schema ──

class SearchRequest(BaseModel):
    query: str = Field(..., description="搜索查询（自然语言）")
    top_k: int = Field(default=10, ge=1, le=50)
    law_level: Optional[str] = Field(default=None, description="法规层级: national / provincial / city")
    category: Optional[str] = Field(default=None, description="分类: 大气 / 水 / 固废 / 环评 / ...")
    penalty_only: bool = Field(default=False, description="只看含处罚条款的")


class SearchResult(BaseModel):
    chunk_id: str
    text: str
    law_name: str
    article: str
    score: float
    source: str
    category: str
    publish_time: str


class SearchResponse(BaseModel):
    query: str
    total_hits: int
    results: list[SearchResult]


class AskRequest(BaseModel):
    question: str = Field(..., description="法规问题")
    context_limit: int = Field(default=5, ge=1, le=20)
    law_level: Optional[str] = None
    category: Optional[str] = None


class AskResponse(BaseModel):
    question: str
    answer: str
    citations: list[dict]


class IngestRequest(BaseModel):
    source: str = Field(default="hunan_policy", description="数据源: hunan_policy / national_standards")
    section: Optional[str] = None
    limit: Optional[int] = None


# ── 端点 ──

@router.post("/search", response_model=SearchResponse)
async def semantic_search(req: SearchRequest):
    """混合语义搜索——同时用向量和关键词检索，RRF 融合结果"""
    try:
        from rag.retriever import HybridRetriever
    except ImportError as e:
        raise HTTPException(500, f"RAG 检索引擎未初始化: {e}")

    filters = {}
    if req.law_level:
        filters["law_level"] = req.law_level
    if req.category:
        filters["category"] = req.category

    retriever = HybridRetriever.get_instance()
    hits = await retriever.search(req.query, top_k=req.top_k, filters=filters)

    results = []
    for h in hits:
        meta = h.get("metadata", {})
        results.append(SearchResult(
            chunk_id=h.get("id", ""),
            text=h.get("text", ""),
            law_name=meta.get("law_name", ""),
            article=meta.get("article", ""),
            score=h.get("score", h.get("rrf_score", 0)),
            source=h.get("source", h.get("matched_from", [""])[0] if h.get("matched_from") else ""),
            category=meta.get("category", ""),
            publish_time=meta.get("publish_time", ""),
        ))

    return SearchResponse(query=req.query, total_hits=len(results), results=results)


@router.post("/ask", response_model=AskResponse)
async def rag_ask(req: AskRequest):
    """RAG 法规问答——检索相关法条 → LLM 生成回答"""
    try:
        from rag.retriever import HybridRetriever
    except ImportError as e:
        raise HTTPException(500, f"RAG 引擎未初始化: {e}")

    filters = {}
    if req.law_level:
        filters["law_level"] = req.law_level
    if req.category:
        filters["category"] = req.category

    retriever = HybridRetriever.get_instance()
    hits = await retriever.search(req.question, top_k=req.context_limit, filters=filters)

    if not hits:
        return AskResponse(
            question=req.question,
            answer="未找到相关法规。请尝试更具体的查询。",
            citations=[],
        )

    # 构建 LLM 上下文
    context_parts = []
    citations = []
    for h in hits:
        meta = h.get("metadata", {})
        context_parts.append(
            f"【{meta.get('law_name', '')} {meta.get('article', '')}】\n{h.get('text', '')}"
        )
        citations.append({
            "law_name": meta.get("law_name", ""),
            "article": meta.get("article", ""),
            "excerpt": h.get("text", "")[:200],
            "score": h.get("score", h.get("rrf_score", 0)),
        })

    context = "\n\n".join(context_parts)
    system_prompt = (
        "你是 EcoMind 生态环境法规专家。请严格依据以下法规条文回答问题。"
        "如果法条中没有相关信息，请明确说明。\n\n"
        f"相关法规条文:\n{context}"
    )

    # 调用 LLM
    try:
        import httpx
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "http://localhost:8000/deepseek/v1/chat/completions",
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": req.question},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2048,
                    "stream": False,
                },
            )
            data = resp.json()
            answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        answer = f"法规检索完成，但 LLM 生成回答时出错: {e}"

    return AskResponse(question=req.question, answer=answer, citations=citations)


@router.post("/ingest")
async def ingest_policies(req: IngestRequest = IngestRequest()):
    """触发法规向量注入"""
    try:
        from rag.ingestion import ingest_hunan_policies
    except ImportError as e:
        raise HTTPException(500, f"RAG 注入引擎未初始化: {e}")

    result = await ingest_hunan_policies(
        section=req.section,
        limit=req.limit,
    )
    return result


@router.get("/status")
async def rag_status():
    """向量库状态"""
    try:
        from rag.retriever import HybridRetriever
        from rag.vector_store import VectorStore

        retriever = HybridRetriever.get_instance()
        store = VectorStore.get_instance()

        return {
            "vector_store": store.status(),
            "embedding": retriever.status().get("embedding", {}),
            "reranker_loaded": retriever.status().get("reranker_loaded", False),
            "fts5_source": "hunan_policies.db" if retriever.status().get("fts5_db") else None,
        }
    except ImportError as e:
        return {"status": "not_initialized", "error": str(e)}
