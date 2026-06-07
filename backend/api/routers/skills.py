"""
EcoMind OS Skill Registry — 技能注册中心

GET  /api/skills/list       — 技能市场列表（搜索/筛选/下载）
POST /api/skills/execute    — 执行指定技能
GET  /api/skills/{id}       — 技能详情
"""
from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── 可执行技能注册表 ──────────────────────────────────────────

SKILL_REGISTRY: list[dict[str, Any]] = [
    {
        "id": "map-3d",
        "name": "3D地图分析",
        "description": "Cesium三维地形与污染扩散可视化",
        "version": "v2.1.0",
        "category": "visualization",
        "author": "EcoMind Lab",
        "downloads": 5600,
        "rating": 4.7,
        "tags": ["3D", "Cesium", "GIS", "污染扩散"],
        "safety_level": "L1",
        "handler": "skills.map_3d.run",
        "input_schema": {
            "city": {"type": "string", "required": True},
            "layers": {"type": "array", "items": {"type": "string"}},
        },
    },
    {
        "id": "remote-sensing",
        "name": "遥感影像解译",
        "description": "基于 Sentinel-2/Landsat 卫星影像的生态环境变化检测与 NDVI 计算",
        "version": "v2.3.1",
        "category": "analysis",
        "author": "生态环境部卫星中心",
        "downloads": 2340,
        "rating": 4.8,
        "tags": ["遥感", "AI", "变化检测", "NDVI"],
        "safety_level": "L1",
        "handler": "skills.remote_sensing.run",
        "input_schema": {
            "lat": {"type": "number"},
            "lng": {"type": "number"},
            "date_range": {"type": "string"},
        },
    },
    {
        "id": "pollution-sim",
        "name": "污染扩散模拟",
        "description": "基于 Gaussian Plume Model 的大气/水污染扩散数值模拟",
        "version": "v1.6.0",
        "category": "analysis",
        "author": "监测处",
        "downloads": 1890,
        "rating": 4.6,
        "tags": ["扩散模型", "高斯烟羽", "模拟"],
        "safety_level": "L2",
        "handler": "skills.pollution_sim.run",
        "input_schema": {
            "source_lat": {"type": "number"},
            "source_lng": {"type": "number"},
            "emission_rate": {"type": "number"},
            "wind_speed": {"type": "number"},
            "wind_direction": {"type": "number"},
        },
    },
    {
        "id": "compliance-check",
        "name": "合规校验引擎",
        "description": "自动对照法规标准进行合规检查，逐条返回匹配结果",
        "version": "v2.0.0",
        "category": "compliance",
        "author": "法规处",
        "downloads": 4100,
        "rating": 4.9,
        "tags": ["合规", "法规", "标准对照"],
        "safety_level": "L2",
        "handler": "skills.compliance_check.run",
        "input_schema": {
            "target_type": {"type": "string"},
            "target_description": {"type": "string"},
        },
    },
    {
        "id": "report-gen",
        "name": "智能报告生成器",
        "description": "基于模板和数据自动生成监测日报/执法周报/环评报告（DOCX/MD/PDF）",
        "version": "v3.2.0",
        "category": "generation",
        "author": "EcoMind Lab",
        "downloads": 4100,
        "rating": 4.8,
        "tags": ["报告", "自动生成", "模板"],
        "safety_level": "L2",
        "handler": "skills.report_gen.run",
        "input_schema": {
            "template": {"type": "string", "enum": ["daily", "weekly", "enforcement", "eia"]},
            "city": {"type": "string"},
            "data": {"type": "object"},
        },
    },
    {
        "id": "ocr",
        "name": "OCR识别引擎",
        "description": "扫描件/图片文字识别与结构化信息提取（执法文书/环评报告/监测记录）",
        "version": "v2.4.0",
        "category": "recognition",
        "author": "执法局",
        "downloads": 2750,
        "rating": 4.7,
        "tags": ["OCR", "文书", "结构化"],
        "safety_level": "L2",
        "handler": "skills.ocr.run",
        "input_schema": {
            "file_path": {"type": "string", "required": True},
            "parse_mode": {"type": "string", "enum": ["ocr", "table", "auto"]},
        },
    },
    {
        "id": "data-viz",
        "name": "数据可视化引擎",
        "description": "ECharts图表与统计面板自动生成（柱状图/折线图/热力图/雷达图）",
        "version": "v2.1.0",
        "category": "visualization",
        "author": "监测处",
        "downloads": 3200,
        "rating": 4.5,
        "tags": ["可视化", "ECharts", "图表"],
        "safety_level": "L1",
        "handler": "skills.data_viz.run",
        "input_schema": {
            "chart_type": {"type": "string", "enum": ["bar", "line", "heatmap", "radar"]},
            "data": {"type": "object"},
        },
    },
    {
        "id": "spatial-analysis",
        "name": "时空分析引擎",
        "description": "Turf.js/GeoPandas 空间分析与地理计算（缓冲区/叠加/插值）",
        "version": "v1.5.0",
        "category": "analysis",
        "author": "GIS中心",
        "downloads": 2100,
        "rating": 4.5,
        "tags": ["GIS", "空间分析", "缓冲区"],
        "safety_level": "L1",
        "handler": "skills.spatial_analysis.run",
        "input_schema": {
            "operation": {"type": "string", "enum": ["buffer", "overlay", "interpolate"]},
            "geometry": {"type": "object"},
        },
    },
]

# ─── 技能市场额外技能（可搜索/下载） ────────────────────────────

MARKETPLACE_SKILLS: list[dict[str, Any]] = [
    {
        "id": "skill-satellite",
        "name": "卫星遥感分析",
        "description": "基于 Sentinel-2/Landsat 卫星影像的生态环境变化检测",
        "category": "analysis",
        "author": "生态环境部卫星中心",
        "downloads": 2340,
        "rating": 4.8,
        "version": "v2.3.1",
        "tags": ["遥感", "AI", "变化检测"],
    },
    {
        "id": "skill-drone",
        "name": "无人机巡查路径规划",
        "description": "自动生成无人机生态环境巡查最优飞行路径",
        "category": "analysis",
        "author": "EcoMind Lab",
        "downloads": 1890,
        "rating": 4.6,
        "tags": ["无人机", "路径规划", "巡查"],
    },
    {
        "id": "skill-carbon-accounting",
        "name": "碳排放核算引擎",
        "description": "基于 IPCC 方法学的企业/园区/城市碳排放自动核算",
        "category": "analysis",
        "author": "碳达峰研究院",
        "downloads": 3200,
        "rating": 4.9,
        "tags": ["碳排放", "核算", "IPCC"],
    },
    {
        "id": "skill-water-model",
        "name": "水环境模型推演",
        "description": "基于 SWAT/MIKE 的水质水量耦合模拟",
        "category": "analysis",
        "author": "水生态环境处",
        "downloads": 1560,
        "rating": 4.5,
        "tags": ["水质", "模型", "预测"],
    },
    {
        "id": "skill-noise-map",
        "name": "噪声热力图生成",
        "description": "城市噪声热力图自动生成",
        "category": "visualization",
        "author": "监测处",
        "downloads": 980,
        "rating": 4.3,
        "tags": ["噪声", "热力图"],
    },
    {
        "id": "skill-biodiv-identify",
        "name": "生物多样性AI鉴定",
        "description": "基于图像/声音的动植物物种自动识别",
        "category": "recognition",
        "author": "生态研究所",
        "downloads": 1680,
        "rating": 4.4,
        "tags": ["生物多样性", "AI识别"],
    },
    {
        "id": "skill-emergency-dispersion",
        "name": "突发污染扩散模拟",
        "description": "危化品泄漏实时扩散模拟与应急响应",
        "category": "analysis",
        "author": "应急管理中心",
        "downloads": 1250,
        "rating": 4.6,
        "tags": ["应急", "扩散", "模拟"],
    },
    {
        "id": "skill-law-search",
        "name": "法规智能检索",
        "description": "生态环境法律法规语义检索与条款匹配",
        "category": "compliance",
        "author": "法规处",
        "downloads": 3500,
        "rating": 4.9,
        "tags": ["法规", "检索", "案例"],
    },
    {
        "id": "skill-data-quality",
        "name": "监测数据质量审计",
        "description": "自动检测监测数据异常值/缺失值/逻辑矛盾",
        "category": "compliance",
        "author": "监测处",
        "downloads": 1450,
        "rating": 4.4,
        "tags": ["数据质量", "审计"],
    },

    # ─── 新增：报告/图表/文字处理类技能 (GitHub 精选) ──────────

    {
        "id": "skill-pdf-report",
        "name": "PDF报告生成器 (WeasyPrint)",
        "description": "基于 WeasyPrint 7K+⭐ 的 HTML/CSS→PDF 渲染引擎，将监测数据生成格式化PDF报告（日报/周报/季报），支持页码/页眉/页脚/图表嵌入",
        "category": "generation",
        "author": "Kozea/WeasyPrint",
        "downloads": 5600,
        "rating": 4.9,
        "version": "v1.0",
        "tags": ["PDF", "WeasyPrint", "报告", "渲染"],
    },
    {
        "id": "skill-openaq-data",
        "name": "OpenAQ 全球空气质量数据",
        "description": "接入 OpenAQ 开放平台 23,300+ 监测站点全球实时/历史 AQI 数据，提供 Python SDK 直接获取 PM2.5/PM10/O3/NO2/SO2/CO 等指标",
        "category": "analysis",
        "author": "OpenAQ (MIT)",
        "downloads": 4800,
        "rating": 4.8,
        "version": "v1.0",
        "tags": ["OpenAQ", "空气质量", "全球数据", "API"],
    },
    {
        "id": "skill-doc-ocr",
        "name": "文档OCR识别 (Tesseract)",
        "description": "基于 Tesseract 63K+⭐ 的 OCR 引擎，支持 100+ 种语言，识别扫描版执法文书/环评报告/监测记录的 PDF/图片文字，输出结构化文本",
        "category": "recognition",
        "author": "Google/Tesseract",
        "downloads": 7200,
        "rating": 4.9,
        "version": "v1.0",
        "tags": ["OCR", "Tesseract", "扫描件", "结构化"],
    },
    {
        "id": "skill-template-report",
        "name": "模板报告引擎 (Carbone)",
        "description": "基于 Carbone Apache-2.0 的模板报告生成器，在 DOCX/ODT 模板中嵌入 {变量} 占位符，注入 JSON 数据后渲染为 PDF/DOCX/XLSX，适合合规报告/排放清单/监测月报等带格式文档",
        "category": "generation",
        "author": "CarboneIO (Apache-2.0)",
        "downloads": 4100,
        "rating": 4.7,
        "version": "v1.0",
        "tags": ["模板", "DOCX", "Carbone", "格式化"],
    },
    {
        "id": "skill-carbon-track",
        "name": "碳足迹追踪 (CodeCarbon)",
        "description": "基于 CodeCarbon 800+⭐ MIT 的实时碳排放追踪引擎，追踪 CPU/GPU/RAM 能耗并换算为 CO₂ 排放量，可按区域电网碳强度自动计算减排量",
        "category": "analysis",
        "author": "MLCO2/CodeCarbon (MIT)",
        "downloads": 3800,
        "rating": 4.6,
        "version": "v1.0",
        "tags": ["碳排放", "CodeCarbon", "追踪", "能耗"],
    },
    {
        "id": "skill-doc-convert",
        "name": "文档格式转换器 (Pandoc)",
        "description": "基于 Pandoc 35K+⭐ 的通用文档转换器，支持 Markdown/HTML/LaTeX/DOCX/PDF/EPUB 等 40+ 种格式互转，用于环境监测数据 Markdown→DOCX/PDF 报告一键转换",
        "category": "generation",
        "author": "jgm/Pandoc (GPL-2.0)",
        "downloads": 5500,
        "rating": 4.8,
        "version": "v1.0",
        "tags": ["Pandoc", "格式转换", "Markdown", "DOCX"],
    },
    {
        "id": "skill-air-analytics",
        "name": "空气污染分析 (openair)",
        "description": "基于 openair R包 300+⭐ MIT 的空气污染专业统计引擎，提供双变量极坐标图(污染溯源)、时间序列分析、后向轨迹分析(HYSPLIT)、日历热力图等 20+ 种专业可视化",
        "category": "analysis",
        "author": "davidcarslaw/openair (MIT)",
        "downloads": 3400,
        "rating": 4.7,
        "version": "v1.0",
        "tags": ["openair", "极坐标图", "轨迹分析", "统计"],
    },
    {
        "id": "skill-excel-report",
        "name": "Excel数据报告 (OpenPyXL)",
        "description": "基于 OpenPyXL 的 Excel 报告生成引擎，自动填充环境监测数据到 XLSX 模板（排放清单/监测台账/统计报表），支持公式/图表/条件格式/数据验证",
        "category": "generation",
        "author": "EcoMind Lab",
        "downloads": 3600,
        "rating": 4.6,
        "version": "v1.0",
        "tags": ["Excel", "OpenPyXL", "表格", "统计报表"],
    },
]

# 自动安装所有市场技能到注册表
for _ms in MARKETPLACE_SKILLS:
    if not any(r["id"] == _ms["id"] for r in SKILL_REGISTRY):
        _ms["safety_level"] = "L2"
        _ms["handler"] = f"skills.{_ms['id'].replace('-', '_')}.run"
        if "input_schema" not in _ms:
            _ms["input_schema"] = {}
        SKILL_REGISTRY.append(_ms)


# ─── API 端点 ──────────────────────────────────────────────────

class SkillExecuteRequest(BaseModel):
    skill_id: str
    params: dict[str, Any] = Field(default_factory=dict)
    safety_level: str = "L2"

@router.get("/list")
async def list_skills(
    search: str = Query(default=""),
    category: str = Query(default="all"),
    sort_by: str = Query(default="downloads"),
):
    """技能市场列表 — 支持搜索/分类/排序（含自动生成技能）"""
    seen_ids = set()
    all_skills = []
    for s in SKILL_REGISTRY + MARKETPLACE_SKILLS:
        if s["id"] not in seen_ids:
            seen_ids.add(s["id"])
            all_skills.append(s)

    # 注入自动生成的技能
    try:
        from engine.auto_skill import get_auto_skill_engine
        engine = get_auto_skill_engine()
        auto_skills = engine.get_all()
        # 转换为前端格式
        for s in auto_skills:
            all_skills.append({
                "id": s["id"],
                "name": s["display_name"],
                "description": s["description"],
                "category": s["category"],
                "author": s["author_name"],
                "auto_generated": True,
                "triggers": s.get("triggers", []),
                "steps": s.get("steps", []),
                "tools": s.get("tools_used", []),
                "rating": s.get("rating", 0),
                "downloads": s.get("usage_count", 0),
                "tags": s.get("triggers", []),
            })
    except Exception:
        pass

    # 搜索
    if search:
        q = search.lower()
        all_skills = [
            s for s in all_skills
            if q in s["name"].lower()
            or q in s["description"].lower()
            or any(q in t.lower() for t in s.get("tags", []))
        ]

    # 分类筛选
    if category != "all":
        all_skills = [s for s in all_skills if s.get("category") == category]

    # 排序
    if sort_by in ("downloads", "rating"):
        all_skills.sort(key=lambda s: s.get(sort_by, 0), reverse=True)

    return {"skills": all_skills, "total": len(all_skills)}


@router.get("/categories")
async def list_categories():
    """技能分类列表"""
    return {
        "categories": [
            {"id": "analysis", "name": "分析类", "icon": "LineChartOutlined"},
            {"id": "visualization", "name": "可视化", "icon": "HeatMapOutlined"},
            {"id": "compliance", "name": "合规审查", "icon": "CheckCircleOutlined"},
            {"id": "generation", "name": "生成类", "icon": "FileTextOutlined"},
            {"id": "recognition", "name": "识别类", "icon": "EyeOutlined"},
        ]
    }


@router.get("/my")
async def my_skills(
    expert_id: str = Query(default="ecomind"),
):
    """我的技能 — 某个专家自动生成的技能列表"""
    try:
        from engine.auto_skill import get_auto_skill_engine
        engine = get_auto_skill_engine()
        skills = engine.get_my_skills(expert_id)
        result = []
        for s in skills:
            result.append({
                "id": s["id"],
                "name": s["display_name"],
                "description": s["description"],
                "category": s["category"],
                "author": s["author_name"],
                "auto_generated": True,
                "triggers": s.get("triggers", []),
                "steps": s.get("steps", []),
                "tools": s.get("tools_used", []),
                "created_at": s.get("created_at", 0),
            })
        return {"skills": result, "total": len(result), "expert_id": expert_id}
    except Exception as e:
        return {"skills": [], "total": 0, "error": str(e)}


@router.get("/{skill_id}")
async def get_skill(skill_id: str):
    """技能详情"""
    for s in SKILL_REGISTRY + MARKETPLACE_SKILLS:
        if s["id"] == skill_id:
            return s
    raise HTTPException(status_code=404, detail=f"技能 {skill_id} 不存在")


@router.post("/execute")
async def execute_skill(req: SkillExecuteRequest):
    """执行技能"""
    skill = next((s for s in SKILL_REGISTRY if s["id"] == req.skill_id), None)
    if not skill:
        raise HTTPException(status_code=404, detail=f"技能 {req.skill_id} 未注册或不可执行")

    # TODO: 调用实际的 skill handler
    return {
        "skill_id": req.skill_id,
        "status": "executed",
        "message": f"技能 '{skill['name']}' 执行完成",
        "handler": skill.get("handler"),
        "params": req.params,
    }


@router.post("/install")
async def install_skill( skill_id: str):
    """从市场安装技能到本地注册表"""
    for s in MARKETPLACE_SKILLS:
        if s["id"] == skill_id:
            # 检查是否已安装
            if any(r["id"] == skill_id for r in SKILL_REGISTRY):
                return {"status": "already_installed", "skill_id": skill_id}
            # 安装
            s["safety_level"] = "L2"
            s["handler"] = f"skills.{skill_id.replace('-', '_')}.run"
            s["input_schema"] = {}
            SKILL_REGISTRY.append(s)
            return {"status": "installed", "skill_id": skill_id, "skill": s}
    raise HTTPException(status_code=404, detail=f"市场技能 {skill_id} 不存在")


@router.post("/uninstall")
async def uninstall_skill( skill_id: str):
    """卸载技能"""
    global SKILL_REGISTRY
    before = len(SKILL_REGISTRY)
    SKILL_REGISTRY = [s for s in SKILL_REGISTRY if s["id"] != skill_id]
    if len(SKILL_REGISTRY) == before:
        raise HTTPException(status_code=404, detail=f"技能 {skill_id} 未安装")
    return {"status": "uninstalled", "skill_id": skill_id}
