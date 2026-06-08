"""
EcoMind 技能沉淀引擎 — Hermes 级自我学习闭环

用户主动触发 → LLM 提炼 → 生成结构化技能 → 注册到技能广场
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills" / "auto"
SKILLS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class AutoSkill:
    id: str
    name: str
    display_name: str
    description: str
    category: str
    author: str
    author_name: str
    triggers: list[str]
    tools_used: list[str]
    steps: list[str]
    source_conversation: str
    created_at: float
    usage_count: int = 0
    rating: float = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name, "display_name": self.display_name,
            "description": self.description, "category": self.category,
            "author": self.author, "author_name": self.author_name,
            "triggers": self.triggers, "tools_used": self.tools_used,
            "steps": self.steps, "source_conversation": self.source_conversation,
            "created_at": self.created_at, "usage_count": self.usage_count,
            "rating": self.rating, "auto_generated": True,
        }

    def to_markdown(self) -> str:
        fm = {
            "name": self.name, "display_name": self.display_name,
            "author": f"{self.author_name} (技能沉淀)", "category": self.category,
            "triggers": self.triggers, "tools": self.tools_used,
            "auto_generated": True, "created_at": self.created_at,
        }
        md = "---\n"
        for k, v in fm.items():
            md += f"{k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, list) else v}\n"
        md += "---\n\n"
        md += f"# {self.display_name}\n\n"
        md += f"> 来源：{self.source_conversation}\n\n"
        md += f"## 执行步骤\n"
        for i, step in enumerate(self.steps, 1):
            md += f"{i}. {step}\n"
        md += f"\n## 使用工具\n"
        for t in self.tools_used:
            md += f"- {t}\n"
        return md


# ─── LLM 提炼 Prompt ──────────────────────────────────

_EXTRACT_PROMPT = """你是一个技能提炼助手。从以下对话中提取可复用的工作流，输出 JSON 格式。

## 对话内容

用户问题: {user_message}

助手回复（摘要）: {response_summary}

使用的工具: {tools_used}

## 输出要求

返回纯 JSON（不要 markdown 代码块）：

{{
    "display_name": "简短的中文技能名（10字以内，如：臭氧溯源分析）",
    "description": "一句话描述这个技能做什么（30字以内）",
    "triggers": ["触发词1", "触发词2", "触发词3"],
    "steps": [
        "第1步：具体操作说明",
        "第2步：具体操作说明",
        "第3步：具体操作说明"
    ]
}}

规则：
- display_name 要精炼、可检索
- triggers 是用户可能输入的关键词（2-4字），3-5个
- steps 是可执行的操作步骤，每步一句，3-5步
- description 要说明产出什么结果"""


class AutoSkillEngine:
    """技能沉淀引擎"""

    def __init__(self):
        self._skills: dict[str, AutoSkill] = {}
        self._load_existing()

    def _load_existing(self):
        for f in SKILLS_DIR.glob("*.md"):
            try:
                skill = self._parse_skill_file(f)
                if skill:
                    self._skills[skill.id] = skill
            except Exception as e:
                logger.warning(f"加载技能失败 {f}: {e}")
        logger.info(f"已加载 {len(self._skills)} 个技能")

    def _parse_skill_file(self, filepath: Path) -> Optional[AutoSkill]:
        content = filepath.read_text(encoding="utf-8")
        parts = content.split("---", 2)
        if len(parts) < 3:
            return None
        fm_text = parts[1]
        fm = {}
        for line in fm_text.strip().split("\n"):
            if ":" in line:
                key, _, val = line.partition(":")
                key, val = key.strip(), val.strip()
                if val.startswith("[") and val.endswith("]"):
                    try:
                        fm[key] = json.loads(val)
                    except json.JSONDecodeError:
                        fm[key] = [v.strip().strip('"') for v in val[1:-1].split(",")]
                else:
                    fm[key] = val.strip('"')
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
            description=fm.get("description", ""),
            category=fm.get("category", "general"),
            author=fm.get("author", "system"),
            author_name=fm.get("author_name", "系统"),
            triggers=fm.get("triggers", []),
            tools_used=fm.get("tools", []),
            steps=steps,
            source_conversation=fm.get("source", ""),
            created_at=fm.get("created_at", time.time()),
        )

    async def distill_and_create(
        self,
        expert_id: str,
        expert_name: str,
        user_message: str,
        assistant_response: str,
        tools_used: list[str],
    ) -> dict:
        """
        LLM 提炼 + 生成技能。返回 {skill_id, display_name, steps, ...}
        """
        # 1. 调用 LLM 提炼
        prompt = _EXTRACT_PROMPT.format(
            user_message=user_message[:500],
            response_summary=assistant_response[:1500],
            tools_used=", ".join(tools_used),
        )

        api_key = os.environ.get("DEEPSEEK_API_KEY", "")
        api_base = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{api_base}/chat/completions",
                    json={
                        "model": "deepseek-chat",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                        "max_tokens": 600,
                        "stream": False,
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key}",
                    },
                )
                if resp.status_code != 200:
                    raise Exception(f"LLM API 错误: {resp.status_code}")

                data = resp.json()
                llm_output = data["choices"][0]["message"]["content"]

                # 提取 JSON
                json_match = re.search(r"\{[\s\S]*\}", llm_output)
                if not json_match:
                    raise Exception(f"LLM 未返回有效 JSON: {llm_output[:200]}")

                extracted = json.loads(json_match.group(0))

        except Exception as e:
            logger.warning(f"LLM 提炼失败，使用基础提取: {e}")
            extracted = self._fallback_extract(user_message, assistant_response, tools_used)

        # 2. 生成技能
        category = self._infer_category(expert_id, tools_used)
        h = hashlib.md5(user_message.encode()).hexdigest()[:8]
        name = f"{category}-{h}"

        skill = AutoSkill(
            id=name,
            name=name,
            display_name=extracted.get("display_name", user_message[:15]),
            description=extracted.get("description", user_message[:60]),
            category=category,
            author=expert_id,
            author_name=expert_name,
            triggers=extracted.get("triggers", [])[:5],
            tools_used=list(set(tools_used)),
            steps=extracted.get("steps", [])[:5],
            source_conversation=user_message[:200],
            created_at=time.time(),
        )

        # 3. 保存
        filepath = SKILLS_DIR / f"{name}.md"
        filepath.write_text(skill.to_markdown(), encoding="utf-8")
        self._skills[skill.id] = skill

        logger.info(f"🎓 技能沉淀完成: {skill.display_name} ({len(skill.steps)}步, {len(skill.triggers)}触发词)")

        return {
            "skill_id": skill.id,
            "display_name": skill.display_name,
            "description": skill.description,
            "triggers": skill.triggers,
            "steps": skill.steps,
            "tools_used": skill.tools_used,
            "category": skill.category,
        }

    def _infer_category(self, expert_id: str, tools: list[str]) -> str:
        cat_map = {
            "enforcement": "enforcement", "eia": "eia", "permit": "approval",
            "carbon": "emission", "water": "water", "env-monitoring": "monitoring",
            "emergency": "emergency", "biodiversity": "ecology",
            "restoration": "restoration", "inspection": "inspection", "public": "public",
        }
        return cat_map.get(expert_id, "general")

    def _fallback_extract(self, user_msg: str, response: str, tools: list[str]) -> dict:
        """LLM 不可用时的回退提取"""
        keywords = list(set(re.findall(r"[\u4e00-\u9fff]{2,4}", user_msg)))[:5]
        sentences = [s.strip()[:80] for s in response.split("。") if len(s.strip()) > 10][:4]
        return {
            "display_name": user_msg[:15] + ("..." if len(user_msg) > 15 else ""),
            "description": user_msg[:60],
            "triggers": keywords,
            "steps": [f"使用 {', '.join(tools[:3])} 处理: {user_msg[:50]}"]
            if not sentences else sentences,
        }

    def get_all(self, author: str = "") -> list[dict]:
        skills = list(self._skills.values())
        if author:
            skills = [s for s in skills if s.author == author or s.author_name == author]
        return [s.to_dict() for s in sorted(skills, key=lambda s: s.created_at, reverse=True)]

    def get_my_skills(self, expert_id: str) -> list[dict]:
        return self.get_all(author=expert_id)

    def delete(self, skill_id: str) -> bool:
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
