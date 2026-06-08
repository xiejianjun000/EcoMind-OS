"""
EcoMind 三层知识图谱引擎 — SQLite 持久化

Layer 1: 法规网络 (全局, 所有 Agent 共享)
  - 边类型: cites / supersedes / references / implements
  - 构建时机: RAG ingestion 时自动扫描法条引用

Layer 2: 会话网络 (每会话独立)
  - 边类型: session_references / agent_cites / user_corrects
  - 构建时机: 每次 tool_call (regulatory_search) 时实时写入

Layer 3: 进化网络 (跨会话聚合)
  - 边类型: co_occurred / frequently_cited / knowledge_gap
  - 构建时机: nightly_reflection() 扫描所有 completed 会话

SQLite 表结构:
  graph_nodes  — 所有节点
  graph_edges  — 所有边, 带 layer 标记和 metadata
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hermes_memory.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _init_schema():
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS graph_nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            node_type TEXT NOT NULL DEFAULT 'unknown',
            properties TEXT DEFAULT '{}',
            layer INTEGER DEFAULT 1,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS graph_edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relation TEXT NOT NULL,
            layer INTEGER NOT NULL DEFAULT 1,
            weight REAL DEFAULT 1.0,
            session_id TEXT DEFAULT '',
            user_id TEXT DEFAULT '',
            expert_id TEXT DEFAULT '',
            metadata TEXT DEFAULT '{}',
            created_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ge_source ON graph_edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_ge_target ON graph_edges(target_id);
        CREATE INDEX IF NOT EXISTS idx_ge_layer ON graph_edges(layer);
        CREATE INDEX IF NOT EXISTS idx_ge_session ON graph_edges(session_id);
        CREATE INDEX IF NOT EXISTS idx_ge_user ON graph_edges(user_id);
        CREATE INDEX IF NOT EXISTS idx_gn_type ON graph_nodes(node_type);
    """)
    conn.commit()
    conn.close()


_init_schema()


@dataclass
class GraphNode:
    id: str
    label: str
    node_type: str = "unknown"
    properties: dict[str, Any] = field(default_factory=dict)
    layer: int = 1

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "type": self.node_type,
            "properties": self.properties,
            "layer": self.layer,
        }


@dataclass
class GraphEdge:
    source_id: str
    target_id: str
    relation: str
    layer: int = 1
    weight: float = 1.0
    session_id: str = ""
    user_id: str = ""
    expert_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class KnowledgeGraphEngine:
    """三层知识图谱引擎 — 单例"""

    _instance: Optional[KnowledgeGraphEngine] = None

    @classmethod
    def get_instance(cls) -> KnowledgeGraphEngine:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ─── Node CRUD ──────────────────────────────────

    def upsert_node(self, node_id: str, label: str, node_type: str = "unknown",
                    properties: Optional[dict] = None, layer: int = 1) -> GraphNode:
        conn = _get_conn()
        props_json = json.dumps(properties or {}, ensure_ascii=False)
        conn.execute(
            """INSERT OR REPLACE INTO graph_nodes (id, label, node_type, properties, layer, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (node_id, label, node_type, props_json, layer, time.time()),
        )
        conn.commit()
        conn.close()
        return GraphNode(id=node_id, label=label, node_type=node_type,
                        properties=properties or {}, layer=layer)

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        conn = _get_conn()
        row = conn.execute("SELECT * FROM graph_nodes WHERE id = ?", (node_id,)).fetchone()
        conn.close()
        if not row:
            return None
        return GraphNode(
            id=row["id"], label=row["label"], node_type=row["node_type"],
            properties=json.loads(row["properties"]) if row["properties"] else {},
            layer=row["layer"],
        )

    def get_nodes_by_type(self, node_type: str) -> list[GraphNode]:
        conn = _get_conn()
        rows = conn.execute("SELECT * FROM graph_nodes WHERE node_type = ?", (node_type,)).fetchall()
        conn.close()
        return [GraphNode(id=r["id"], label=r["label"], node_type=r["node_type"],
                properties=json.loads(r["properties"]) if r["properties"] else {},
                layer=r["layer"]) for r in rows]

    # ─── Edge CRUD ──────────────────────────────────

    def add_edge(self, edge: GraphEdge) -> int:
        conn = _get_conn()
        cursor = conn.execute(
            """INSERT INTO graph_edges (source_id, target_id, relation, layer, weight,
               session_id, user_id, expert_id, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (edge.source_id, edge.target_id, edge.relation, edge.layer, edge.weight,
             edge.session_id or "", edge.user_id or "", edge.expert_id or "",
             json.dumps(edge.metadata, ensure_ascii=False), time.time()),
        )
        conn.commit()
        eid = cursor.lastrowid
        conn.close()
        return eid

    def get_edges(self, source_id: str = "", target_id: str = "",
                  layer: Optional[int] = None, session_id: str = "",
                  user_id: str = "", relation: str = "") -> list[dict]:
        conn = _get_conn()
        sql = "SELECT * FROM graph_edges WHERE 1=1"
        params: list = []
        if source_id:
            sql += " AND source_id = ?"; params.append(source_id)
        if target_id:
            sql += " AND target_id = ?"; params.append(target_id)
        if layer is not None:
            sql += " AND layer = ?"; params.append(layer)
        if session_id:
            sql += " AND session_id = ?"; params.append(session_id)
        if user_id:
            sql += " AND user_id = ?"; params.append(user_id)
        if relation:
            sql += " AND relation = ?"; params.append(relation)
        rows = conn.execute(sql + " ORDER BY weight DESC", params).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    # ─── Layer 1: 法规注册机 ────────────────

    def build_layer1_from_regulation(self, law_name: str, article: str,
                                     chunk_id: str, content: str) -> int:
        """从一条法规 chunk 构建 Layer 1 节点和自引用边。"""
        from hashlib import md5
        law_id = md5(f"{law_name}::{article}".encode()).hexdigest()[:12]
        self.upsert_node(law_id, f"{law_name} {article}", "regulation",
                        {"law_name": law_name, "article": article, "chunk_id": chunk_id}, layer=1)

        refs = self._extract_citations(content)
        count = 0
        for ref_law, ref_article in refs:
            ref_id = md5(f"{ref_law}::{ref_article}".encode()).hexdigest()[:12]
            self.upsert_node(ref_id, f"{ref_law} {ref_article}", "regulation",
                            {"law_name": ref_law, "article": ref_article}, layer=1)
            self.add_edge(GraphEdge(source_id=law_id, target_id=ref_id,
                                    relation="cites", layer=1, weight=1.0))
            count += 1
        return count

    def build_layer1_bulk(self, chunks: list[dict]) -> dict:
        """批量构建 Layer 1: 所有 RAG chunk 注入时调用。"""
        total_nodes = 0
        total_edges = 0
        for c in chunks:
            meta = c.get("metadata", {})
            law_name = meta.get("law_name", "")
            article = meta.get("article", "")
            text = c.get("text", "")
            if law_name and article:
                edges = self.build_layer1_from_regulation(law_name, article, c["chunk_id"], text)
                total_nodes += 1
                total_edges += edges
        logger.info("Layer 1: %d 节点, %d 边", total_nodes, total_edges)
        return {"nodes": total_nodes, "edges": total_edges}

    # ─── Layer 2: 会话注册机 ────────────────

    def build_layer2_from_tool_call(self, session_id: str, user_id: str,
                                    expert_id: str, query: str,
                                    search_results: list[dict]) -> int:
        """工具调用回归 -> 建 Layer 2 边: session → 每条被引用的法规。"""
        from hashlib import md5
        # Session node
        session_node_id = f"session:{session_id}"
        self.upsert_node(session_node_id, f"会话 {session_id[:8]}", "session",
                        {"query": query, "user_id": user_id, "expert_id": expert_id}, layer=2)

        # User node
        user_node_id = f"user:{user_id}"
        self.upsert_node(user_node_id, user_id[:12], "user",
                        {"user_id": user_id}, layer=2)

        # User → Session
        self.add_edge(GraphEdge(source_id=user_node_id, target_id=session_node_id,
                                relation="participates", layer=2, weight=1.0,
                                session_id=session_id, user_id=user_id, expert_id=expert_id))

        count = 0
        for r in search_results:
            law_name = r.get("law_name", "")
            article = r.get("article", "")
            if not law_name:
                continue
            law_id = md5(f"{law_name}::{article}".encode()).hexdigest()[:12]

            # Ensure Layer 1 node exists
            existing = self.get_node(law_id)
            if not existing:
                self.upsert_node(law_id, f"{law_name} {article}", "regulation",
                                {"law_name": law_name, "article": article}, layer=1)

            # Session → Regulation (session_references)
            self.add_edge(GraphEdge(
                source_id=session_node_id, target_id=law_id,
                relation="session_references", layer=2, weight=r.get("score", 0.5),
                session_id=session_id, user_id=user_id, expert_id=expert_id,
                metadata={"query": query, "rank": search_results.index(r) + 1},
            ))
            count += 1
        return count

    def build_layer2_from_correction(self, session_id: str, user_id: str,
                                     expert_id: str, question: str,
                                     regulation_ref: str, correction: str) -> None:
        """用户纠正 Agent -> 建负向边, 降低权重。"""
        from hashlib import md5
        law_id = md5(regulation_ref.encode()).hexdigest()[:12]
        session_node_id = f"session:{session_id}"

        self.add_edge(GraphEdge(
            source_id=session_node_id, target_id=law_id,
            relation="user_corrects", layer=2, weight=-0.3,
            session_id=session_id, user_id=user_id, expert_id=expert_id,
            metadata={"question": question, "correction": correction},
        ))

    # ─── Layer 3: 进化聚合 ────────────────

    def build_layer3_from_sessions(self, session_ids: list[str]) -> dict:
        """扫描已完成会话, 聚合 Layer 2 → Layer 3。"""
        conn = _get_conn()
        stats = {"co_occurred": 0, "frequently_cited": 0, "knowledge_gap": 0}

        # 1. Frequently cited: count edges by regulation target
        freq_rows = conn.execute(
            """SELECT target_id, COUNT(*) as cnt, SUM(weight) as total_weight
               FROM graph_edges WHERE layer = 2 AND relation = 'session_references'
               GROUP BY target_id HAVING cnt >= 3 ORDER BY cnt DESC""",
        ).fetchall()

        for row in freq_rows:
            self.add_edge(GraphEdge(
                source_id="layer3:hotspot", target_id=row["target_id"],
                relation="frequently_cited", layer=3,
                weight=min(row["total_weight"], 10.0),
                metadata={"citation_count": row["cnt"]},
            ))
            stats["frequently_cited"] += 1

        # 2. Co-occurred: 同一会话中一起被引用的法规
        co_rows = conn.execute("""
            SELECT a.target_id as reg_a, b.target_id as reg_b, COUNT(*) as cnt
            FROM graph_edges a JOIN graph_edges b
              ON a.session_id = b.session_id AND a.target_id < b.target_id
            WHERE a.layer = 2 AND b.layer = 2
              AND a.relation = 'session_references'
              AND b.relation = 'session_references'
            GROUP BY reg_a, reg_b HAVING cnt >= 2""",
        ).fetchall()

        for row in co_rows:
            self.add_edge(GraphEdge(
                source_id=row["reg_a"], target_id=row["reg_b"],
                relation="co_occurred", layer=3,
                weight=min(row["cnt"], 5.0),
                metadata={"co_count": row["cnt"]},
            ))
            stats["co_occurred"] += 1

        # 3. Knowledge gap: 用户纠正的聚集
        gap_rows = conn.execute(
            """SELECT target_id, COUNT(*) as cnt
               FROM graph_edges WHERE layer = 2 AND relation = 'user_corrects'
               GROUP BY target_id HAVING cnt >= 2""",
        ).fetchall()

        for row in gap_rows:
            self.add_edge(GraphEdge(
                source_id="layer3:gap", target_id=row["target_id"],
                relation="knowledge_gap", layer=3,
                weight=min(row["cnt"] * 2, 10.0),
                metadata={"correction_count": row["cnt"]},
            ))
            stats["knowledge_gap"] += 1

        conn.close()
        logger.info("Layer 3: %s", stats)
        return stats

    # ─── Query API (for frontend KnowledgeView) ─────

    def get_subgraph(self, session_id: str = "", user_id: str = "",
                     max_nodes: int = 50) -> dict:
        """获取指定会话或用户的子图。"""
        conn = _get_conn()

        # Collect node IDs from matching edges
        node_ids: set[str] = set()
        edges: list[dict] = []

        if session_id:
            rows = conn.execute(
                "SELECT * FROM graph_edges WHERE session_id = ? ORDER BY weight DESC LIMIT ?",
                (session_id, max_nodes),
            ).fetchall()
            for r in rows:
                edges.append(dict(r))
                node_ids.add(r["source_id"])
                node_ids.add(r["target_id"])

        if user_id:
            rows = conn.execute(
                "SELECT * FROM graph_edges WHERE user_id = ? ORDER BY weight DESC LIMIT ?",
                (user_id, max_nodes * 2),
            ).fetchall()
            for r in rows:
                edges.append(dict(r))
                node_ids.add(r["source_id"])
                node_ids.add(r["target_id"])

        if not node_ids:
            # Return Layer 1 nodes as fallback
            rows = conn.execute(
                "SELECT id FROM graph_nodes WHERE layer = 1 LIMIT ?", (max_nodes,)
            ).fetchall()
            node_ids = {r["id"] for r in rows}

        # Fetch nodes
        nodes = []
        placeholders = ",".join("?" * min(len(node_ids), max_nodes))
        if placeholders:
            rows = conn.execute(
                f"SELECT * FROM graph_nodes WHERE id IN ({placeholders})",
                list(node_ids)[:max_nodes],
            ).fetchall()
            nodes = [
                {"id": r["id"], "label": r["label"], "type": r["node_type"],
                 "properties": json.loads(r["properties"]) if r["properties"] else {},
                 "layer": r["layer"]}
                for r in rows
            ]

        conn.close()

        return {
            "nodes": nodes[:max_nodes],
            "edges": [
                {"source": e["source_id"], "target": e["target_id"],
                 "relation": e["relation"], "layer": e["layer"],
                 "weight": e["weight"]}
                for e in edges[:max_nodes]
            ],
        }

    def get_stats(self) -> dict:
        conn = _get_conn()
        total_nodes = conn.execute("SELECT COUNT(*) FROM graph_nodes").fetchone()[0]
        conn.close()
        return {
            "total_nodes": total_nodes,
            "nodes_by_type": self._count_by("node_type", "graph_nodes"),
            "nodes_by_layer": self._count_by("layer", "graph_nodes"),
            "edges_by_layer": self._count_by("layer", "graph_edges"),
            "edges_by_relation": self._count_by("relation", "graph_edges"),
        }

    def _count_by(self, field: str, table: str) -> dict[str, int]:
        conn = _get_conn()
        rows = conn.execute(
            f"SELECT {field} as k, COUNT(*) as cnt FROM {table} GROUP BY {field}"
        ).fetchall()
        conn.close()
        return {r["k"]: r["cnt"] for r in rows}

    # ─── Citation extraction ──────────────────────

    _CITATION_PATTERNS = [
        (r'《([^》]+)》\s*第\s*([一二三四五六七八九十百千\d]+)\s*条', "cn_law"),
        (r'([A-Z]{2,3}\s*\d{4,6}[-/]\d{4,6})', "standard"),
        (r'(\d{4})\s*年第\s*(\d+)\s*号', "document"),
    ]

    def _extract_citations(self, text: str) -> list[tuple[str, str]]:
        """从法规文本中提取引用。"""
        import re
        refs = []
        for pattern, _style in self._CITATION_PATTERNS:
            for m in re.finditer(pattern, text):
                if _style == "cn_law":
                    refs.append((m.group(1), f"第{m.group(2)}条"))
                elif _style == "standard":
                    refs.append((m.group(1), ""))
                elif _style == "document":
                    refs.append((f"{m.group(1)}年", f"第{m.group(2)}号"))
        return refs[:20]  # 最多 20 条引用


def get_graph_engine() -> KnowledgeGraphEngine:
    return KnowledgeGraphEngine.get_instance()
