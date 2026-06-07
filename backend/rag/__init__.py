"""
EcoMind RAG — 法规知识库向量化检索引擎

组件:
  embeddings    — sentence-transformers 模型封装 (bge-large-zh / text2vec)
  chunker       — 法律文档语义分块引擎
  vector_store  — ChromaDB 向量存储
  retriever     — 双路混合检索 (BM25 + Vector + Re-rank)
  ingestion     — 批量/增量数据注入
  registry_api  — FastAPI REST 端点
  tool_adapter  — 注册到 EcoToolRegistry
"""
