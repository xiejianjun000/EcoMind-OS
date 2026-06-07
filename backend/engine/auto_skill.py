"""
EcoMind 自动技能生成引擎

闭环学习：对话经验 → 自动提取 → 生成技能 → 注册到技能广场
每个专家实例的经验自动沉淀为可复用技能
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills" / "auto"
SKILLS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class AutoSkill:
    """自动生成的技能"""
    id: str
    name: str
    display_name: str
    description: str
    category: str
    author: str              # 哪个专家生成的
    author_name: str
    triggers: list[str]
    tools_used: list[str]
    steps: list[str]         # 操作步骤
    source_conversation: str # 来源会话摘要
    created_at: float
    usage_count: int = 0
    rating: float = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "category": self.category,
            "author": self.author,
            "author_name": self.author_name,
            "triggers": self.triggers,
            "tools_used": self.tools_used,
            "steps": self.steps,
            "source_conversation": self.source_conversation,
            "created_at": self.created_at,
            "usage_count": self.usage_count,
            "rating": self.rating,
            "auto_generated": True,
        }

    def to_markdown(self) -> str:
        """生成技能 Markdown 文件"""
        fm = {
            "name": self.name,
            "display_name": self.display_name,
            "author": f"{self.author_name} (自动生成)",
            "category": self.category,
            "triggers": self.triggers,
            "tools": self.tools_used,
            "auto_generated": True,
            "created_at": self.created_at,
        }

        md = "---\n"
        for k, v in fm.items():
            if isinstance(v, list):
                md += f"{k}: {json.dumps(v, ensure_ascii=False)}\n"
            else:
                md += f"{k}: {v}\n"
        md += "---\n\n"
        md += f"# {self.display_name}\n\n"
        md += f"> 由 {self.author_name} 自动生成 | 来源：{self.source_conversation}\n\n"
        md += f"## 描述\n{self.description}\n\n"
        md += "## 执行步骤\n"
        for i, step in enumerate(self.steps, 1):
            md += f"{i}. {step}\n"
        md += f"\n## 使用工具\n"
        for t in self.tools_used:
            md += f"- {t}\n"
        return md


class AutoSkillEngine:
    """自动技能引擎"""

    def __init__(self):
        self._skills: dict[str, AutoSkill] = {}
        self._load_existing()

    def _load_existing(self):
        """加载已有自动技能"""
        for f in SKILLS_DIR.glob("*.md"):
            try:
                skill = self._parse_skill_file(f)
                if skill:
                    self._skills[skill.id] = skill
            except Exception as e:
                logger.warning(f"加载技能失败 {f}: {e}")

        # 也加载 ECC 技能
        ecc_dir = SKILLS_DIR.parent / "ecc" / "hunan-agents"
        if ecc_dir.exists():
            for f in ecc_dir.glob("agent-*.md"):
                name = f.stem.replace("agent-", "")
                if name not in self._skills:
                    self._skills[name] = AutoSkill(
                        id=name,
                        name=name,
                        display_name=f.read_text(encoding="utf-8").split("\n")[2].replace("display_name: ", "") if f.exists() else name,
                        description="",
                        category="ecc",
                        author="system",
                        author_name="ECC系统",
                        triggers=[],
                        tools_used=[],
                        steps=[],
                        source_conversation="ECC预置",
                        created_at=f.stat().st_mtime,
                    )

        logger.info(f"已加载 {len(self._skills)} 个技能")

    def _parse_skill_file(self, filepath: Path) -> Optional[AutoSkill]:
        """解析技能 Markdown 文件"""
        content = filepath.read_text(encoding="utf-8")
        parts = content.split("---", 2)
        if len(parts) < 3:
            return None

        fm_text = parts[1]
        fm = {}
        for line in fm_text.strip().split("\n"):
            if ":" in line:
                key, _, val = line.partition(":")
                key = key.strip()
                val = val.strip()
                if val.startswith("[") and val.endswith("]"):
                    try:
                        fm[key] = json.loads(val)
                    except json.JSONDecodeError:
                        fm[key] = [v.strip().strip('"') for v in val[1:-1].split(",")]
                else:
                    fm[key] = val

        body = parts[2]
        steps = []
        for line in body.split("\n"):
            line = line.strip()
            if re.match(r"^\d+\.\s", line):
                steps.append(re.sub(r"^\d+\.\s*", "", line))

        return AutoSkill(
            id=fm.get("name", filepath.stem),
            name=fm.get("name", filepath.stem),
            display_name=fm.get("display_name", filepath.stem),
            description=fm.get("description", body[:200].strip()),
            category=fm.get("category", "general"),
            author=fm.get("author", "system"),
            author_name=fm.get("author_name", "系统"),
            triggers=fm.get("triggers", []),
            tools_used=fm.get("tools", []),
            steps=steps,
            source_conversation=fm.get("source", ""),
            created_at=fm.get("created_at", time.time()),
        )

    async def try_extract_and_create(
        self,
        expert_id: str,
        expert_name: str,
        user_message: str,
        assistant_response: str,
        tools_used: list[str],
    ) -> Optional[str]:
        """
        尝试从对话中提取经验并自动生成技能。
        由 ecomind 在每轮对话后调用。
        返回 skill_id 或 None（如果不值得生成）
        """
        # 判断是否值得生成技能的条件：
        # 1. 使用了 3+ 个工具（说明有完整工作流）
        # 2. 回复长度 > 300 字（说明有实质内容）
        # 3. 不是简单问候
        if len(tools_used) < 3:
            return None
        if len(assistant_response) < 300:
            return None
        if len(user_message) < 10:
            return None

        # 提取关键信息
        category = self._infer_category(expert_id, tools_used)
        triggers = self._extract_triggers(user_message, assistant_response)
        steps = self._extract_steps(assistant_response)
        name = self._generate_skill_name(user_message, category)

        skill = AutoSkill(
            id=name,
            name=name,
            display_name=self._generate_display_name(user_message, category),
            description=user_message[:100],
            category=category,
            author=expert_id,
            author_name=expert_name,
            triggers=triggers,
            tools_used=list(set(tools_used)),
            steps=steps,
            source_conversation=user_message[:200],
            created_at=time.time(),
        )

        # 保存到文件
        filepath = SKILLS_DIR / f"{name}.md"
        filepath.write_text(skill.to_markdown(), encoding="utf-8")

        # 注册到内存
        self._skills[skill.id] = skill

        logger.info(f"🎓 自动生成技能: {skill.display_name} (by {expert_name})")
        return skill.id

    def _infer_category(self, expert_id: str, tools: list[str]) -> str:
        """推断技能分类"""
        cat_map = {
            "enforcement": "enforcement",
            "eia": "eia",
            "permit": "approval",
            "carbon": "emission",
            "water": "water",
            "env-monitoring": "monitoring",
            "emergency": "emergency",
            "biodiversity": "ecology",
            "restoration": "restoration",
            "inspection": "inspection",
            "public": "public",
        }
        return cat_map.get(expert_id, "general")

    def _extract_triggers(self, user_msg: str, response: str) -> list[str]:
        """从对话中提取触发关键词"""
        # 从用户消息中提取名词和动词作为触发词
        keywords = []
        # 简单的关键词提取
        for word in re.findall(r"[\u4e00-\u9fff]{2,4}", user_msg):
            if word not in keywords and len(word) >= 2:
                keywords.append(word)
        return keywords[:8]

    def _extract_steps(self, response: str) -> list[str]:
        """从回复中提取操作步骤"""
        steps = []
        # 匹配 "第一步"、"第N步"、"首先"、"然后"、"最后" 等
        patterns = [
            r"(第[一二三四五六七八九十\d]+[步阶段])[：:]*\s*(.+?)(?=第[一二三四五六七八九十\d]+[步阶段]|$)",
            r"(首先|然后|接着|最后|最终|此外|另外)[，,]*\s*(.+?)(?=首先|然后|接着|最后|最终|此外|另外|$)",
        ]
        for pattern in patterns:
            matches = re.findall(pattern, response, re.DOTALL)
            for m in matches:
                step_text = f"{m[0]}：{m[1][:80].strip()}"
                if step_text not in steps:
                    steps.append(step_text)
            if len(steps) >= 3:
                break

        # 如果没匹配到，取前3个句号分隔的句子
        if not steps:
            sentences = response.split("。")
            for s in sentences[:4]:
                s = s.strip()
                if len(s) > 10:
                    steps.append(s[:80])

        return steps[:6]

    def _generate_skill_name(self, user_msg: str, category: str) -> str:
        """生成技能英文名"""
        # 简单哈希
        h = hashlib.md5(user_msg.encode()).hexdigest()[:8]
        return f"{category}-{h}"

    def _generate_display_name(self, user_msg: str, category: str) -> str:
        """生成技能中文名"""
        # 取用户消息的前15个字作为技能名
        short = user_msg[:20].strip()
        if len(short) > 15:
            short = short[:15] + "..."
        return short

    def get_all(self, author: str = "") -> list[dict]:
        """获取所有自动技能"""
        skills = list(self._skills.values())
        if author:
            skills = [s for s in skills if s.author == author or s.author_name == author]
        return [s.to_dict() for s in sorted(skills, key=lambda s: s.created_at, reverse=True)]

    def get_my_skills(self, expert_id: str) -> list[dict]:
        """获取某个专家的技能（我的技能）"""
        return self.get_all(author=expert_id)

    def delete(self, skill_id: str) -> bool:
        """删除技能"""
        if skill_id in self._skills:
            del self._skills[skill_id]
            filepath = SKILLS_DIR / f"{skill_id}.md"
            if filepath.exists():
                filepath.unlink()
            return True
        return False


# 全局单例
_auto_skill_engine: Optional[AutoSkillEngine] = None


def get_auto_skill_engine() -> AutoSkillEngine:
    global _auto_skill_engine
    if _auto_skill_engine is None:
        _auto_skill_engine = AutoSkillEngine()
    return _auto_skill_engine
