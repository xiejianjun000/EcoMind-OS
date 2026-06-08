"""
EcoMind Skill Marketplace API — FastAPI REST

端点: 对标 Trae Solo marketplace 的 50 技能管理
  GET    /api/marketplace/skills    — 技能列表
  GET    /api/marketplace/skills/{name}  — 技能详情
  POST   /api/marketplace/install   — 安装技能
  DELETE /api/marketplace/uninstall/{name} — 卸载
  POST   /api/marketplace/enable/{name}    — 启用
  POST   /api/marketplace/disable/{name}   — 禁用
  POST   /api/marketplace/rate/{name}      — 评分
  GET    /api/marketplace/stats            — 统计
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/api/marketplace", tags=["Skill Marketplace"])


def _get_marketplace():
    from marketplace.engine import SkillMarketplace
    mp = SkillMarketplace.get_instance()
    mp.register_builtin_skills()
    return mp


class InstallRequest(BaseModel):
    name: str
    description: str = ""
    category: str = "general"
    version: str = "1.0.0"


class RateRequest(BaseModel):
    rating: int = Field(ge=1, le=5)


@router.get("/skills")
async def list_skills(category: str = "", enabled_only: bool = False):
    mp = _get_marketplace()
    skills = mp.list_skills(category=category, enabled_only=enabled_only)
    return {
        "total": len(skills),
        "skills": [
            {
                "name": s.name, "version": s.version,
                "description": s.description, "category": s.category,
                "author": s.author, "installed": s.installed,
                "enabled": s.enabled, "usage_count": s.usage_count,
                "rating": round(s.rating, 1), "ratings_count": s.ratings_count,
            }
            for s in skills
        ],
    }


@router.get("/skills/{name}")
async def get_skill(name: str):
    mp = _get_marketplace()
    s = mp.get_skill(name)
    if not s:
        raise HTTPException(404, f"技能 '{name}' 不存在")
    return {
        "name": s.name, "version": s.version,
        "description": s.description, "category": s.category,
        "author": s.author, "dependencies": s.dependencies,
        "permissions": s.permissions, "installed": s.installed,
        "enabled": s.enabled, "usage_count": s.usage_count,
        "rating": round(s.rating, 1), "ratings_count": s.ratings_count,
    }


@router.post("/install")
async def install_skill(req: InstallRequest):
    mp = _get_marketplace()
    msg = mp.install(req.name, {
        "description": req.description,
        "category": req.category,
        "version": req.version,
    })
    return {"message": msg}


@router.delete("/uninstall/{name}")
async def uninstall_skill(name: str):
    mp = _get_marketplace()
    msg = mp.uninstall(name)
    return {"message": msg}


@router.post("/enable/{name}")
async def enable_skill(name: str):
    mp = _get_marketplace()
    msg = mp.enable(name)
    return {"message": msg}


@router.post("/disable/{name}")
async def disable_skill(name: str):
    mp = _get_marketplace()
    msg = mp.disable(name)
    return {"message": msg}


@router.post("/rate/{name}")
async def rate_skill(name: str, req: RateRequest):
    mp = _get_marketplace()
    msg = mp.rate(name, req.rating)
    return {"message": msg}


@router.get("/stats")
async def marketplace_stats():
    mp = _get_marketplace()
    return mp.get_stats()
