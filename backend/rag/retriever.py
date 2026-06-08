"""
EcoMind RAG — 双路混合检索引擎

三阶段检索:
  1. BM25 关键词 (SQLite FTS5) — 精确匹配
  2. 向量语义 (ChromaDB)       — 语义理解
  3. Cross-Encoder 重排序      — 精度优化

融合算法: Reciprocal Rank Fusion (RRF), k=60

Usage:
    retriever = HybridRetriever()
    results = await retriever.search("废气排放标准", top_k=10,
                                      filters={"category": "大气"})
"""
from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import Any, Optional

from rag.embeddings import EmbeddingEngine
from rag.vector_store import VectorStore

logger = logging.getLogger(__name__)

FTS5_DB = Path(__file__).resolve().parent.parent / "data" / "hunan_policies.db"


class HybridRetriever:
    """双路混合检索 + 重排序"""

    _instance: Optional[HybridRetriever] = None

    def __init__(self):
        self._embedder = EmbeddingEngine.get_instance()
        self._vector = VectorStore.get_instance()
        self._reranker = None  # 延迟加载

    @classmethod
    def get_instance(cls) -> HybridRetriever:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def search(
        self,
        query: str,
        top_k: int = 10,
        filters: Optional[dict] = None,
    ) -> list[dict[str, Any]]:
        """
        混合检索入口。

        Returns:
            [{"id": ..., "text": ..., "metadata": {...}, "score": ..., "source": "vector"|"keyword"}, ...]
        """
        # 路 1: 向量语义检索
        q_embedding = self._embedder.embed_query(query)
        vector_hits = self._vector.search(
            q_embedding,
            top_k=top_k * 2,
            filters=filters,
        )
        for h in vector_hits:
            h["source"] = "vector"
            h["rank_vector"] = vector_hits.index(h) + 1

        # 路 2: 关键词检索（FTS5）
        keyword_hits = self._fts5_search(query, limit=top_k * 2)
        for i, h in enumerate(keyword_hits):
            h["source"] = "keyword"
            h["rank_keyword"] = i + 1

        # 融合: RRF
        fused = self._rrf_fusion(vector_hits, keyword_hits, k=60)

        # 精排: Cross-Encoder（如已加载）
        if len(fused) > top_k and self._reranker is not None:
            fused = self._rerank(query, fused, top_k=top_k)

        return fused[:top_k]

    # ─── FTS5 关键词检索 ────────────────────────────

    def _fts5_search(self, query: str, limit: int = 20) -> list[dict]:
        """SQLite FTS5 全文搜索"""
        if not FTS5_DB.exists():
            logger.warning("FTS5 DB 不存在: %s", FTS5_DB)
            return []

        conn = sqlite3.connect(str(FTS5_DB))
        conn.row_factory = sqlite3.Row
        results: list[dict] = []

        try:
            # FTS5 主表
            rows = conn.execute(
                """SELECT article_id, title, content, publish_date, section
                   FROM articles WHERE content MATCH ?
                   ORDER BY rank LIMIT ?""",
                (query, limit),
            ).fetchall()

            # 降级到 LIKE
            if not rows:
                like_query = f"%{query.replace(' ', '%')}%"
                rows = conn.execute(
                    """SELECT article_id, title, content, publish_date, section
                       FROM articles WHERE content LIKE ?
                       ORDER BY publish_date DESC LIMIT ?""",
                    (like_query, limit),
                ).fetchall()

            for r in rows:
                content = r["content"] or ""
                snippet = content[:500] if len(content) > 500 else content
                results.append({
                    "id": r["article_id"],
                    "text": snippet,
                    "metadata": {
                        "law_name": r["title"],
                        "section": r["section"],
                        "publish_date": r["publish_date"],
                    },
                    "score": 0.6,  # 关键词基础分
                })

        except sqlite3.OperationalError as e:
            logger.warning("FTS5 搜索异常: %s", e)
        finally:
            conn.close()

        return results

    # ─── RRF 融合 ────────────────────────────────────

    def _rrf_fusion(
        self,
        vector_hits: list[dict],
        keyword_hits: list[dict],
        k: int = 60,
    ) -> list[dict]:
        """Reciprocal Rank Fusion"""
        scores: dict[str, dict] = {}

        for hits, rank_key in [(vector_hits, "rank_vector"), (keyword_hits, "rank_keyword")]:
            for hit in hits:
                cid = hit["id"] or hit.get("metadata", {}).get("article_id", "")
                if not cid:
                    continue
                rank = hit.get(rank_key, 100)
                rrf = 1.0 / (k + rank)

                if cid not in scores:
                    scores[cid] = dict(hit)
                    scores[cid]["rrf_score"] = rrf
                    scores[cid]["matched_from"] = [hit.get("source", "")]
                else:
                    scores[cid]["rrf_score"] += rrf
                    src = hit.get("source", "")
                    if src and src not in scores[cid].get("matched_from", []):
                        scores[cid].setdefault("matched_from", []).append(src)

        merged = list(scores.values())
        merged.sort(key=lambda x: -x.get("rrf_score", 0))
        return merged

    # ─── Cross-Encoder 重排序 ────────────────────────

    def _load_reranker(self):
        try:
            from sentence_transformers import CrossEncoder
            model_name = "BAAI/bge-reranker-large"
            self._reranker = CrossEncoder(model_name, max_length=512)
            logger.info("Reranker 模型加载完成: %s", model_name)
        except Exception as e:
            logger.warning("Reranker 加载失败（将跳过重排）: %s", e)
            self._reranker = False  # 标记为失败，不再重试

    def _rerank(self, query: str, candidates: list[dict], top_k: int) -> list[dict]:
        """Cross-Encoder 精排"""
        if self._reranker is None:
            self._load_reranker()
        if self._reranker is False:
            return candidates

        pairs = [(query, c.get("text", "")[:512]) for c in candidates]
        try:
            scores = self._reranker.predict(pairs)
            for i, c in enumerate(candidates):
                c["rerank_score"] = float(scores[i]) if hasattr(scores, '__iter__') else float(scores)
            candidates.sort(key=lambda x: -x.get("rerank_score", 0))
        except Exception as e:
            logger.warning("Rerank 失败: %s", e)

        return candidates

    # ─── 便捷方法 ────────────────────────────────────

    async def search_articles(self, query: str, law_name: Optional[str] = None) -> list[str]:
        """返回与查询最相关的法条原文（供 Agent 使用）"""
        results = await self.search(query, top_k=5)
        return [
            f"【{r.get('metadata', {}).get('law_name', '')} - "
            f"{r.get('metadata', {}).get('article', '')}】\n"
            f"{r['text']}"
            for r in results
        ]

    def status(self) -> dict:
        return {
            "vector_store": self._vector.status(),
            "embedding": self._embedder.status(),
            "reranker_loaded": self._reranker is not None and self._reranker is not False,
            "fts5_db": str(FTS5_DB) if FTS5_DB.exists() else None,
        }
