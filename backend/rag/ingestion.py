"""
EcoMind RAG — 法规数据注入流水线

从 hunan_policies.db (SQLite) 读取已爬取的法规，
分块 → embedding → 写入 ChromaDB。

Usage:
    from rag.ingestion import ingest_hunan_policies
    result = await ingest_hunan_policies()
    # → {chunked: 4521, embedded: 4521, duration_sec: 34.5}
"""
from __future__ import annotations

import logging
import sqlite3
import time
from pathlib import Path
from typing import Optional

from rag.chunker import LegalChunker
from rag.embeddings import EmbeddingEngine
from rag.vector_store import VectorStore

logger = logging.getLogger(__name__)

FTS5_DB = Path(__file__).resolve().parent.parent / "data" / "hunan_policies.db"


async def ingest_hunan_policies(
    section: Optional[str] = None,
    limit: Optional[int] = None,
    batch_size: int = 32,
) -> dict:
    """
    从 hunan_policies.db 读取法规 → 分块 → embedding → 写入 ChromaDB。

    Args:
        section: 只处理指定板块 (gfxwj / zcfgjd / tzgg_tz / zxdt / hjyw)
        limit: 最大处理条数 (调试用)
        batch_size: embedding 批处理大小

    Returns:
        {chunked: N, embedded: N, errors: [...], duration_sec: ...}
    """
    t0 = time.time()
    chunker = LegalChunker()
    embedder = EmbeddingEngine.get_instance()
    store = VectorStore.get_instance()

    # 1. 从 SQLite 读取法规
    conn = sqlite3.connect(str(FTS5_DB))
    conn.row_factory = sqlite3.Row
    sql = "SELECT article_id, title, content, publish_time, section FROM articles WHERE content IS NOT NULL AND content != ''"
    params: list = []
    if section:
        sql += " AND section = ?"
        params.append(section)
    if limit:
        sql += " LIMIT ?"
        params.append(limit)

    rows = conn.execute(sql, params).fetchall()
    conn.close()

    logger.info("读取 %d 篇法规文档", len(rows))

    errors: list[str] = []
    total_chunked = 0
    total_embedded = 0

    # 2. 逐篇分块 + 批量 embedding
    batch_texts: list[str] = []
    batch_chunks: list[dict] = []

    section_map = {
        "gfxwj": "规范性文件", "zcfgjd": "政策解读",
        "tzgg_tz": "通知", "tzgg_gg": "公告",
        "zxdt": "环保动态", "hjyw": "环境要闻",
    }

    for row in rows:
        try:
            title = row["title"] or "未命名"
            content = row["content"] or ""
            pub_time = row["publish_time"] or ""
            sec = row["section"] or ""

            chunks = chunker.chunk_document(
                title=title,
                content=content,
                metadata={
                    "law_level": "provincial",
                    "category": section_map.get(sec, sec),
                    "section": sec,
                    "publish_time": pub_time,
                    "source": "hunan_policy",
                    "article_id": row["article_id"],
                },
            )

            for c in chunks:
                batch_texts.append(c.text)
                c.metadata["text"] = c.text  # 存入 metadata 供检索展示
                batch_chunks.append({
                    "chunk_id": c.chunk_id,
                    "text": c.text,
                    "metadata": c.metadata,
                })
                total_chunked += 1

                if len(batch_texts) >= batch_size:
                    try:
                        embeddings = embedder.embed(batch_texts)
                        store.add_chunks(batch_chunks, embeddings)
                        total_embedded += len(batch_chunks)
                        # Layer 1 知识图谱: 法规引用链
                        try:
                            from graph.engine import get_graph_engine
                            get_graph_engine().build_layer1_bulk(batch_chunks)
                        except Exception:
                            pass
                    except Exception as e:
                        errors.append(f"embed batch error: {e}")
                    batch_texts = []
                    batch_chunks = []

        except Exception as e:
            errors.append(f"{title}: {e}")

    # 3. 处理最后一批
    if batch_texts:
        try:
            embeddings = embedder.embed(batch_texts)
            store.add_chunks(batch_chunks, embeddings)
            total_embedded += len(batch_chunks)
            try:
                from graph.engine import get_graph_engine
                get_graph_engine().build_layer1_bulk(batch_chunks)
            except Exception:
                pass
        except Exception as e:
            errors.append(f"final batch error: {e}")

    duration = round(time.time() - t0, 1)

    result = {
        "chunked": total_chunked,
        "embedded": total_embedded,
        "documents": len(rows),
        "errors": errors,
        "duration_sec": duration,
    }

    logger.info(
        "注入完成: %d 篇 → %d chunks, 耗时 %.1fs, 错误 %d",
        len(rows), total_embedded, duration, len(errors),
    )
    return result


async def ingest_text(
    title: str,
    content: str,
    metadata: Optional[dict] = None,
) -> int:
    """注入单篇文本（用于 PDF/Word 上传后）"""
    chunker = LegalChunker()
    embedder = EmbeddingEngine.get_instance()
    store = VectorStore.get_instance()

    chunks = chunker.chunk_document(title=title, content=content, metadata=metadata)
    if not chunks:
        return 0

    texts = [c.text for c in chunks]
    embeddings = embedder.embed(texts)
    chunk_dicts = [
        {"chunk_id": c.chunk_id, "text": c.text, "metadata": c.metadata}
        for c in chunks
    ]
    store.add_chunks(chunk_dicts, embeddings)
    return len(chunks)
