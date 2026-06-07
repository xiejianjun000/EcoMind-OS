"""
/api/knowledge-graph — 知识图谱路由 (v2 — SQLite三层引擎)
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from graph.engine import get_graph_engine

router = APIRouter(prefix="/api/knowledge-graph", tags=["knowledge-graph"])


@router.get("/stats")
async def get_stats() -> dict:
    return get_graph_engine().get_stats()


@router.get("/nodes")
async def list_nodes(node_type: Optional[str] = Query(default=None)) -> list[dict]:
    g = get_graph_engine()
    nodes = g.get_nodes_by_type(node_type) if node_type else []
    if not node_type:
        import sqlite3
        from pathlib import Path
        conn = sqlite3.connect(str(Path(__file__).resolve().parent.parent.parent / "data" / "hermes_memory.db"))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM graph_nodes LIMIT 200").fetchall()
        conn.close()
        import json
        nodes = [{"id": r["id"], "label": r["label"], "type": r["node_type"],
                  "layer": r["layer"], "properties": json.loads(r["properties"]) if r["properties"] else {}}
                 for r in rows]
    return [n.to_dict() if hasattr(n, 'to_dict') else n for n in nodes]


@router.get("/nodes/{node_id}")
async def get_node(node_id: str) -> dict:
    g = get_graph_engine()
    node = g.get_node(node_id)
    if not node:
        raise HTTPException(404, f"节点不存在: {node_id}")
    edges = g.get_edges(source_id=node_id) + g.get_edges(target_id=node_id)
    return {"node": node.to_dict(), "edges": edges}


@router.get("/edges")
async def list_edges() -> list[dict]:
    return get_graph_engine().get_edges()


@router.get("/search")
async def search_nodes(q: str = Query(...)) -> list[dict]:
    g = get_graph_engine()
    import sqlite3
    from pathlib import Path
    conn = sqlite3.connect(str(Path(__file__).resolve().parent.parent.parent / "data" / "hermes_memory.db"))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM graph_nodes WHERE label LIKE ? OR id LIKE ? LIMIT 50",
        (f"%{q}%", f"%{q}%"),
    ).fetchall()
    conn.close()
    import json
    return [{"id": r["id"], "label": r["label"], "type": r["node_type"], "layer": r["layer"],
             "properties": json.loads(r["properties"]) if r["properties"] else {}} for r in rows]


@router.get("/full")
async def get_full_graph(session_id: str = "", user_id: str = "") -> dict:
    return get_graph_engine().get_subgraph(session_id=session_id, user_id=user_id)
