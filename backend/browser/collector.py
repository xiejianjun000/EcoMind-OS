"""
EcoMind 浏览器自动化 — 环境政务网站数据采集

对标 Trae Solo agent-browser:
  自动爬取各市州生态环境局公示信息
  自动检测"公示期满"的环评项目并生成审批提醒
  监控"行政处罚"页面的新增案件

数据源:
  湖南省生态环境厅  https://sthjt.hunan.gov.cn/
  各市州生态环境局 (14个)
  生态环境部        https://www.mee.gov.cn/
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hermes_memory.db"

# 默认监控页面
WATCH_TARGETS = [
    {
        "name": "湖南省-环评审批公示",
        "url": "https://sthjt.hunan.gov.cn/sthjt/xxgk/xzgs/hpsp/index.html",
        "category": "eia",
        "check_interval_h": 6,
    },
    {
        "name": "湖南省-行政处罚",
        "url": "https://sthjt.hunan.gov.cn/sthjt/xxgk/xzgs/xzcf/index.html",
        "category": "enforcement",
        "check_interval_h": 12,
    },
    {
        "name": "湖南省-通知公告",
        "url": "https://sthjt.hunan.gov.cn/sthjt/xxgk/tzgg/tz/list_tyxx.html",
        "category": "notice",
        "check_interval_h": 4,
    },
]


def _ensure_schema():
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS eco_browser_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            title TEXT DEFAULT '',
            content_hash TEXT DEFAULT '',
            category TEXT DEFAULT '',
            source_name TEXT DEFAULT '',
            fetched_at REAL NOT NULL,
            is_new INTEGER DEFAULT 1,
            summary TEXT DEFAULT '',
            metadata TEXT DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS eco_browser_watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            category TEXT DEFAULT '',
            check_interval_h INTEGER DEFAULT 24,
            last_checked REAL DEFAULT 0,
            enabled INTEGER DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_ebp_url ON eco_browser_pages(url);
        CREATE INDEX IF NOT EXISTS idx_ebp_fetched ON eco_browser_pages(fetched_at);
    """)
    conn.commit()
    conn.close()


_ensure_schema()


@dataclass
class PageResult:
    url: str
    title: str
    content: str
    summary: str = ""
    category: str = ""
    is_new: bool = True


class EcoBrowser:
    """环境政务网站自动化浏览器"""

    _instance: Optional[EcoBrowser] = None

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._seen_urls: set[str] = set()

    @classmethod
    def get_instance(cls) -> EcoBrowser:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    async def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30,
                headers={
                    "User-Agent": "EcoMind-OS/1.0 (Environmental Monitoring Agent)"
                },
                follow_redirects=True,
            )
        return self._client

    async def fetch_page(self, url: str) -> Optional[str]:
        """获取页面 HTML"""
        try:
            client = await self.client
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.text
            logger.warning("fetch %s → HTTP %d", url, resp.status_code)
            return None
        except Exception as e:
            logger.error("fetch %s: %s", url, str(e)[:80])
            return None

    async def extract_links(self, url: str, selector: str = "a[href]") -> list[dict]:
        """提取页面中的链接"""
        html = await self.fetch_page(url)
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        links = []
        for a in soup.select(selector):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if href and text and len(text) > 3:
                full_url = urljoin(url, href)
                links.append({"url": full_url, "title": text[:200]})
        return links

    async def watch(self, target: Optional[dict] = None) -> list[PageResult]:
        """
        监控一个目标页面 → 提取新内容。

        1. 抓取页面
        2. 提取链接
        3. 与已见链接对比
        4. 返回新链接列表
        """
        targets = [target] if target else WATCH_TARGETS
        results: list[PageResult] = []

        for t in targets:
            if not t.get("enabled", True):
                continue

            name = t["name"]
            url = t["url"]
            category = t.get("category", "")

            logger.info("监控: %s (%s)", name, url)
            links = await self.extract_links(url)

            for link in links[:20]:  # 只看前 20 条
                link_url = link["url"]
                content_hash = hashlib.md5(link_url.encode()).hexdigest()[:12]

                if content_hash in self._seen_urls:
                    continue
                self._seen_urls.add(content_hash)

                # 检查是否已存储
                conn = sqlite3.connect(str(DB_PATH))
                existing = conn.execute(
                    "SELECT id FROM eco_browser_pages WHERE content_hash = ?",
                    (content_hash,),
                ).fetchone()

                is_new = not existing
                if is_new:
                    conn.execute(
                        """INSERT INTO eco_browser_pages
                           (url, title, content_hash, category, source_name, fetched_at, is_new, metadata)
                           VALUES (?, ?, ?, ?, ?, ?, 1, ?)""",
                        (link_url, link["title"][:500], content_hash,
                         category, name, time.time(),
                         json.dumps(link, ensure_ascii=False)),
                    )
                conn.commit()
                conn.close()

                results.append(PageResult(
                    url=link_url,
                    title=link["title"],
                    content="",
                    category=category,
                    is_new=is_new,
                ))

        if results:
            logger.info("发现 %d 条新内容", len(results))
        return results

    async def deep_fetch(self, url: str) -> Optional[PageResult]:
        """
        深度抓取单个页面的完整内容。

        用于用户说"帮我看看这个环评公示"时。
        """
        html = await self.fetch_page(url)
        if not html:
            return None

        soup = BeautifulSoup(html, "html.parser")

        # 标题
        title_tag = soup.find("h1") or soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else url

        # 正文
        content_el = soup.find("article") or soup.find("div", class_="content") or soup.find("body")
        content = content_el.get_text(separator="\n", strip=True) if content_el else html
        content = content[:5000]

        # 摘要
        summary = content[:300] + ("..." if len(content) > 300 else "")

        return PageResult(
            url=url,
            title=title[:200],
            content=content,
            summary=summary,
            is_new=True,
        )

    async def run_watchdog(self) -> dict:
        """运行一次全量监控"""
        results = await self.watch()
        new_count = sum(1 for r in results if r.is_new)
        return {
            "targets_checked": len(WATCH_TARGETS),
            "new_items": new_count,
            "total_items": len(results),
            "results": [
                {"title": r.title, "url": r.url, "category": r.category, "is_new": r.is_new}
                for r in results[:10]
            ],
        }

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    def status(self) -> dict:
        conn = sqlite3.connect(str(DB_PATH))
        total = conn.execute("SELECT COUNT(*) FROM eco_browser_pages").fetchone()
        recent = conn.execute(
            "SELECT COUNT(*) FROM eco_browser_pages WHERE fetched_at > ?",
            (time.time() - 86400,),
        ).fetchone()
        new = conn.execute(
            "SELECT COUNT(*) FROM eco_browser_pages WHERE is_new = 1",
        ).fetchone()
        conn.close()
        return {
            "total_pages": total[0] if total else 0,
            "recent_24h": recent[0] if recent else 0,
            "unread": new[0] if new else 0,
            "watch_targets": len(WATCH_TARGETS),
        }
