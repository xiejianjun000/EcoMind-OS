"""
/api/marketplace — 技能市场路由

支持技能发现、安装、卸载、评分和订阅管理。
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

# 市场技能数据 (与前端 MARKETPLACE_SKILLS 同步)
MARKET_SKILLS = [
    {"id": "skill-satellite", "name": "卫星遥感分析", "description": "基于 Sentinel-2/Landsat 卫星影像的生态环境变化检测", "category": "analysis", "author": "生态环境部卫星中心", "downloads": 2340, "rating": 4.8, "version": "v2.3.1", "tags": ["遥感", "AI", "变化检测"]},
    {"id": "skill-drone", "name": "无人机巡查路径规划", "description": "自动生成无人机生态环境巡查最优飞行路径和拍摄点", "category": "analysis", "author": "EcoMind Lab", "downloads": 1890, "rating": 4.6, "version": "v1.8.0", "tags": ["无人机", "路径规划", "巡查"]},
    {"id": "skill-carbon-accounting", "name": "碳排放核算引擎", "description": "基于 IPCC 方法学的企业/园区/城市碳排放自动核算", "category": "analysis", "author": "碳达峰研究院", "downloads": 3200, "rating": 4.9, "version": "v3.0.1", "tags": ["碳排放", "核算", "IPCC"]},
    {"id": "skill-water-model", "name": "水环境模型推演", "description": "基于 SWAT/MIKE 的水质水量耦合模拟与情景预测", "category": "analysis", "author": "水生态环境处", "downloads": 1560, "rating": 4.5, "version": "v2.1.0", "tags": ["水质", "模型", "预测"]},
    {"id": "skill-noise-map", "name": "噪声热力图生成", "description": "基于监测站点/移动监测数据的城市噪声热力图自动生成", "category": "visualization", "author": "监测处", "downloads": 980, "rating": 4.3, "version": "v1.5.2", "tags": ["噪声", "热力图", "GIS"]},
    {"id": "skill-doc-ocr", "name": "执法文书 OCR 识别", "description": "手写/扫描执法文书的 OCR 识别与结构化信息提取", "category": "recognition", "author": "执法局", "downloads": 2750, "rating": 4.7, "version": "v2.4.0", "tags": ["OCR", "文书", "执法"]},
    {"id": "skill-biodiv-identify", "name": "生物多样性 AI 鉴定", "description": "基于图像/声音的动植物物种自动识别与生物多样性评估", "category": "recognition", "author": "生态研究所", "downloads": 1680, "rating": 4.4, "version": "v1.9.1", "tags": ["生物多样性", "AI识别", "生态"]},
    {"id": "skill-report-gen", "name": "智能报告生成器", "description": "基于模板和数据自动生成监测日报/执法周报/环评报告", "category": "generation", "author": "EcoMind Lab", "downloads": 4100, "rating": 4.8, "version": "v3.2.0", "tags": ["报告", "自动生成", "模板"]},
    {"id": "skill-emergency-dispersion", "name": "突发污染扩散模拟", "description": "危化品泄漏/大气污染突发事件的实时扩散模拟与应急响应", "category": "analysis", "author": "应急管理中心", "downloads": 1250, "rating": 4.6, "version": "v2.0.3", "tags": ["应急", "扩散", "模拟"]},
    {"id": "skill-gis-overlay", "name": "GIS 多图层叠加分析", "description": "生态红线/保护区/排污口/监测站等多源 GIS 图层叠加分析", "category": "visualization", "author": "GIS中心", "downloads": 2100, "rating": 4.5, "version": "v2.2.0", "tags": ["GIS", "图层", "叠加分析"]},
    {"id": "skill-law-search", "name": "法规智能检索", "description": "生态环境法律法规语义检索、条款匹配与历史案例关联", "category": "compliance", "author": "法规处", "downloads": 3500, "rating": 4.9, "version": "v3.1.0", "tags": ["法规", "检索", "案例"]},
    {"id": "skill-data-quality", "name": "监测数据质量审计", "description": "自动检测监测数据异常值、缺失值、逻辑矛盾并生成质量报告", "category": "compliance", "author": "监测处", "downloads": 1450, "rating": 4.4, "version": "v1.7.0", "tags": ["数据质量", "审计", "异常检测"]},
]


@router.get("/skills", summary="技能市场列表")
async def list_market_skills(
    category: Optional[str] = Query(default=None, description="按分类过滤"),
    search: Optional[str] = Query(default=None, description="搜索关键词"),
    sort: str = Query(default="downloads", description="排序方式: downloads/rating/newest"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """获取技能市场可安装技能列表。"""
    skills = list(MARKET_SKILLS)

    if category:
        skills = [s for s in skills if s["category"] == category]
    if search:
        kw = search.lower()
        skills = [s for s in skills if kw in s["name"].lower() or kw in s["description"].lower() or any(kw in t.lower() for t in s.get("tags", []))]

    if sort == "rating":
        skills.sort(key=lambda s: s["rating"], reverse=True)
    elif sort == "newest":
        skills.sort(key=lambda s: s["version"], reverse=True)
    else:
        skills.sort(key=lambda s: s["downloads"], reverse=True)

    total = len(skills)
    paged = skills[offset:offset + limit]

    return {"skills": paged, "total": total, "offset": offset, "limit": limit}


@router.get("/skills/{skill_id}", summary="技能详情")
async def get_skill(skill_id: str) -> dict:
    """获取指定技能详情。"""
    for skill in MARKET_SKILLS:
        if skill["id"] == skill_id:
            return {"skill": skill, "installed": False}
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"技能不存在: {skill_id}")


@router.get("/trending", summary="热门技能")
async def get_trending(limit: int = Query(default=5, ge=1, le=20)) -> dict:
    """获取热门技能排行。"""
    sorted_skills = sorted(MARKET_SKILLS, key=lambda s: s["downloads"], reverse=True)
    return {"skills": sorted_skills[:limit]}
