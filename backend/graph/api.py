"""知识图谱 REST API"""
from __future__ import annotations

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/graph", tags=["Knowledge Graph"])


@router.get("/subgraph")
async def get_subgraph(
    session_id: str = Query(default="", description="会话ID"),
    user_id: str = Query(default="", description="用户ID"),
):
    """获取指定会话/用户的子图（供右侧KnowledgeView展示）"""
    from graph.engine import get_graph_engine
    g = get_graph_engine()
    return g.get_subgraph(session_id=session_id, user_id=user_id)


@router.get("/stats")
async def get_stats():
    """知识图谱统计"""
    from graph.engine import get_graph_engine
    return get_graph_engine().get_stats()


@router.post("/rebuild-layer1")
async def rebuild_layer1():
    """手动触发 Layer 1 重建"""
    from graph.engine import get_graph_engine
    from rag.chunker import LegalChunker
    from rag.embeddings import EmbeddingEngine
    import sqlite3
    from pathlib import Path

    db = Path(__file__).resolve().parent.parent / "data" / "hunan_policies.db"
    if not db.exists():
        return {"error": "hunan_policies.db 不存在，请先执行 /api/rag/ingest"}

    conn = sqlite3.connect(str(db))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT article_id, title, content FROM articles WHERE content IS NOT NULL AND content != '' LIMIT 500"
    ).fetchall()
    conn.close()

    g = get_graph_engine()
    chunker = LegalChunker()
    chunks = []
    for r in rows:
        for c in chunker.chunk_document(r["title"] or "", r["content"] or ""):
            chunks.append({"chunk_id": c.chunk_id, "text": c.text, "metadata": c.metadata})

    result = g.build_layer1_bulk(chunks)
    return {**result, "documents_processed": len(rows)}
