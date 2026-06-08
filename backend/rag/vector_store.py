"""
EcoMind RAG — 轻量向量存储 (SQLite + numpy)

零外部向量数据库依赖。利用已有的 hermes_memory.db：
  - embeddings 表: (chunk_id, embedding BLOB, metadata JSON)
  - 余弦相似度检索: numpy 批量计算
  - 支持 metadata 过滤

设计理念: EcoMind 法规库规模 (4000+ 篇) 不需要 FAISS/Milvus/ChromaDB。
          numpy 批量余弦距离在 10k 向量上 < 5ms。

Usage:
    store = VectorStore()
    store.add_chunks(chunks, embeddings)
    results = store.search(query_embedding, top_k=5)
"""
from __future__ import annotations

import json
import logging
import sqlite3
import struct
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hermes_memory.db"


class VectorStore:
    """SQLite + numpy 轻量向量存储"""

    _instance: Optional[VectorStore] = None

    def __init__(self):
        self._ensure_schema()

    @classmethod
    def get_instance(cls) -> VectorStore:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ─── Schema ──────────────────────────────────────

    def _ensure_schema(self):
        conn = sqlite3.connect(str(DB_PATH))
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS rag_embeddings (
                chunk_id TEXT PRIMARY KEY,
                embedding BLOB NOT NULL,
                dim INTEGER NOT NULL DEFAULT 768,
                metadata TEXT DEFAULT '{}',
                created_at REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_rag_emb_created ON rag_embeddings(created_at);
        """)
        conn.commit()
        conn.close()

    # ─── CRUD ────────────────────────────────────────

    def add_chunks(self, chunks: list[dict], embeddings: list[list[float]]) -> int:
        """批量 upsert chunks + embeddings"""
        if not chunks or not embeddings:
            return 0

        conn = sqlite3.connect(str(DB_PATH))
        now = __import__('time').time()
        count = 0

        for chunk, emb in zip(chunks, embeddings):
            blob = _encode_embedding(emb)
            dim = len(emb)
            metadata = json.dumps(chunk.get("metadata", {}), ensure_ascii=False)
            conn.execute(
                """INSERT OR REPLACE INTO rag_embeddings (chunk_id, embedding, dim, metadata, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (chunk["chunk_id"], blob, dim, metadata, now),
            )
            count += 1

        conn.commit()
        conn.close()
        logger.info("向量存储: 写入 %d chunks", count)
        return count

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        filters: Optional[dict] = None,
    ) -> list[dict[str, Any]]:
        """
        余弦相似度搜索。

        1. 读取所有向量 (或按 filters 过滤的)
        2. numpy 批量计算余弦距离 → 相似度
        3. 返回 top_k
        """
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row

        sql = "SELECT chunk_id, embedding, dim, metadata FROM rag_embeddings"
        params: list = []

        if filters:
            conditions = []
            for k, v in filters.items():
                conditions.append(f"json_extract(metadata, '$.{k}') = ?")
                params.append(v)
            sql += " WHERE " + " AND ".join(conditions)

        rows = conn.execute(sql, params).fetchall()
        conn.close()

        if not rows:
            return []

        # 提取向量
        db_embeddings = np.array([_decode_embedding(r["embedding"], r["dim"]) for r in rows], dtype=np.float32)
        query_vec = np.array(query_embedding, dtype=np.float32).reshape(1, -1)

        # 余弦相似度 = dot(query, db) / (norm(query) * norm(db))
        # 因为 normalized embeddings 已经是单位向量, 直接 dot
        similarities = np.dot(db_embeddings, query_vec.T).flatten()

        # Top-K
        if len(similarities) <= top_k:
            top_indices = np.argsort(-similarities)
        else:
            top_indices = np.argpartition(-similarities, top_k)[:top_k]
            top_indices = top_indices[np.argsort(-similarities[top_indices])]

        results = []
        for idx in top_indices:
            if similarities[idx] <= 0:
                continue
            row = rows[idx]
            metadata = json.loads(row["metadata"]) if row["metadata"] else {}
            results.append({
                "id": row["chunk_id"],
                "text": metadata.get("text", "")[:500],
                "metadata": metadata,
                "score": round(float(similarities[idx]), 4),
            })

        return results[:top_k]

    def delete(self, chunk_ids: list[str]) -> int:
        """删除 chunks"""
        if not chunk_ids:
            return 0
        conn = sqlite3.connect(str(DB_PATH))
        placeholders = ",".join("?" * len(chunk_ids))
        cursor = conn.execute(
            f"DELETE FROM rag_embeddings WHERE chunk_id IN ({placeholders})",
            chunk_ids,
        )
        conn.commit()
        conn.close()
        return cursor.rowcount

    def count(self) -> int:
        conn = sqlite3.connect(str(DB_PATH))
        row = conn.execute("SELECT COUNT(*) FROM rag_embeddings").fetchone()
        conn.close()
        return row[0] if row else 0

    def status(self) -> dict:
        return {
            "total_chunks": self.count(),
            "db_path": str(DB_PATH),
            "backend": "sqlite+numpy",
        }


# ─── 序列化 ──────────────────────────────────────────

def _encode_embedding(vec: list[float]) -> bytes:
    """float32 → bytes"""
    arr = np.array(vec, dtype=np.float32)
    return arr.tobytes()


def _decode_embedding(blob: bytes, dim: int) -> list[float]:
    """bytes → float32 list"""
    arr = np.frombuffer(blob, dtype=np.float32)
    if len(arr) != dim:
        arr = arr[:dim] if len(arr) > dim else np.pad(arr, (0, dim - len(arr)))
    return arr.tolist()
