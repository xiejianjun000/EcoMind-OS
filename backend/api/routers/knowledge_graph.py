"""
/api/knowledge-graph — 知识图谱路由

提供知识图谱的查询、搜索、可视化数据导出。
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from graph.understand_adapter import get_knowledge_graph

router = APIRouter(prefix="/api/knowledge-graph", tags=["knowledge-graph"])


@router.get("/stats", summary="图谱统计")
async def get_stats() -> dict:
    """获取知识图谱统计信息（节点数、边数、类型分布）"""
    kg = get_knowledge_graph()
    return kg.stats()


@router.get("/nodes", summary="所有节点")
async def list_nodes(
    node_type: Optional[str] = Query(default=None, description="按节点类型过滤"),
) -> list[dict]:
    """获取知识图谱所有节点，支持按类型过滤"""
    kg = get_knowledge_graph()
    nodes = list(kg._nodes.values())
    if node_type:
        nodes = [n for n in nodes if n.node_type == node_type]
    return [
        {"id": n.id, "label": n.label, "type": n.node_type, "properties": n.properties}
        for n in nodes
    ]


@router.get("/nodes/{node_id}", summary="节点详情")
async def get_node(node_id: str) -> dict:
    """获取指定节点详情及其邻居节点"""
    kg = get_knowledge_graph()
    node = kg.get_node(node_id)
    if node is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"节点不存在: {node_id}")

    neighbors = kg.get_neighbors(node_id, depth=1)
    return {
        "node": {"id": node.id, "label": node.label, "type": node.node_type, "properties": node.properties},
        "neighbors": [
            {"id": n.id, "label": n.label, "type": n.node_type, "properties": n.properties}
            for n in neighbors if n.id != node_id
        ],
    }


@router.get("/edges", summary="所有边")
async def list_edges() -> list[dict]:
    """获取知识图谱所有边"""
    kg = get_knowledge_graph()
    return [
        {"source": e.source_id, "target": e.target_id, "relation": e.relation, "weight": e.weight}
        for e in kg._edges
    ]


@router.get("/search", summary="搜索节点")
async def search_nodes(q: str = Query(..., description="搜索关键词")) -> list[dict]:
    """按关键词搜索知识图谱节点"""
    kg = get_knowledge_graph()
    results = kg.search(q)
    return [
        {"id": n.id, "label": n.label, "type": n.node_type, "properties": n.properties}
        for n in results
    ]


@router.get("/mermaid", summary="Mermaid 导出")
async def export_mermaid(center: Optional[str] = Query(default=None)) -> dict:
    """导出知识图谱为 Mermaid 格式（用于前端渲染）"""
    kg = get_knowledge_graph()
    mermaid_code = kg.to_mermaid(center)
    return {"mermaid": mermaid_code}


@router.get("/full", summary="完整图谱数据")
async def get_full_graph() -> dict:
    """获取完整知识图谱数据（节点+边），用于前端可视化"""
    kg = get_knowledge_graph()
    nodes = [
        {"id": n.id, "label": n.label, "type": n.node_type, "properties": n.properties}
        for n in kg._nodes.values()
    ]
    edges = [
        {"source": e.source_id, "target": e.target_id, "relation": e.relation, "weight": e.weight}
        for e in kg._edges
    ]
    return {"nodes": nodes, "edges": edges, "stats": kg.stats()}
