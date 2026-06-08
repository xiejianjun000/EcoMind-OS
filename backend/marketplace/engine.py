"""
EcoMind Plugin Marketplace — 插件化技能生态

对标 Trae Solo 的 marketplace 体系 (50 个 skill):
  - 技能注册/发现/安装/卸载/升级
  - 依赖管理（跨技能引用）
  - 启用/禁用热切换
  - 技能评分 + 使用统计
  - 内置 15 个 EcoMind 垂直领域技能
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hermes_memory.db"
SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"
MARKETPLACE_CONFIG = Path(__file__).resolve().parent / "marketplace.json"


@dataclass
class SkillMeta:
    name: str
    version: str = "1.0.0"
    description: str = ""
    author: str = ""
    category: str = "general"
    dependencies: list[str] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    entry_point: str = ""          # Python 模块路径
    installed: bool = False
    enabled: bool = True
    install_date: str = ""
    last_used: float = 0
    usage_count: int = 0
    rating: float = 0.0
    ratings_count: int = 0


class SkillMarketplace:
    """EcoMind 技能市场"""

    _instance: Optional[SkillMarketplace] = None

    def __init__(self):
        self._skills: dict[str, SkillMeta] = {}
        self._ensure_schema()
        self._load_registry()
        self._load_config()

    @classmethod
    def get_instance(cls) -> SkillMarketplace:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_schema(self):
        conn = sqlite3.connect(str(DB_PATH))
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS skill_registry (
                name TEXT PRIMARY KEY,
                version TEXT NOT NULL DEFAULT '1.0.0',
                description TEXT DEFAULT '',
                author TEXT DEFAULT '',
                category TEXT DEFAULT 'general',
                dependencies TEXT DEFAULT '[]',
                permissions TEXT DEFAULT '[]',
                entry_point TEXT DEFAULT '',
                installed INTEGER DEFAULT 1,
                enabled INTEGER DEFAULT 1,
                install_date TEXT DEFAULT '',
                last_used REAL DEFAULT 0,
                usage_count INTEGER DEFAULT 0,
                rating REAL DEFAULT 0.0,
                ratings_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS skill_usage_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill_name TEXT NOT NULL,
                session_id TEXT DEFAULT '',
                called_at REAL NOT NULL
            );
        """)
        conn.commit()
        conn.close()

    def _load_registry(self):
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM skill_registry").fetchall()
        for r in rows:
            self._skills[r["name"]] = SkillMeta(
                name=r["name"], version=r["version"], description=r["description"],
                author=r["author"], category=r["category"],
                dependencies=json.loads(r["dependencies"]) if r["dependencies"] else [],
                permissions=json.loads(r["permissions"]) if r["permissions"] else [],
                entry_point=r["entry_point"] or "",
                installed=bool(r["installed"]), enabled=bool(r["enabled"]),
                install_date=r["install_date"] or "",
                last_used=r["last_used"] or 0, usage_count=r["usage_count"] or 0,
                rating=r["rating"] or 0.0, ratings_count=r["ratings_count"] or 0,
            )
        conn.close()
        logger.info("技能注册表: %d 个技能已加载", len(self._skills))

    def _load_config(self):
        """加载 marketplace.json 配置"""
        if MARKETPLACE_CONFIG.exists():
            with open(MARKETPLACE_CONFIG) as f:
                cfg = json.load(f)
            for item in cfg.get("skills", []):
                name = item.get("name", "")
                if name and name not in self._skills:
                    self._skills[name] = SkillMeta(
                        name=name, version=item.get("version", "1.0.0"),
                        description=item.get("description", ""),
                        author=item.get("author", "EcoMind"),
                        category=item.get("category", "environment"),
                        dependencies=item.get("dependencies", []),
                        permissions=item.get("permissions", []),
                        entry_point=item.get("entry_point", f"skills.{name}"),
                    )

    def _save_registry(self, name: str):
        conn = sqlite3.connect(str(DB_PATH))
        s = self._skills.get(name)
        if not s:
            conn.close()
            return
        conn.execute(
            """INSERT OR REPLACE INTO skill_registry
               (name, version, description, author, category, dependencies, permissions,
                entry_point, installed, enabled, install_date, last_used, usage_count,
                rating, ratings_count)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (s.name, s.version, s.description, s.author, s.category,
             json.dumps(s.dependencies), json.dumps(s.permissions),
             s.entry_point, int(s.installed), int(s.enabled),
             s.install_date, s.last_used, s.usage_count, s.rating, s.ratings_count),
        )
        conn.commit()
        conn.close()

    # ── CRUD ────────────────────────────────────────

    def list_skills(self, category: str = "", enabled_only: bool = False) -> list[SkillMeta]:
        skills = list(self._skills.values())
        if category:
            skills = [s for s in skills if s.category == category]
        if enabled_only:
            skills = [s for s in skills if s.enabled]
        return sorted(skills, key=lambda s: -s.usage_count)

    def get_skill(self, name: str) -> Optional[SkillMeta]:
        return self._skills.get(name)

    def install(self, name: str, meta: Optional[dict] = None) -> str:
        if name in self._skills and self._skills[name].installed:
            return f"技能 '{name}' 已安装"

        s = SkillMeta(name=name, install_date=datetime.now().isoformat(), installed=True)
        if meta:
            for k, v in meta.items():
                if hasattr(s, k):
                    setattr(s, k, v)

        self._skills[name] = s
        self._save_registry(name)
        logger.info("技能已安装: %s (%s)", name, s.version)
        return f"✅ 技能 '{name}' v{s.version} 安装成功"

    def uninstall(self, name: str) -> str:
        if name not in self._skills:
            return f"技能 '{name}' 不存在"
        s = self._skills[name]
        s.installed = False
        s.enabled = False
        self._save_registry(name)
        return f"🗑️ 技能 '{name}' 已卸载"

    def enable(self, name: str) -> str:
        s = self._skills.get(name)
        if not s:
            return f"技能 '{name}' 不存在"
        s.enabled = True
        self._save_registry(name)
        return f"✅ 技能 '{name}' 已启用"

    def disable(self, name: str) -> str:
        s = self._skills.get(name)
        if not s:
            return f"技能 '{name}' 不存在"
        s.enabled = False
        self._save_registry(name)
        return f"⏸️ 技能 '{name}' 已禁用"

    def record_usage(self, name: str, session_id: str = "") -> None:
        s = self._skills.get(name)
        if not s:
            return
        s.last_used = time.time()
        s.usage_count += 1
        self._save_registry(name)

        conn = sqlite3.connect(str(DB_PATH))
        conn.execute(
            "INSERT INTO skill_usage_log (skill_name, session_id, called_at) VALUES (?,?,?)",
            (name, session_id, time.time()),
        )
        conn.commit()
        conn.close()

    def rate(self, name: str, rating: int) -> str:
        s = self._skills.get(name)
        if not s:
            return f"技能 '{name}' 不存在"
        if rating < 1 or rating > 5:
            return "评分范围 1-5"
        s.rating = (s.rating * s.ratings_count + rating) / (s.ratings_count + 1)
        s.ratings_count += 1
        self._save_registry(name)
        return f"⭐ {name} 评分: {s.rating:.1f}/5 ({s.ratings_count}人)"

    def get_stats(self) -> dict:
        total = len([s for s in self._skills.values() if s.installed and s.enabled])
        by_cat: dict[str, int] = {}
        for s in self._skills.values():
            by_cat[s.category] = by_cat.get(s.category, 0) + 1
        return {
            "total_skills": total,
            "by_category": by_cat,
            "most_used": sorted(
                [{"name": s.name, "count": s.usage_count} for s in self._skills.values() if s.usage_count > 0],
                key=lambda x: -x["count"],
            )[:10],
        }

    # ─── 内置技能注册 ───

    def register_builtin_skills(self):
        """注册 EcoMind 内置的 15 个生态环境垂直技能"""
        builtins = [
            {"name": "env-monitoring", "category": "environment",
             "description": "实时环境监测数据查询 (AQI/PM2.5/PM10/O₃/水质/噪声), 14市州"},
            {"name": "env-enforcement", "category": "enforcement",
             "description": "环境执法案件管理: 立案→调查→处罚→结案 全流程"},
            {"name": "env-eia-approval", "category": "approval",
             "description": "环境影响评价审批: 项目受理→技术审查→审批决定→公示"},
            {"name": "env-compliance", "category": "compliance",
             "description": "企业合规检查: 排污许可/排放标准/自行监测/危废管理"},
            {"name": "env-carbon", "category": "carbon",
             "description": "碳排放管理: 碳核算/配额/交易/CCER/碳足迹"},
            {"name": "env-water", "category": "water",
             "description": "水生态管理: 断面水质/饮用水源/黑臭水体/排污口"},
            {"name": "env-emergency", "category": "emergency",
             "description": "环境应急: 突发污染事件/应急预案/应急监测/处置方案"},
            {"name": "env-biodiversity", "category": "ecology",
             "description": "生物多样性保护: 物种监测/保护区/生态红线/生态补偿"},
            {"name": "env-soil", "category": "soil",
             "description": "土壤修复: 污染地块/重金属/修复方案/效果评估"},
            {"name": "env-solidwaste", "category": "waste",
             "description": "固废管理: 危废/医废/生活垃圾/建筑垃圾/资源化"},
            {"name": "env-noise", "category": "noise",
             "description": "噪声管理: 功能区噪声/施工噪声/工业噪声/投诉处理"},
            {"name": "env-radiation", "category": "nuclear",
             "description": "核与辐射安全: 放射源/射线装置/电磁辐射/核应急"},
            {"name": "env-public", "category": "public",
             "description": "公众服务: 投诉受理/信息公开/环保宣传/办事指南"},
            {"name": "env-report", "category": "report",
             "description": "报告生成: 环境监测日报/周报/月报/季报/年报/执法文书/环评报告"},
            {"name": "env-data-analysis", "category": "analysis",
             "description": "环境数据分析: 趋势分析/污染溯源/相关性分析/GIS空间分析"},
        ]
        for b in builtins:
            if b["name"] not in self._skills:
                self._skills[b["name"]] = SkillMeta(
                    name=b["name"], version="1.0.0", description=b["description"],
                    author="EcoMind OS", category=b["category"],
                    installed=True, enabled=True,
                    install_date=datetime.now().isoformat(),
                )
                self._save_registry(b["name"])

        logger.info("内置技能注册完成: %d 个", len(builtins))
