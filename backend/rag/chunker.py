"""
EcoMind RAG — 法规文档分块引擎

法律文档特有的结构感知分块：
  1. 按"第X条"自然边界切分（中文法规的标准结构）
  2. 短条款合并相邻条（最少 50 字）
  3. 长条款按段落再切（最多 1000 字）
  4. 相邻 chunk 重叠 200 字（防止语义边界断裂）
  5. 每个 chunk 携带完整层级元数据

Usage:
    chunker = LegalChunker()
    chunks = chunker.chunk_document(title="湖南省大气污染防治条例",
                                     content=full_text,
                                     metadata={"law_level": "provincial"})
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LegalChunk:
    chunk_id: str
    text: str
    metadata: dict = field(default_factory=dict)


class LegalChunker:
    """法规文档分块器"""

    def __init__(
        self,
        min_chunk_chars: int = 50,
        max_chunk_chars: int = 1000,
        overlap_chars: int = 200,
    ):
        self.min_chars = min_chunk_chars
        self.max_chars = max_chunk_chars
        self.overlap_chars = overlap_chars

    def chunk_document(
        self,
        title: str,
        content: str,
        metadata: Optional[dict] = None,
    ) -> list[LegalChunk]:
        """
        将一份法律文档切分为多个 chunk。

        Args:
            title: 法律文件标题
            content: 全文内容
            metadata: 附加元数据 (law_level, category, etc.)

        Returns:
            LegalChunk 列表
        """
        meta = dict(metadata or {})
        meta["law_name"] = title

        # Step 1: 清理文本
        content = self._clean(content)

        # Step 2: 按"第X条"切分
        articles = self._split_by_article(content)

        # Step 3: 短条合并
        merged = self._merge_short_articles(articles)

        # Step 4: 长条再切
        chunks: list[LegalChunk] = []
        for i, (article_label, article_text) in enumerate(merged):
            sub_chunks = self._split_long_article(article_label, article_text)
            for j, (sub_label, sub_text) in enumerate(sub_chunks):
                chunk_meta = dict(meta)
                chunk_meta["article"] = article_label
                chunk_meta["chunk_index"] = j
                chunk_meta["total_chunks"] = len(sub_chunks)

                # 关联前后 chunk
                chunk_id = self._make_id(title, article_label, j)
                if chunks:
                    chunk_meta["prev_chunk"] = chunks[-1].chunk_id
                    chunks[-1].metadata["next_chunk"] = chunk_id

                chunks.append(LegalChunk(
                    chunk_id=chunk_id,
                    text=sub_text,
                    metadata=chunk_meta,
                ))

        return chunks

    # ─── 内部方法 ───────────────────────────────────

    _ARTICLE_PATTERN = re.compile(
        r'(?:^|\n)\s*(第[一二三四五六七八九十百千\d]+条[：:\s]*)'
    )

    def _clean(self, text: str) -> str:
        """清理文本：合并多余空白、去掉 HTML 标签"""
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()
        return text

    def _split_by_article(self, text: str) -> list[tuple[str, str]]:
        """按"第X条"边界切分"""
        parts = self._ARTICLE_PATTERN.split(text)
        articles: list[tuple[str, str]] = []

        # parts[0] = 序言（第一条之前的 text）
        preamble = parts[0].strip() if parts else ""
        if preamble and len(preamble) > 20:
            articles.append(("总则", preamble[:self.max_chars]))

        # parts[1] = "第X条", parts[2] = 条文, parts[3] = "第Y条"...
        i = 1
        while i + 1 < len(parts):
            label = parts[i].strip()
            body = parts[i + 1].strip() if i + 1 < len(parts) else ""
            if label and body:
                articles.append((label, body))
            i += 2

        return articles

    def _merge_short_articles(self, articles: list[tuple[str, str]]) -> list[tuple[str, str]]:
        """合并过短的条款（< min_chars）到相邻条"""
        if not articles:
            return articles

        merged: list[tuple[str, str]] = []
        buffer_label = ""
        buffer_text = ""

        for label, text in articles:
            if len(text) < self.min_chars or len(buffer_text) < self.min_chars:
                # 积累
                if buffer_label:
                    buffer_label += f"、{label.replace('第', '').replace('条', '')}"
                else:
                    buffer_label = label
                buffer_text += (" " + text) if buffer_text else text
                buffer_text = buffer_text.strip()
            else:
                if buffer_text:
                    merged.append((buffer_label, buffer_text))
                buffer_label = label
                buffer_text = text

        if buffer_text:
            merged.append((buffer_label, buffer_text))

        return merged

    def _split_long_article(self, label: str, text: str) -> list[tuple[str, str]]:
        """超长条款按段落再切"""
        if len(text) <= self.max_chars:
            return [(label, text)]

        chunks = []
        current = ""
        para_index = 0

        for para in text.split('\n'):
            para = para.strip()
            if not para:
                continue

            if len(current) + len(para) < self.max_chars:
                current += '\n' + para if current else para
            else:
                if current:
                    sub_label = f"{label}({para_index + 1})"
                    chunks.append((sub_label, current.strip()))
                    para_index += 1
                current = para

        if current:
            sub_label = f"{label}({para_index + 1})" if para_index > 0 else label
            chunks.append((sub_label, current.strip()))

        return chunks or [(label, text)]

    def _make_id(self, title: str, article: str, sub_index: int) -> str:
        raw = f"{title}#{article}#{sub_index}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]
