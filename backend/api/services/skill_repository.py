"""
SkillRepository — 专家技能沉淀系统

借鉴 Multica 的"可复用技能"理念：
- 每个专家完成的解决方案自动沉淀为团队技能
- 技能有标签、适用场景、置信度
- 后续专家遇到相似任务时可复用已有技能
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)


class SkillCategory(str, Enum):
    ANALYSIS = "analysis"          # 分析类
    REPORT = "report"              # 报告类
    LEGAL = "legal"                # 法律类
    TECHNICAL = "technical"        # 技术方案类
    COMMUNICATION = "communication"  # 沟通类
    EMERGENCY = "emergency"        # 应急类


@dataclass
class SkillRecord:
    """技能记录 — Multica 风格的可复用技能"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    description: str = ""
    category: SkillCategory = SkillCategory.ANALYSIS
    tags: list[str] = field(default_factory=list)
    created_by: str = ""           # 创建该技能的专家 ID
    created_from_task: str = ""    # 来源任务 ID
    content: str = ""              # 技能内容（提示词/流程/模板）
    reusable_by: list[str] = field(default_factory=list)  # 可复用该技能的专家
    usage_count: int = 0
    avg_rating: float = 0.0
    version: int = 1
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "tags": self.tags,
            "created_by": self.created_by,
            "created_from_task": self.created_from_task,
            "content": self.content,
            "reusable_by": self.reusable_by,
            "usage_count": self.usage_count,
            "avg_rating": self.avg_rating,
            "version": self.version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class SkillRepository:
    """技能仓库"""

    def __init__(self):
        self._skills: dict[str, SkillRecord] = {}

    def create(self, skill: SkillRecord) -> SkillRecord:
        self._skills[skill.id] = skill
        logger.info(f"技能沉淀: {skill.name} (by {skill.created_by})")
        return skill

    def get(self, skill_id: str) -> Optional[SkillRecord]:
        return self._skills.get(skill_id)

    def search(self, tags: list[str] | None = None, category: SkillCategory | None = None,
               expert_id: str | None = None) -> list[SkillRecord]:
        """按标签/分类/专家搜索技能"""
        results = list(self._skills.values())
        if tags:
            results = [s for s in results if any(t in s.tags for t in tags)]
        if category:
            results = [s for s in results if s.category == category]
        if expert_id:
            results = [s for s in results if expert_id in s.reusable_by or s.created_by == expert_id]
        return results

    def increment_usage(self, skill_id: str):
        if skill_id in self._skills:
            self._skills[skill_id].usage_count += 1

    def list_all(self) -> list[SkillRecord]:
        return list(self._skills.values())


# 全局单例
_skill_repo: Optional[SkillRepository] = None


def get_skill_repository() -> SkillRepository:
    global _skill_repo
    if _skill_repo is None:
        _skill_repo = SkillRepository()
    return _skill_repo
