"""
EcoMind 知识图谱 — 三层实体关系网络

Layer 1: 法规网络 (全局, RAG 注入时自动构建)
Layer 2: 会话网络 (每会话, 工具调用时实时追加)
Layer 3: 进化网络 (跨会话, 夜间反思时聚合)
"""
from graph.engine import KnowledgeGraphEngine, GraphNode, GraphEdge, get_graph_engine
