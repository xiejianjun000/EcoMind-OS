"""
Understand-Anything Adapter — 将 Lum1104/Understand-Anything (33K ⭐) 理念接入。

Understand-Anything: 将任意代码/文档转为交互式知识图谱
  - 可探索: 节点展开/收起
  - 可搜索: 关键词全文检索
  - 可提问: LLM 辅助问答

EcoMind 场景:
  - 环境法规知识图谱: 法律→条款→案例
  - 监测站点关系图: 站点→污染物→超标记录
  - Agent执行链路图: 用户输入→技能匹配→工具调用→输出
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    id: str
    label: str
    node_type: str   # regulation / case / station / agent / tool
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphEdge:
    source_id: str
    target_id: str
    relation: str     # cites / monitors / invokes / produces
    weight: float = 1.0


class KnowledgeGraph:
    """轻量级内存知识图谱 — 零外部依赖"""

    def __init__(self) -> None:
        self._nodes: dict[str, GraphNode] = {}
        self._edges: list[GraphEdge] = []
        self._adjacency: dict[str, list[GraphEdge]] = {}

    def add_node(self, node: GraphNode) -> None:
        self._nodes[node.id] = node

    def add_edge(self, edge: GraphEdge) -> None:
        self._edges.append(edge)
        self._adjacency.setdefault(edge.source_id, []).append(edge)

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        return self._nodes.get(node_id)

    def get_neighbors(self, node_id: str, depth: int = 1) -> list[GraphNode]:
        visited = {node_id}
        frontier = {node_id}
        for _ in range(depth):
            next_frontier = set()
            for nid in frontier:
                for edge in self._adjacency.get(nid, []):
                    if edge.target_id not in visited:
                        visited.add(edge.target_id)
                        next_frontier.add(edge.target_id)
            frontier = next_frontier
        return [self._nodes[nid] for nid in visited if nid in self._nodes]

    def search(self, keyword: str) -> list[GraphNode]:
        results = []
        for node in self._nodes.values():
            if keyword.lower() in node.label.lower():
                results.append(node)
            elif keyword.lower() in str(node.properties).lower():
                results.append(node)
        return results

    def to_mermaid(self, center_node: Optional[str] = None) -> str:
        """导出为 Mermaid 图"""
        lines = ["graph LR"]
        nodes = {center_node} if center_node else set(self._nodes.keys())
        rendered_edges = set()
        for e in self._edges:
            if e.source_id in nodes or not center_node:
                key = f"{e.source_id}->{e.target_id}"
                if key not in rendered_edges:
                    src_label = self._nodes.get(e.source_id, GraphNode(id=e.source_id, label=e.source_id, node_type="unknown")).label
                    tgt_label = self._nodes.get(e.target_id, GraphNode(id=e.target_id, label=e.target_id, node_type="unknown")).label
                    lines.append(f'    {e.source_id}["{src_label}"] -->|{e.relation}| {e.target_id}["{tgt_label}"]')
                    rendered_edges.add(key)
        return "\n".join(lines)

    def stats(self) -> dict:
        return {
            "node_count": len(self._nodes),
            "edge_count": len(self._edges),
            "node_types": {t: sum(1 for n in self._nodes.values() if n.node_type == t)
                          for t in set(n.node_type for n in self._nodes.values())},
        }


# ─── EcoMind 预置知识图谱 ──────────────────────────

def build_default_graph() -> KnowledgeGraph:
    """构建 EcoMind 默认知识图谱 — 环境法规 + Agent执行链路"""
    kg = KnowledgeGraph()

    # 法规节点
    laws = [
        ("law-001", "中华人民共和国环境保护法", "regulation", {"year": 2014, "level": "法律"}),
        ("law-002", "中华人民共和国大气污染防治法", "regulation", {"year": 2018, "level": "法律"}),
        ("law-003", "中华人民共和国水污染防治法", "regulation", {"year": 2017, "level": "法律"}),
        ("law-004", "碳排放权交易管理办法", "regulation", {"year": 2021, "level": "部门规章"}),
        ("law-005", "环境行政处罚办法", "regulation", {"year": 2010, "level": "部门规章"}),
    ]
    for nid, label, ntype, props in laws:
        kg.add_node(GraphNode(id=nid, label=label, node_type=ntype, properties=props))

    # Agent执行链路
    agents = [
        ("agent-env", "环境监测Agent", "agent", {}),
        ("agent-carbon", "碳排放管理Agent", "agent", {}),
        ("agent-enforce", "执法辅助Agent", "agent", {}),
        ("agent-approval", "审批辅助Agent", "agent", {}),
    ]
    for nid, label, ntype, props in agents:
        kg.add_node(GraphNode(id=nid, label=label, node_type=ntype, properties=props))

    # 工具节点
    tools = [
        ("tool-env-data", "query_environment_data", "tool", {}),
        ("tool-emission", "query_emission_data", "tool", {}),
        ("tool-approval", "submit_approval", "tool", {}),
        ("tool-report", "generate_report", "tool", {}),
        ("tool-law", "search_regulation", "tool", {}),
    ]
    for nid, label, ntype, props in tools:
        kg.add_node(GraphNode(id=nid, label=label, node_type=ntype, properties=props))

    # 边: Agent → 工具
    kg.add_edge(GraphEdge("agent-env", "tool-env-data", "invokes"))
    kg.add_edge(GraphEdge("agent-env", "tool-report", "invokes"))
    kg.add_edge(GraphEdge("agent-carbon", "tool-emission", "invokes"))
    kg.add_edge(GraphEdge("agent-carbon", "tool-report", "invokes"))
    kg.add_edge(GraphEdge("agent-enforce", "tool-law", "invokes"))
    kg.add_edge(GraphEdge("agent-enforce", "tool-approval", "invokes"))
    kg.add_edge(GraphEdge("agent-approval", "tool-approval", "invokes"))
    kg.add_edge(GraphEdge("agent-approval", "tool-law", "invokes"))

    # 边: 工具 → 法规
    kg.add_edge(GraphEdge("tool-law", "law-001", "cites"))
    kg.add_edge(GraphEdge("tool-law", "law-002", "cites"))
    kg.add_edge(GraphEdge("tool-law", "law-004", "cites"))
    kg.add_edge(GraphEdge("tool-approval", "law-005", "cites"))

    logger.info(f"默认知识图谱构建完成: {kg.stats()}")
    return kg


_kg: Optional[KnowledgeGraph] = None


def get_knowledge_graph() -> KnowledgeGraph:
    global _kg
    if _kg is None:
        _kg = build_default_graph()
    return _kg
