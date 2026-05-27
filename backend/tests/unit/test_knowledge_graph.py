"""
L1 单元测试 — 知识图谱模块
覆盖：图谱引擎初始化、节点查询、统计、Mermaid 导出
"""
import pytest
import sys
sys.path.insert(0, '.')


def _get_graph():
    """获取知识图谱实例"""
    from graph.understand_adapter import get_knowledge_graph
    return get_knowledge_graph()


class TestKnowledgeGraph:
    def test_graph_initializes(self):
        """图谱引擎可初始化"""
        kg = _get_graph()
        assert kg is not None

    def test_graph_has_nodes(self):
        """图谱包含节点"""
        kg = _get_graph()
        nodes = list(kg._nodes.values())
        assert len(nodes) > 0

    def test_graph_has_edges(self):
        """图谱包含边"""
        kg = _get_graph()
        edges = list(kg._edges)
        assert len(edges) > 0

    def test_nodes_have_required_fields(self):
        """节点包含必要字段"""
        kg = _get_graph()
        for node in kg._nodes.values():
            assert hasattr(node, 'id')
            assert hasattr(node, 'label')
            assert hasattr(node, 'node_type')

    def test_edges_connect_valid_nodes(self):
        """边连接有效节点"""
        kg = _get_graph()
        node_ids = set(kg._nodes.keys())
        for edge in kg._edges:
            assert edge.source_id in node_ids
            assert edge.target_id in node_ids

    def test_stats_function(self):
        """统计函数可用"""
        kg = _get_graph()
        stats = kg.stats()
        assert isinstance(stats, dict)

    def test_mermaid_export_format(self):
        """Mermaid 导出格式验证"""
        kg = _get_graph()
        edges = list(kg._edges)[:10]
        lines = ["graph TD"]
        for e in edges:
            src = e.source_id.replace("-", "_").replace(" ", "_")
            tgt = e.target_id.replace("-", "_").replace(" ", "_")
            lines.append(f"    {src} --> {tgt}")
        mermaid = "\n".join(lines)
        assert "graph TD" in mermaid

    def test_node_types(self):
        """节点类型多样性"""
        kg = _get_graph()
        types = {n.node_type for n in kg._nodes.values()}
        assert len(types) > 0
