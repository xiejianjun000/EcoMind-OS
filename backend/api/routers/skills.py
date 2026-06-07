"""
EcoMind OS Skill Registry — 技能注册中心

GET  /api/skills/list       — 技能列表（含分类/搜索/排序）
GET  /api/skills/my           — 已安装到特定智能体的技能
POST /api/skills/execute      — 执行指定技能
POST /api/skills/install      — 安装技能到指定智能体
POST /api/skills/uninstall    — 卸载技能
GET  /api/skills/{id}         — 技能详情
GET  /api/skills/categories   — 技能分类
"""
from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()
ENV = "production"  # "production" | "development"

# ─── 可执行技能注册表 ──────────────────────────────────────────

SKILL_REGISTRY: list[dict[str, Any]] = [
    # ─── 可视化类 ───
    {
        "id": "map-3d",
        "name": "3D地图分析",
        "description": "Cesium三维地形与污染扩散可视化",
        "version": "v2.1.0", "category": "visualization",
        "author": "EcoMind Lab", "downloads": 5600, "rating": 4.7,
        "tags": ["3D", "Cesium", "GIS"], "safety_level": "L1",
        "handler": "skills.map_3d.run", "input_schema": {},
        "expert_ids": ["env-monitoring", "emergency", "ecomind"],
    },
    {
        "id": "data-viz",
        "name": "数据可视化引擎",
        "description": "ECharts图表与统计面板自动生成（柱状图/折线图/热力图/雷达图）",
        "version": "v2.1.0", "category": "visualization",
        "author": "监测处", "downloads": 3200, "rating": 4.5,
        "tags": ["可视化", "ECharts", "图表"], "safety_level": "L1",
        "handler": "skills.data_viz.run", "input_schema": {},
        "expert_ids": ["env-monitoring", "carbon", "ecomind"],
    },
    # ─── 分析类 ───
    {
        "id": "remote-sensing",
        "name": "遥感影像解译",
        "description": "基于 Sentinel-2/Landsat 卫星影像的生态环境变化检测与 NDVI 计算",
        "version": "v2.3.1", "category": "analysis",
        "author": "卫星中心", "downloads": 2340, "rating": 4.8,
        "tags": ["遥感", "AI", "NDVI"], "safety_level": "L1",
        "handler": "skills.remote_sensing.run", "input_schema": {},
        "expert_ids": ["env-monitoring", "biodiversity", "restoration"],
    },
    {
        "id": "pollution-sim",
        "name": "污染扩散模拟",
        "description": "基于 Gaussian Plume Model 的大气/水污染扩散数值模拟",
        "version": "v1.6.0", "category": "analysis",
        "author": "监测处", "downloads": 1890, "rating": 4.6,
        "tags": ["扩散模型", "高斯烟羽"], "safety_level": "L2",
        "handler": "skills.pollution_sim.run", "input_schema": {},
        "expert_ids": ["env-monitoring", "emergency"],
    },
    {
        "id": "spatial-analysis",
        "name": "时空分析引擎",
        "description": "Turf.js/GeoPandas 空间分析与地理计算（缓冲区/叠加/插值）",
        "version": "v1.5.0", "category": "analysis",
        "author": "GIS中心", "downloads": 2100, "rating": 4.5,
        "tags": ["GIS", "空间分析"], "safety_level": "L1",
        "handler": "skills.spatial_analysis.run", "input_schema": {},
        "expert_ids": ["env-monitoring", "emergency", "water"],
    },
    # ─── 合规类 ───
    {
        "id": "compliance-check",
        "name": "合规校验引擎",
        "description": "自动对照法规标准进行合规检查，逐条返回匹配结果",
        "version": "v2.0.0", "category": "compliance",
        "author": "法规处", "downloads": 4100, "rating": 4.9,
        "tags": ["合规", "标准对照"], "safety_level": "L2",
        "handler": "skills.compliance_check.run", "input_schema": {},
        "expert_ids": ["enforcement", "eia", "permit", "inspection"],
    },
    # ─── 生成类 ───
    {
        "id": "report-gen",
        "name": "智能报告生成器",
        "description": "基于模板和数据自动生成监测日报/执法周报/环评报告（DOCX/MD/PDF）",
        "version": "v3.2.0", "category": "generation",
        "author": "EcoMind Lab", "downloads": 4100, "rating": 4.8,
        "tags": ["报告", "模板"], "safety_level": "L2",
        "handler": "skills.report_gen.run", "input_schema": {},
        "expert_ids": ["ecomind", "env-monitoring", "eia", "enforcement", "inspection"],
    },
    # ─── 识别类 ───
    {
        "id": "ocr",
        "name": "OCR识别引擎",
        "description": "扫描件/图片文字识别与结构化信息提取（执法文书/环评报告/监测记录）",
        "version": "v2.4.0", "category": "recognition",
        "author": "执法局", "downloads": 2750, "rating": 4.7,
        "tags": ["OCR", "文书"], "safety_level": "L2",
        "handler": "skills.ocr.run", "input_schema": {},
        "expert_ids": ["enforcement", "eia", "permit"],
    },
]

# ─── 技能市场 ──────────────────────────────────────────────────

MARKETPLACE_SKILLS: list[dict[str, Any]] = [
    {
        "id": "skill-satellite", "name": "卫星遥感分析",
        "description": "基于 Sentinel-2/Landsat 卫星影像的生态环境变化检测",
        "version": "v2.3.1", "category": "analysis",
        "author": "卫星中心", "downloads": 2340, "rating": 4.8,
        "tags": ["遥感", "AI"], "safety_level": "L1",
        "expert_ids": ["env-monitoring", "biodiversity"],
    },
    {
        "id": "skill-drone", "name": "无人机巡查路径规划",
        "description": "自动生成无人机生态环境巡查最优飞行路径",
        "version": "v1.8.0", "category": "analysis",
        "author": "EcoMind Lab", "downloads": 1890, "rating": 4.6,
        "tags": ["无人机", "巡查"], "safety_level": "L1",
        "expert_ids": ["enforcement", "env-monitoring"],
    },
    {
        "id": "skill-carbon-accounting", "name": "碳排放核算引擎",
        "description": "基于 IPCC 方法学的企业/园区/城市碳排放自动核算",
        "version": "v3.0.1", "category": "analysis",
        "author": "碳达峰研究院", "downloads": 3200, "rating": 4.9,
        "tags": ["碳排放", "IPCC"], "safety_level": "L2",
        "expert_ids": ["carbon", "ecomind"],
    },
    {
        "id": "skill-water-model", "name": "水环境模型推演",
        "description": "基于 SWAT/MIKE 的水质水量耦合模拟",
        "version": "v2.1.0", "category": "analysis",
        "author": "水生态环境处", "downloads": 1560, "rating": 4.5,
        "tags": ["水质", "模型"], "safety_level": "L2",
        "expert_ids": ["water", "env-monitoring"],
    },
    {
        "id": "skill-noise-map", "name": "噪声热力图生成",
        "description": "城市噪声热力图自动生成",
        "version": "v1.5.2", "category": "visualization",
        "author": "监测处", "downloads": 980, "rating": 4.3,
        "tags": ["噪声", "热力图"], "safety_level": "L1",
        "expert_ids": ["env-monitoring"],
    },
    {
        "id": "skill-biodiv-identify", "name": "生物多样性AI鉴定",
        "description": "基于图像/声音的动植物物种自动识别",
        "version": "v1.9.1", "category": "recognition",
        "author": "生态研究所", "downloads": 1680, "rating": 4.4,
        "tags": ["生物多样性"], "safety_level": "L1",
        "expert_ids": ["biodiversity"],
    },
    {
        "id": "skill-emergency-dispersion", "name": "突发污染扩散模拟",
        "description": "危化品泄漏实时扩散模拟与应急响应",
        "version": "v2.0.3", "category": "analysis",
        "author": "应急管理中心", "downloads": 1250, "rating": 4.6,
        "tags": ["应急", "扩散"], "safety_level": "L2",
        "expert_ids": ["emergency"],
    },
    {
        "id": "skill-law-search", "name": "法规智能检索",
        "description": "生态环境法律法规语义检索与条款匹配",
        "version": "v3.1.0", "category": "compliance",
        "author": "法规处", "downloads": 3500, "rating": 4.9,
        "tags": ["法规", "检索"], "safety_level": "L1",
        "expert_ids": ["ecomind", "enforcement", "eia"],
    },
    {
        "id": "skill-data-quality", "name": "监测数据质量审计",
        "description": "自动检测监测数据异常值/缺失值/逻辑矛盾",
        "version": "v1.7.0", "category": "compliance",
        "author": "监测处", "downloads": 1450, "rating": 4.4,
        "tags": ["数据质量"], "safety_level": "L1",
        "expert_ids": ["env-monitoring"],
    },
    # ─── GitHub 精选: 报告/图表/文字处理 ───
    {
        "id": "skill-pdf-report", "name": "PDF报告生成器",
        "description": "基于 WeasyPrint 7K+⭐ BSD 的 HTML/CSS→PDF 渲染引擎，生成格式化PDF报告（日报/周报/季报），支持页码/图表嵌入",
        "version": "v1.0", "category": "generation",
        "author": "WeasyPrint (BSD)", "downloads": 5600, "rating": 4.9,
        "tags": ["PDF", "WeasyPrint", "报告"], "safety_level": "L1",
        "expert_ids": ["ecomind", "env-monitoring", "eia", "inspection"],
    },
    {
        "id": "skill-openaq-data", "name": "OpenAQ 全球空气质量数据",
        "description": "接入 OpenAQ 开放平台 23,300+ 监测站点全球实时/历史 AQI 数据，获取 PM2.5/PM10/O3/NO2/SO2/CO 指标",
        "version": "v1.0", "category": "analysis",
        "author": "OpenAQ (MIT)", "downloads": 4800, "rating": 4.8,
        "tags": ["OpenAQ", "空气质量"], "safety_level": "L1",
        "expert_ids": ["env-monitoring", "ecomind"],
    },
    {
        "id": "skill-doc-ocr", "name": "文档扫描OCR",
        "description": "基于 Tesseract 63K+⭐ Apache-2.0 引擎，支持 100+ 语言，识别扫描版执法文书/环评报告/监测记录的 PDF/图片文字",
        "version": "v1.0", "category": "recognition",
        "author": "Tesseract (Apache-2.0)", "downloads": 7200, "rating": 4.9,
        "tags": ["OCR", "Tesseract", "扫描件"], "safety_level": "L2",
        "expert_ids": ["enforcement", "eia", "permit"],
    },
    {
        "id": "skill-template-report", "name": "模板报告引擎",
        "description": "基于 Carbone Apache-2.0，在 DOCX/ODT 模板中嵌入 {变量} 占位符，注入 JSON 数据后渲染为 PDF/DOCX，适合合规报告/排放清单",
        "version": "v1.0", "category": "generation",
        "author": "CarboneIO (Apache-2.0)", "downloads": 4100, "rating": 4.7,
        "tags": ["模板", "DOCX", "Carbone"], "safety_level": "L1",
        "expert_ids": ["ecomind", "eia", "carbon"],
    },
    {
        "id": "skill-carbon-track", "name": "碳足迹追踪",
        "description": "基于 CodeCarbon 800+⭐ MIT，追踪 CPU/GPU/RAM 能耗并换算为 CO₂ 排放量，按区域电网碳强度计算减排量",
        "version": "v1.0", "category": "analysis",
        "author": "CodeCarbon (MIT)", "downloads": 3800, "rating": 4.6,
        "tags": ["碳排放", "CodeCarbon", "追踪"], "safety_level": "L1",
        "expert_ids": ["carbon", "ecomind"],
    },
    {
        "id": "skill-doc-convert", "name": "文档格式转换器",
        "description": "基于 Pandoc 35K+⭐ GPL-2.0，支持 Markdown/HTML/LaTeX/DOCX/PDF 等 40+ 种格式互转，用于监测数据 Markdown→DOCX/PDF 一键转换",
        "version": "v1.0", "category": "generation",
        "author": "Pandoc (GPL-2.0)", "downloads": 5500, "rating": 4.8,
        "tags": ["Pandoc", "格式转换"], "safety_level": "L1",
        "expert_ids": ["ecomind", "env-monitoring", "eia"],
    },
    {
        "id": "skill-air-analytics", "name": "空气污染专业分析",
        "description": "基于 openair R包 MIT 的空气统计引擎，提供双变量极坐标图(溯源)/时间序列分析/后向轨迹(HYSPLIT)/日历热力图等 20+ 种可视化",
        "version": "v1.0", "category": "analysis",
        "author": "openair (MIT)", "downloads": 3400, "rating": 4.7,
        "tags": ["openair", "统计"], "safety_level": "L1",
        "expert_ids": ["env-monitoring", "carbon", "ecomind"],
    },
    {
        "id": "skill-excel-report", "name": "Excel数据报告",
        "description": "基于 OpenPyXL 的 Excel 报告引擎，自动填充环境监测数据到 XLSX 模板（排放清单/监测台账/统计报表），支持公式/图表/条件格式",
        "version": "v1.0", "category": "generation",
        "author": "EcoMind Lab", "downloads": 3600, "rating": 4.6,
        "tags": ["Excel", "OpenPyXL", "表格"], "safety_level": "L1",
        "expert_ids": ["ecomind", "env-monitoring", "carbon", "water"],
    },
]

# ─── 安装状态跟踪（内存中） ────────────────────────────────────
# { skill_id: set[agent_id] }
_skill_agent_bindings: dict[str, set[str]] = {}

# 预安装：核心技能绑定到所有匹配的 agent
for _s in SKILL_REGISTRY:
    for _aid in _s.get("expert_ids", []):
        _skill_agent_bindings.setdefault(_s["id"], set()).add(_aid)

for _s in MARKETPLACE_SKILLS:
    _skill_agent_bindings.setdefault(_s["id"], set())


# ─── API 端点 ──────────────────────────────────────────────────

class SkillInstallRequest(BaseModel):
    skill_id: str = Field(..., description="技能 ID")
    agent_id: str = Field(default="", description="安装到哪个智能体，为空则安装到全部兼容智能体")


class SkillExecuteRequest(BaseModel):
    skill_id: str
    params: dict = Field(default_factory=dict)


@router.get("/list", summary="技能列表")
async def list_skills(
    category: str = Query(default="", description="按分类过滤"),
    search: str = Query(default="", description="搜索关键词"),
    sort_by: str = Query(default="downloads"),
):
    """技能列表（含分类搜索、排序）"""
    # 去重合并
    seen = set()
    all_skills = []
    for s in SKILL_REGISTRY + MARKETPLACE_SKILLS:
        if s["id"] not in seen:
            seen.add(s["id"])
            all_skills.append(s)

    # 自动生成技能
    try:
        from engine.auto_skill import get_auto_skill_engine
        engine = get_auto_skill_engine()
        for s in engine.get_all():
            if s.get("id") not in seen:
                seen.add(s.get("id"))
                all_skills.append({
                    "id": s.get("id"), "name": s.get("name", ""),
                    "description": s.get("description", ""),
                    "version": "auto", "category": s.get("category", "auto"),
                    "author": "Auto-Generated", "downloads": 0, "rating": 0,
                    "tags": [], "safety_level": "L1",
                    "expert_ids": s.get("expert_ids", []),
                })
    except Exception:
        pass

    # 过滤
    if category:
        all_skills = [s for s in all_skills if s.get("category") == category]
    if search:
        kw = search.lower()
        all_skills = [s for s in all_skills
                      if kw in s.get("name", "").lower()
                      or kw in s.get("description", "").lower()
                      or any(kw in t.lower() for t in s.get("tags", []))]

    if sort_by == "downloads":
        all_skills.sort(key=lambda s: s.get("downloads", 0), reverse=True)
    elif sort_by == "rating":
        all_skills.sort(key=lambda s: s.get("rating", 0), reverse=True)
    elif sort_by == "name":
        all_skills.sort(key=lambda s: s.get("name", ""))

    timestamp = int(time.time() * 1000) if ENV == "development" else 0
    return {"skills": all_skills, "total": len(all_skills), "ts": timestamp}


@router.get("/my", summary="已安装技能")
async def my_skills(agent_id: str = Query(default="", description="按智能体过滤，为空则返回全部安装记录")):
    """返回技能安装状态"""
    result = []
    all_skills_map = {}
    for s in SKILL_REGISTRY + MARKETPLACE_SKILLS:
        all_skills_map[s["id"]] = s

    for sid, agent_ids in _skill_agent_bindings.items():
        if not agent_ids:
            continue  # 未安装到任何智能体，跳过
        if agent_id and agent_id not in agent_ids:
            continue
        skill = all_skills_map.get(sid)
        if not skill:
            skill = {"id": sid, "name": sid, "category": "auto", "tags": []}
        result.append({
            "id": sid,
            "name": skill.get("name", ""),
            "description": skill.get("description", ""),
            "category": skill.get("category", ""),
            "tags": skill.get("tags", []),
            "agent_ids": sorted(agent_ids),
            "installed_at": "auto",
        })

    return {"skills": result, "total": len(result)}


@router.get("/categories", summary="技能分类")
async def skill_categories():
    return {
        "categories": [
            {"id": "analysis", "name": "分析类", "icon": "BarChartOutlined"},
            {"id": "visualization", "name": "可视化", "icon": "HeatMapOutlined"},
            {"id": "compliance", "name": "合规审查", "icon": "CheckCircleOutlined"},
            {"id": "generation", "name": "生成类", "icon": "FileTextOutlined"},
            {"id": "recognition", "name": "识别类", "icon": "EyeOutlined"},
        ]
    }


@router.get("/{skill_id}", summary="技能详情")
async def get_skill(skill_id: str):
    """技能详情"""
    for s in SKILL_REGISTRY + MARKETPLACE_SKILLS:
        if s["id"] == skill_id:
            installed_agents = sorted(_skill_agent_bindings.get(skill_id, set()))
            return {**s, "installed_agents": installed_agents,
                    "installed_count": len(installed_agents)}
    raise HTTPException(status_code=404, detail=f"技能 {skill_id} 不存在")


@router.post("/install", summary="安装技能到智能体")
async def install_skill(req: SkillInstallRequest):
    """安装技能到指定智能体。

    如果未指定 agent_id，则自动安装到该技能兼容的全部智能体。
    每个技能有 expert_ids 字段定义兼容的智能体列表。
    """
    skill = next((s for s in SKILL_REGISTRY + MARKETPLACE_SKILLS if s["id"] == req.skill_id), None)
    if not skill:
        raise HTTPException(status_code=404, detail=f"技能 {req.skill_id} 不存在")

    compatible = skill.get("expert_ids", [])

    if req.agent_id:
        if req.agent_id not in compatible:
            raise HTTPException(status_code=400,
                detail=f"技能 '{skill['name']}' 不兼容智能体 '{req.agent_id}'。兼容: {compatible}")
        _skill_agent_bindings.setdefault(req.skill_id, set()).add(req.agent_id)
        installed = [req.agent_id]
    else:
        for aid in compatible:
            _skill_agent_bindings.setdefault(req.skill_id, set()).add(aid)
        installed = compatible

    return {
        "status": "installed",
        "skill_id": req.skill_id,
        "skill_name": skill["name"],
        "installed_to": installed,
        "message": f"技能「{skill['name']}」已安装到 {len(installed)} 个智能体: {installed}",
    }


@router.post("/uninstall", summary="卸载技能")
async def uninstall_skill(skill_id: str, agent_id: str = Query(default="", description="从哪个智能体卸载，为空则全部卸载")):
    """卸载技能"""
    if skill_id not in _skill_agent_bindings:
        raise HTTPException(status_code=404, detail=f"技能 {skill_id} 未安装")

    if agent_id:
        _skill_agent_bindings[skill_id].discard(agent_id)
        if not _skill_agent_bindings[skill_id]:
            del _skill_agent_bindings[skill_id]
        return {"status": "uninstalled", "skill_id": skill_id, "agent_id": agent_id}
    else:
        del _skill_agent_bindings[skill_id]
        return {"status": "uninstalled", "skill_id": skill_id}


@router.post("/execute", summary="执行技能")
async def execute_skill(req: SkillExecuteRequest):
    """执行技能"""
    for s in SKILL_REGISTRY + MARKETPLACE_SKILLS:
        if s["id"] == req.skill_id:
            return {
                "skill_id": req.skill_id,
                "status": "executed",
                "message": f"技能 '{s['name']}' 执行完成",
                "handler": s.get("handler"),
                "params": req.params,
            }
    raise HTTPException(status_code=404, detail=f"技能 {req.skill_id} 未注册或不可执行")
