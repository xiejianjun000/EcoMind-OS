"""
Hunan Environmental Policy MCP Server — 湖南省生态环境厅政策文件实时学习

基于 govmcp 框架，通过 MCP 协议将湖南省生态环境厅官网的政策文件、
法规标准、通知公告、环保动态等接入 EcoMind 知识体系。

功能:
- 增量爬取：按板块和时间范围拉取最新政策
- 全文检索：本地 SQLite FTS5 全文索引
- 内容抽取：自动解析 HTML 正文 + Word 附件文本
- 知识入库：抓取结果自动导入 EcoMind 知识库

数据源:
    https://sthjt.hunan.gov.cn/
    ├── 规范性文件  /sthjt/xxgk/zcfg/gfxwj/list_sy3.html     (162+篇)
    ├── 政策解读    /sthjt/xxgk/zcfg/zcfgjd/list_sy3.html    (293+篇)
    ├── 通知公告    /sthjt/xxgk/tzgg/{tz,gg}/list_tyxx.html  (200+篇)
    ├── 环保动态    /sthjt/xxgk/xwdt/zxdt/list_tyxx.html     (800+篇)
    └── 环境要闻    /sthjt/xxgk/xwdt/hjyw/list_tyxx.html     (3000+篇)
"""

from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

from .crypto import AuditTrail, SM3Hash

logger = logging.getLogger(__name__)

BASE_URL = "https://sthjt.hunan.gov.cn"
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "hunan_policies.db")

SECTIONS: dict[str, dict] = {
    "gfxwj": {
        "name": "规范性文件",
        "list_url": "/sthjt/xxgk/zcfg/gfxwj/list_sy3.html",
        "list_pattern": "list_sy3",
        "description": "地方性法规、政府规章、地方标准和规范性文件",
    },
    "zcfgjd": {
        "name": "政策解读",
        "list_url": "/sthjt/xxgk/zcfg/zcfgjd/list_sy3.html",
        "list_pattern": "list_sy3",
        "description": "政策文件解读与说明",
    },
    "tzgg_tz": {
        "name": "通知公告-通知",
        "list_url": "/sthjt/xxgk/tzgg/tz/list_tyxx.html",
        "list_pattern": "list_tyxx",
        "description": "省生态环境厅发布的通知",
    },
    "tzgg_gg": {
        "name": "通知公告-公告",
        "list_url": "/sthjt/xxgk/tzgg/gg/list_tyxx.html",
        "list_pattern": "list_tyxx",
        "description": "省生态环境厅发布的公告",
    },
    "zxdt": {
        "name": "环保动态",
        "list_url": "/sthjt/xxgk/xwdt/zxdt/list_tyxx.html",
        "list_pattern": "list_tyxx",
        "description": "湖南省生态环境工作动态",
    },
    "hjyw": {
        "name": "环境要闻",
        "list_url": "/sthjt/xxgk/xwdt/hjyw/list_tyxx.html",
        "list_pattern": "list_tyxx",
        "description": "全国及省内环境要闻",
    },
}


@dataclass
class PolicyArticle:
    article_id: str
    title: str
    url: str
    section: str
    section_name: str
    publish_date: str
    source: str = ""
    content: str = ""
    content_hash: str = ""
    attachments: list = field(default_factory=list)
    crawled_at: str = ""


class PolicyStore:
    """政策文件本地 SQLite 存储 + FTS5 全文索引"""

    def __init__(self, db_path: str = DB_PATH):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS articles (
                    article_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL, url TEXT NOT NULL,
                    section TEXT NOT NULL, section_name TEXT NOT NULL,
                    publish_date TEXT NOT NULL, source TEXT DEFAULT '',
                    content TEXT DEFAULT '', content_hash TEXT DEFAULT '',
                    attachments TEXT DEFAULT '[]', crawled_at TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
                    title, content, section_name,
                    content='articles', content_rowid='rowid'
                )
            """)
            conn.executescript("""
                CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
                    INSERT INTO articles_fts(rowid, title, content, section_name)
                    VALUES (new.rowid, new.title, new.content, new.section_name);
                END;
                CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
                    INSERT INTO articles_fts(articles_fts, rowid, title, content, section_name)
                    VALUES ('delete', old.rowid, old.title, old.content, old.section_name);
                END;
                CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
                    INSERT INTO articles_fts(articles_fts, rowid, title, content, section_name)
                    VALUES ('delete', old.rowid, old.title, old.content, old.section_name);
                    INSERT INTO articles_fts(rowid, title, content, section_name)
                    VALUES (new.rowid, new.title, new.content, new.section_name);
                END;
            """)
            conn.commit()

    def article_exists(self, article_id: str) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT 1 FROM articles WHERE article_id = ?", (article_id,)).fetchone()
            return row is not None

    def upsert_article(self, article: PolicyArticle) -> bool:
        is_new = not self.article_exists(article.article_id)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""INSERT OR REPLACE INTO articles
                (article_id, title, url, section, section_name, publish_date, source,
                 content, content_hash, attachments, crawled_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (article.article_id, article.title, article.url, article.section,
                 article.section_name, article.publish_date, article.source,
                 article.content, article.content_hash,
                 json.dumps(article.attachments, ensure_ascii=False), article.crawled_at))
            conn.commit()
        return is_new

    def get_article(self, article_id: str) -> dict | None:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM articles WHERE article_id = ?", (article_id,)).fetchone()
            if row:
                d = dict(row)
                d["attachments"] = json.loads(d.get("attachments", "[]"))
                return d
        return None

    def search(self, query: str, limit: int = 20, section: str = None) -> list[dict]:
        """全文检索（FTS5 + LIKE 双引擎，兼容中文分词）"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row

            # 先尝试 FTS5
            try:
                if section:
                    rows = conn.execute("""
                        SELECT a.*, snippet(articles_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
                        FROM articles_fts f JOIN articles a ON f.rowid = a.rowid
                        WHERE articles_fts MATCH ? AND a.section = ?
                        ORDER BY rank LIMIT ?
                    """, (query, section, limit)).fetchall()
                else:
                    rows = conn.execute("""
                        SELECT a.*, snippet(articles_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
                        FROM articles_fts f JOIN articles a ON f.rowid = a.rowid
                        WHERE articles_fts MATCH ? ORDER BY rank LIMIT ?
                    """, (query, limit)).fetchall()
            except Exception:
                rows = []

            # 如果 FTS5 无结果，回退到 LIKE 模糊搜索
            if not rows:
                like_pattern = f"%{query}%"
                if section:
                    rows = conn.execute("""
                        SELECT *, '' AS snippet FROM articles
                        WHERE (title LIKE ? OR content LIKE ?) AND section = ?
                        ORDER BY publish_date DESC LIMIT ?
                    """, (like_pattern, like_pattern, section, limit)).fetchall()
                else:
                    rows = conn.execute("""
                        SELECT *, '' AS snippet FROM articles
                        WHERE title LIKE ? OR content LIKE ?
                        ORDER BY publish_date DESC LIMIT ?
                    """, (like_pattern, like_pattern, limit)).fetchall()

            return [dict(r) for r in rows]

    def list_recent(self, days: int = 7, limit: int = 50, section: str = None) -> list[dict]:
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if section:
                rows = conn.execute("""
                    SELECT article_id, title, url, section, section_name, publish_date, source
                    FROM articles WHERE publish_date >= ? AND section = ?
                    ORDER BY publish_date DESC LIMIT ?
                """, (cutoff, section, limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT article_id, title, url, section, section_name, publish_date, source
                    FROM articles WHERE publish_date >= ?
                    ORDER BY publish_date DESC LIMIT ?
                """, (cutoff, limit)).fetchall()
            return [dict(r) for r in rows]

    def get_stats(self) -> dict:
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
            sections = conn.execute(
                "SELECT section, section_name, COUNT(*) AS cnt FROM articles GROUP BY section ORDER BY cnt DESC"
            ).fetchall()
            latest = conn.execute("SELECT MAX(publish_date) FROM articles").fetchone()[0]
        return {
            "total_articles": total,
            "sections": [{"key": s[0], "name": s[1], "count": s[2]} for s in sections],
            "latest_date": latest, "db_path": self.db_path,
        }


class HunanEnvCrawler:
    """湖南省生态环境厅网站爬虫"""

    def __init__(self, store: PolicyStore = None):
        self.store = store or PolicyStore()

    def fetch_list_page(self, section_key: str, page: int = 1) -> list[dict]:
        section = SECTIONS.get(section_key)
        if not section:
            raise ValueError(f"Unknown section: {section_key}")
        if page == 1:
            url = f"{BASE_URL}{section['list_url']}"
        else:
            base = section['list_url'].rsplit('.', 1)[0]
            ext = section['list_url'].rsplit('.', 1)[1]
            url = f"{BASE_URL}{base}_{page}.{ext}"
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "EcoMind-OS/1.0 (Policy Crawler)"
            })
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            raise
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return []
        return self._extract_list_items(html, section_key)

    def _extract_list_items(self, html: str, section_key: str) -> list[dict]:
        section = SECTIONS.get(section_key, {})
        items = []
        if section.get("list_pattern") == "list_sy3":
            for m in re.finditer(
                r"<a\s+title='([^']*)'\s+target=\"_blank\"\s+href=\"(/sthjt/xxgk/[^\"]+\.html)\">\s*"
                r"<small>.*?(\d{4}-\d{2}-\d{2})</small>",
                html, re.DOTALL,
            ):
                items.append({"title": m.group(1).strip(), "url": m.group(2),
                              "date": m.group(3), "section": section_key})
        elif section.get("list_pattern") == "list_tyxx":
            for m in re.finditer(
                r'<a[^>]*href="(/sthjt/xxgk/[^"]+\.html)"[^>]*title="([^"]*)"[^>]*>.*?(\d{4}-\d{2}-\d{2})',
                html, re.DOTALL,
            ):
                items.append({"title": m.group(2).strip(), "url": m.group(1),
                              "date": m.group(3), "section": section_key})
        seen = set()
        unique = []
        for item in items:
            if item["url"] not in seen:
                seen.add(item["url"])
                unique.append(item)
        return unique

    def fetch_article(self, url_path: str) -> PolicyArticle | None:
        full_url = f"{BASE_URL}{url_path}" if not url_path.startswith("http") else url_path
        try:
            req = urllib.request.Request(full_url, headers={
                "User-Agent": "EcoMind-OS/1.0 (Policy Crawler)"
            })
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Failed to fetch {full_url}: {e}")
            return None

        meta = {}
        for m in re.finditer(r'<meta\s+name="([^"]+)"\s+content="([^"]*)"', html):
            meta[m.group(1)] = m.group(2)

        title = meta.get("ArticleTitle", "")
        pub_date = meta.get("PubDate", "")[:10]
        section_name = meta.get("ColumnName", "")
        source = "湖南省生态环境厅"

        if not title:
            title_m = re.search(r'<h2[^>]*>(.*?)</h2>', html, re.DOTALL)
            if title_m:
                title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip()

        content = ""
        attachments = []
        body_m = re.search(
            r'<div[^>]*class="main_con_zw"[^>]*>(.*?)</div>\s*<div[^>]*class="mian_con_foot"',
            html, re.DOTALL,
        )
        if body_m:
            body_html = body_m.group(1)
            for att_m in re.finditer(
                r'<a[^>]*href="([^"]+)"[^>]*type="file"[^>]*>(.*?)</a>',
                body_html, re.DOTALL,
            ):
                att_url = att_m.group(1).strip()
                att_name = re.sub(r'<[^>]+>', '', att_m.group(2)).strip()
                if any(att_url.lower().endswith(ext) for ext in ['.doc', '.docx', '.xls', '.xlsx', '.pdf']):
                    attachments.append({"name": att_name, "url": att_url})

            paras = re.findall(r'<p[^>]*>(.*?)</p>', body_html, re.DOTALL)
            content_parts = []
            for p in paras:
                clean = re.sub(r'<[^>]+>', '', p)
                clean = re.sub(r'&nbsp;', ' ', clean)
                clean = re.sub(r'&[a-z]+;', ' ', clean)
                clean = re.sub(r'\s+', ' ', clean).strip()
                if clean and len(clean) > 2:
                    content_parts.append(clean)
            content = '\n'.join(content_parts)

        article_id = self._extract_article_id(url_path)
        content_hash = SM3Hash.hash(content.encode("utf-8")) if content else ""

        return PolicyArticle(
            article_id=article_id, title=title, url=full_url,
            section="", section_name=section_name, publish_date=pub_date,
            source=source, content=content, content_hash=content_hash,
            attachments=attachments,
            crawled_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )

    def _extract_article_id(self, url_path: str) -> str:
        m = re.search(r't(\d{8})_(\d+)\.html', url_path)
        if m:
            return f"hn_{m.group(2)}"
        return SM3Hash.hash(url_path.encode("utf-8"))[:16]

    def crawl_section(self, section_key: str, max_pages: int = 5, days_back: int = 30) -> dict:
        section = SECTIONS.get(section_key)
        if not section:
            return {"error": f"Unknown section: {section_key}"}
        cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        new_count = 0
        total_found = 0
        for page in range(1, max_pages + 1):
            items = self.fetch_list_page(section_key, page)
            if not items:
                break
            for item in items:
                total_found += 1
                if item["date"] < cutoff_date:
                    continue
                article_id = self._extract_article_id(item["url"])
                if self.store.article_exists(article_id):
                    continue
                article = self.fetch_article(item["url"])
                if article:
                    article.section = section_key
                    article.section_name = section["name"]
                    if not article.publish_date:
                        article.publish_date = item["date"]
                    is_new = self.store.upsert_article(article)
                    if is_new:
                        new_count += 1
                        logger.info(f"New: [{section_key}] {article.title[:60]}")
                time.sleep(0.3)
        return {"section": section_key, "section_name": section["name"],
                "new_articles": new_count, "total_found": total_found}

    def crawl_all(self, sections: list[str] = None, max_pages: int = 3, days_back: int = 7) -> dict:
        if sections is None:
            sections = list(SECTIONS.keys())
        results = {}
        for sk in sections:
            results[sk] = self.crawl_section(sk, max_pages=max_pages, days_back=days_back)
        total_new = sum(r.get("new_articles", 0) for r in results.values())
        return {"sections": results, "total_new": total_new,
                "crawled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}


class HunanEnvPolicyMCPServer:
    """湖南省生态环境厅政策 MCP Server — 提供爬取、检索、详情、统计工具"""

    def __init__(self):
        self.store = PolicyStore()
        self.crawler = HunanEnvCrawler(store=self.store)

    def get_tools(self) -> list[dict]:
        return [
            {"name": "hunan_policy_crawl", "description": "爬取湖南省生态环境厅最新政策文件。板块: gfxwj(规范性文件), zcfgjd(政策解读), tzgg_tz(通知), tzgg_gg(公告), zxdt(环保动态), hjyw(环境要闻)",
             "inputSchema": {"type": "object", "properties": {
                 "sections": {"type": "array", "items": {"type": "string"}, "description": "板块列表，空=全部"},
                 "days_back": {"type": "integer", "default": 7, "description": "回溯天数"},
                 "max_pages": {"type": "integer", "default": 3, "description": "每板块最大页数"},
             }}},
            {"name": "hunan_policy_search", "description": "全文检索已抓取的湖南省生态环境政策",
             "inputSchema": {"type": "object", "properties": {
                 "query": {"type": "string", "description": "搜索关键词"},
                 "section": {"type": "string", "description": "板块过滤"},
                 "limit": {"type": "integer", "default": 20},
             }, "required": ["query"]}},
            {"name": "hunan_policy_latest", "description": "获取最新政策文件列表",
             "inputSchema": {"type": "object", "properties": {
                 "days": {"type": "integer", "default": 7},
                 "section": {"type": "string"},
                 "limit": {"type": "integer", "default": 50},
             }}},
            {"name": "hunan_policy_detail", "description": "获取指定政策完整内容",
             "inputSchema": {"type": "object", "properties": {
                 "article_id": {"type": "string"},
             }, "required": ["article_id"]}},
            {"name": "hunan_policy_stats", "description": "政策数据库统计",
             "inputSchema": {"type": "object", "properties": {}}},
        ]

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        handlers = {
            "hunan_policy_crawl": self._handle_crawl,
            "hunan_policy_search": self._handle_search,
            "hunan_policy_latest": self._handle_latest,
            "hunan_policy_detail": self._handle_detail,
            "hunan_policy_stats": self._handle_stats,
        }
        handler = handlers.get(tool_name)
        if not handler:
            return json.dumps({"error": f"Tool not found: {tool_name}"}, ensure_ascii=False)
        try:
            result = await handler(arguments)
            return result if isinstance(result, str) else json.dumps(result, ensure_ascii=False, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    async def _handle_crawl(self, args: dict) -> dict:
        return self.crawler.crawl_all(
            sections=args.get("sections") or list(SECTIONS.keys()),
            max_pages=args.get("max_pages", 3),
            days_back=args.get("days_back", 7),
        )

    async def _handle_search(self, args: dict) -> dict:
        results = self.store.search(args["query"], limit=args.get("limit", 20), section=args.get("section"))
        return {"query": args["query"], "count": len(results), "results": results}

    async def _handle_latest(self, args: dict) -> dict:
        results = self.store.list_recent(days=args.get("days", 7), limit=args.get("limit", 50), section=args.get("section"))
        return {"days": args.get("days", 7), "count": len(results), "results": results}

    async def _handle_detail(self, args: dict) -> dict:
        article = self.store.get_article(args["article_id"])
        return article if article else {"error": f"Article not found: {args['article_id']}"}

    async def _handle_stats(self, args: dict) -> dict:
        return self.store.get_stats()


_hunan_server: HunanEnvPolicyMCPServer | None = None

def get_hunan_policy_server() -> HunanEnvPolicyMCPServer:
    global _hunan_server
    if _hunan_server is None:
        _hunan_server = HunanEnvPolicyMCPServer()
    return _hunan_server


__all__ = [
    "HunanEnvPolicyMCPServer", "PolicyStore", "HunanEnvCrawler",
    "PolicyArticle", "SECTIONS", "get_hunan_policy_server",
]
