"""
EcoMind RAG — Embedding 模型引擎

支持:
  - sentence-transformers (BAAI/bge-large-zh-v1.5 / text2vec-base-chinese)
  - 降级: sklearn TF-IDF + SVD (零外部模型依赖，pip install 即可用)
  - 模型缓存: ~/.cache/ecomind/models/

模式切换:
  export ECOMIND_EMBED_MODE=transformers  # 需要 pip install sentence-transformers (高精度)
  export ECOMIND_EMBED_MODE=tfidf         # 仅需 sklearn (轻量，零模型下载)

Usage:
    engine = EmbeddingEngine()
    vectors = engine.embed(["第一条规定...", "第二条规定..."])
"""
from __future__ import annotations

import logging
import os
import pickle
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CACHE_DIR = Path.home() / ".cache" / "ecomind" / "models"


class EmbeddingEngine:
    """Embedding 模型引擎 — 单例"""

    _instance: Optional[EmbeddingEngine] = None

    def __init__(self, mode: Optional[str] = None):
        """
        Args:
            mode: "transformers" | "tfidf" | None (从 ECOMIND_EMBED_MODE 环境变量读取, 默认 tfidf)
        """
        self.mode = mode or os.getenv("ECOMIND_EMBED_MODE", "tfidf")
        self._model = None
        self._dim = 256  # SVD 降维后维度

    @classmethod
    def get_instance(cls) -> EmbeddingEngine:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def model(self):
        if self._model is None:
            if self.mode == "transformers":
                self._load_transformers()
            else:
                self._load_tfidf()
        return self._model

    @property
    def dimension(self) -> int:
        self.model  # Ensure loaded
        return self._dim

    # ─── Transformers 模式 ──────────────────────────

    def _load_transformers(self):
        """加载 sentence-transformers 模型"""
        os.makedirs(CACHE_DIR, exist_ok=True)
        try:
            from sentence_transformers import SentenceTransformer
            model_name = os.getenv("ECOMIND_EMBED_MODEL", "shibing624/text2vec-base-chinese")
            logger.info("加载 embedding 模型: %s", model_name)
            self._model = SentenceTransformer(model_name, cache_folder=str(CACHE_DIR), device="cpu")
            self._dim = self._model.get_sentence_embedding_dimension()
            logger.info("Embedding 模型就绪: %s (%d 维)", model_name, self._dim)
        except ImportError:
            logger.warning("sentence-transformers 未安装, 降级到 TF-IDF 模式")
            self.mode = "tfidf"
            self._load_tfidf()
        except Exception as e:
            logger.warning("加载模型失败: %s, 降级到 TF-IDF 模式", e)
            self.mode = "tfidf"
            self._load_tfidf()

    # ─── TF-IDF + SVD 轻量模式 ─────────────────────

    def _load_tfidf(self):
        """加载 sklearn TF-IDF + SVD 管线（或创建新的）"""
        cache_path = CACHE_DIR / "tfidf_pipeline.pkl"
        if cache_path.exists():
            try:
                with open(cache_path, "rb") as f:
                    self._model = pickle.load(f)
                logger.info("TF-IDF 管线已从缓存加载: %s (%d 维)", cache_path, self._dim)
                return
            except Exception:
                pass

        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.decomposition import TruncatedSVD

        self._model = {
            "vectorizer": TfidfVectorizer(
                max_features=5000,
                analyzer="char_wb",
                ngram_range=(2, 4),
                sublinear_tf=True,
            ),
            "svd": TruncatedSVD(n_components=self._dim, random_state=42),
            "fitted": False,
        }
        logger.info("TF-IDF 管线就绪 (%d 维)", self._dim)

    # ─── 编码接口 ────────────────────────────────────

    def embed(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """批量编码"""
        if not texts:
            return []

        self.model  # Ensure loaded

        if self.mode == "transformers" and hasattr(self._model, "encode"):
            vecs = self._model.encode(texts, batch_size=batch_size,
                                       show_progress_bar=False, normalize_embeddings=True)
            return [v.tolist() for v in vecs]

        return self._embed_tfidf(texts)

    def embed_query(self, query: str) -> list[float]:
        """编码查询（与文档用同一个向量空间）"""
        self.model  # Ensure loaded
        if self.mode == "transformers" and hasattr(self._model, "encode"):
            vec = self._model.encode([query], normalize_embeddings=True)
            return vec[0].tolist()

        return self._embed_tfidf([query])[0]

    def _embed_tfidf(self, texts: list[str]) -> list[list[float]]:
        """TF-IDF + SVD 编码"""
        tfidf = self._model["vectorizer"]
        svd = self._model["svd"]

        if not self._model["fitted"]:
            sparse = tfidf.fit_transform(texts)
            actual_components = min(self._dim, sparse.shape[1] - 1, sparse.shape[0])
            if actual_components < 2:
                actual_components = 2
            svd.n_components = actual_components
            self._dim = actual_components
            transformed = svd.fit_transform(sparse)
            self._model["fitted"] = True
            self._model["actual_dim"] = actual_components
            # 保存到缓存
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(CACHE_DIR / "tfidf_pipeline.pkl", "wb") as f:
                pickle.dump(self._model, f)
        else:
            sparse = tfidf.transform(texts)
            transformed = svd.transform(sparse)

        # L2 normalize
        norms = __import__('numpy').linalg.norm(transformed, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        normalized = transformed / norms

        return normalized.tolist()

    # ─── 持久化 ──────────────────────────────────────

    def save(self):
        """保存 TF-IDF 管线到磁盘"""
        if self.mode == "tfidf" and self._model.get("fitted"):
            os.makedirs(CACHE_DIR, exist_ok=True)
            path = CACHE_DIR / "tfidf_pipeline.pkl"
            with open(path, "wb") as f:
                pickle.dump(self._model, f)
            logger.info("TF-IDF 管线已保存: %s", path)

    def status(self) -> dict:
        return {
            "mode": self.mode,
            "dimension": self.dimension,
            "fitted": self._model.get("fitted", True) if isinstance(self._model, dict) else True,
            "cache_dir": str(CACHE_DIR),
        }
