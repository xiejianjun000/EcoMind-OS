"""
EcoMind 工具注册表 — 自建，不依赖任何外部 Agent 框架。

支持动态注册、按角色过滤、MCP 协议导出。
"""

from __future__ import annotations

import inspect
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class EcoTool:
    """EcoMind 工具定义"""

    def __init__(
        self,
        name: str,
        description: str,
        handler: Callable,
        *,
        requires_approval: bool = False,
        permission_level: int = 1,
        category: str = "general",
        parameters: Optional[dict[str, Any]] = None,
    ) -> None:
        self.name = name
        self.description = description
        self.handler = handler
        self.requires_approval = requires_approval
        self.permission_level = permission_level
        self.category = category
        self.parameters = parameters or {}

    def to_openai_schema(self) -> dict:
        """导出为 OpenAI function calling 格式"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": self.parameters,
                    "required": list(self.parameters.keys()),
                } if self.parameters else {"type": "object", "properties": {}},
            },
        }

    def to_mcp_schema(self) -> dict:
        """导出为 MCP tool 格式"""
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": {
                "type": "object",
                "properties": self.parameters,
            },
        }


class EcoToolRegistry:
    """工具注册表 — 替代原 EcoToolRegistry 设计"""

    def __init__(self) -> None:
        self._tools: dict[str, EcoTool] = {}
        self._role_bindings: dict[str, list[str]] = {}

    def register(self, tool: EcoTool) -> None:
        """注册工具"""
        self._tools[tool.name] = tool
        logger.debug(f"工具已注册: {tool.name}")

    def unregister(self, name: str) -> None:
        """注销工具"""
        self._tools.pop(name, None)

    def get(self, name: str) -> Optional[EcoTool]:
        """按名称获取工具"""
        return self._tools.get(name)

    def get_all(self) -> list[EcoTool]:
        """获取所有工具"""
        return list(self._tools.values())

    def get_openai_schemas(self, names: Optional[list[str]] = None) -> list[dict]:
        """获取工具的 OpenAI function calling schema 列表"""
        tools = [self._tools[n] for n in names if n in self._tools] if names else self._tools.values()
        return [t.to_openai_schema() for t in tools]

    def bind_role(self, role: str, tool_names: list[str]) -> None:
        """将工具绑定到角色"""
        self._role_bindings[role] = tool_names

    def get_for_role(self, role: str) -> list[EcoTool]:
        """获取角色可用的工具"""
        names = self._role_bindings.get(role, list(self._tools.keys()))
        return [self._tools[n] for n in names if n in self._tools]

    async def execute(self, name: str, **kwargs: Any) -> Any:
        """执行工具"""
        tool = self._tools.get(name)
        if not tool:
            raise ValueError(f"工具不存在: {name}")
        try:
            result = tool.handler(**kwargs)
            # 支持 async handler
            if inspect.isawaitable(result):
                result = await result
            return result
        except Exception as e:
            logger.error(f"工具执行失败 [{name}]: {e}")
            raise

    def __len__(self) -> int:
        return len(self._tools)


# 全局单例
_tool_registry: Optional[EcoToolRegistry] = None


def get_tool_registry() -> EcoToolRegistry:
    global _tool_registry
    if _tool_registry is None:
        _tool_registry = EcoToolRegistry()
        _register_builtin_tools(_tool_registry)
    return _tool_registry


def _register_builtin_tools(registry: EcoToolRegistry) -> None:
    """注册内置工具"""
    import json
    from datetime import datetime

    # ---- 数据查询工具 ----
    async def _query_environment(**kw) -> dict:
        from api.services.environment_service import (
            get_realtime_aqi, get_city_hourly_detail, get_all_cities_detail
        )
        data_type = kw.get("data_type", "air")
        location = kw.get("location", kw.get("city", "all"))
        try:
            if location and location != "all" and data_type == "air":
                detail = await get_city_hourly_detail(location)
                return {"city": location, "data": detail, "source": "湖南省环境监测平台"}
            data = await get_realtime_aqi()
            return {"cities": data, "source": "湖南省环境监测平台"}
        except Exception as e:
            logger.error(f"环境数据查询失败: {e}")
            return {"error": f"数据获取失败: {e}"}

    registry.register(EcoTool(
        name="query_environment_data",
        description="查询城市实时环境监测数据（AQI/PM2.5/PM10/O3/NO2/SO2/CO），对接湖南省环境监测平台实时API",
        handler=_query_environment,
        category="environment",
        parameters={
            "data_type": {"type": "string", "description": "数据类型: air"},
            "location": {"type": "string", "description": "城市名称，如'长沙市'。不传返回全部14市州"},
        },
    ))

    registry.register(EcoTool(
        name="query_emission_data",
        description="查询碳排放数据：企业排放量、配额使用、减排项目进度",
        handler=lambda **kw: {"result": f"碳排放数据（{kw}）", "timestamp": datetime.now().isoformat()},
        category="carbon",
        parameters={
            "enterprise_id": {"type": "string", "description": "企业编码"},
            "year": {"type": "integer", "description": "查询年份"},
            "scope": {"type": "string", "description": "核算范围: scope1/scope2/scope3"},
        },
    ))

    # ---- 审批相关工具 ----
    registry.register(EcoTool(
        name="submit_approval",
        description="提交审批：排污许可/环评报告/执法决定等",
        handler=lambda **kw: {"approval_id": f"AP-{datetime.now().strftime('%Y%m%d%H%M%S')}", "status": "pending"},
        category="approval",
        requires_approval=False,
        parameters={
            "type": {"type": "string", "description": "审批类型"},
            "title": {"type": "string", "description": "审批标题"},
            "content": {"type": "string", "description": "审批内容"},
        },
    ))

    # ---- 报告生成工具 ----
    registry.register(EcoTool(
        name="generate_report",
        description="生成生态环境报告：监测日报/执法周报/碳排放月报/环评报告",
        handler=lambda **kw: {"report_url": f"reports/{kw.get('report_type', 'daily')}_{datetime.now():%Y%m%d}.md"},
        category="report",
        parameters={
            "report_type": {"type": "string", "description": "报告类型: daily/weekly/monthly/eia"},
            "start_date": {"type": "string", "description": "起始日期"},
            "end_date": {"type": "string", "description": "结束日期"},
        },
    ))

    # ---- 法规查询工具 ----
    async def _search_regulation(**kw) -> dict:
        keyword = kw.get("keyword", "")
        try:
            from api.services.knowledge_service import search_knowledge
            results = await search_knowledge(keyword, top_k=5)
            return {"keyword": keyword, "results": results, "source": "本地知识库"}
        except Exception:
            return {
                "keyword": keyword,
                "results": [
                    {"title": "《环境保护法》", "match": "第6条·一切单位和个人都有保护环境的义务"},
                    {"title": "《大气污染防治法》", "match": "第99条·超标排放大气污染物的法律责任"},
                    {"title": "《碳排放权交易管理办法》", "match": "第25条·碳排放配额清缴规定"},
                ],
                "source": "内置法规库",
            }

    registry.register(EcoTool(
        name="search_regulation",
        description="搜索生态环境法律法规和政策标准",
        handler=_search_regulation,
        category="legal",
        parameters={
            "keyword": {"type": "string", "description": "搜索关键词"},
            "category": {"type": "string", "description": "法规类别: law/standard/policy"},
        },
    ))

    # ---- 同步 api/routers/tools.py 的全部 18 个工具 ----
    _sync_api_tools(registry)

    logger.info(f"已注册 {len(registry)} 个内置工具")


def _sync_api_tools(registry: EcoToolRegistry) -> None:
    """
    将 api/routers/tools.py 中的 18 个工具同步到引擎注册表。

    引擎原本只有 5 个工具，现在桥接全部 18 个，
    使 EcoAgentEngine 能够调用前端期望的所有工具。
    """
    import time
    from datetime import datetime

    # 懒加载 api/routers/tools.py 的 handler 函数
    from api.routers.tools import TOOL_REGISTRY as API_TOOLS

    # 为每个 API 工具创建对应的 EcoTool 包装
    _tool_defs = {
        "env_query": {
            "description": "查询城市实时环境监测数据（AQI/PM2.5/PM10/O3/NO2/SO2/CO），对接湖南省环境监测平台",
            "category": "environment",
            "parameters": {
                "city": {"type": "string", "description": "城市名称，如'长沙市'"},
                "data_type": {"type": "string", "description": "数据类型: aqi|water|weather|all"},
            },
        },
        "regulation_search": {
            "description": "搜索生态环境法律法规和政策标准库",
            "category": "legal",
            "parameters": {
                "query": {"type": "string", "description": "搜索关键词"},
                "domain": {"type": "string", "description": "领域: air|water|soil|all"},
                "max_results": {"type": "integer", "description": "最大返回数"},
            },
        },
        "report_generate": {
            "description": "生成环境监测报告/执法文书/环评意见书",
            "category": "report",
            "parameters": {
                "template": {"type": "string", "description": "模板: monitoring_daily|enforcement_decision|eia_review|..."},
                "city": {"type": "string", "description": "城市名称"},
                "format": {"type": "string", "description": "输出格式: markdown|docx"},
            },
        },
        "case_search": {
            "description": "搜索历史执法/环评/修复案例",
            "category": "legal",
            "parameters": {
                "query": {"type": "string", "description": "搜索关键词"},
                "case_type": {"type": "string", "description": "案例类型: enforcement|eia|all"},
                "max_results": {"type": "integer", "description": "最大返回数"},
            },
        },
        "map_visualize": {
            "description": "生成环境监测地图可视化",
            "category": "environment",
            "parameters": {
                "map_type": {"type": "string", "description": "地图类型: station_distribution|pollution_heatmap|redline_overlay"},
                "city": {"type": "string", "description": "城市名称"},
            },
        },
        "alert_check": {
            "description": "查询当前环境告警状态",
            "category": "environment",
            "parameters": {
                "city": {"type": "string", "description": "城市名称(可选)"},
                "severity": {"type": "string", "description": "告警级别: warning|critical|emergency|all"},
            },
        },
        "document_parse": {
            "description": "解析上传文档（OCR/PDF/Word）",
            "category": "general",
            "parameters": {
                "file_path": {"type": "string", "description": "文件路径"},
                "extract_type": {"type": "string", "description": "提取类型: text|tables|all"},
            },
        },
        "compliance_check": {
            "description": "法规合规性自动校验",
            "category": "legal",
            "parameters": {
                "target_description": {"type": "string", "description": "合规校验对象描述"},
                "standard": {"type": "string", "description": "适用的标准名称(可选)"},
            },
        },
        "data_analyze": {
            "description": "环境监测数据统计分析（趋势/异常/对比/汇总）",
            "category": "environment",
            "parameters": {
                "analysis_type": {"type": "string", "description": "分析类型: trend|anomaly|compare|summary"},
                "cities": {"type": "array", "description": "城市列表"},
                "time_range": {"type": "string", "description": "时间范围: 24h|7d|30d"},
            },
        },
        "dispatch_expert": {
            "description": "将任务分派给领域专家Agent",
            "category": "general",
            "parameters": {
                "expert_id": {"type": "string", "description": "专家ID: env-monitoring|enforcement|eia|carbon|emergency|water"},
                "task_description": {"type": "string", "description": "任务描述"},
            },
        },
        "knowledge_query": {
            "description": "查询知识库（法规/案例/物种/排放因子）",
            "category": "knowledge",
            "parameters": {
                "database": {"type": "string", "description": "数据库: regulations|cases|species|all"},
                "query": {"type": "string", "description": "查询内容"},
            },
        },
        "skill_execute": {
            "description": "执行已注册的技能模块",
            "category": "general",
            "parameters": {
                "skill_id": {"type": "string", "description": "技能ID"},
                "params": {"type": "object", "description": "技能参数"},
            },
        },
        # 代码开发工具（仅 ecomind 可用）
        "code_read": {
            "description": "读取项目源代码文件",
            "category": "development",
            "parameters": {"file_path": {"type": "string", "description": "相对于项目根目录的文件路径"}},
        },
        "code_edit": {
            "description": "在文件中查找替换（生成 diff 预览）",
            "category": "development",
            "parameters": {
                "file_path": {"type": "string", "description": "文件路径"},
                "old_string": {"type": "string", "description": "要替换的文本"},
                "new_string": {"type": "string", "description": "替换后的文本"},
            },
        },
        "code_write": {
            "description": "创建新文件（生成内容预览）",
            "category": "development",
            "parameters": {
                "file_path": {"type": "string", "description": "新文件路径"},
                "content": {"type": "string", "description": "文件内容"},
            },
        },
        "shell_exec": {
            "description": "执行 Shell 命令（L3 安全级别，需人工确认）",
            "category": "development",
            "requires_approval": True,
            "parameters": {
                "command": {"type": "string", "description": "Shell 命令"},
                "cwd": {"type": "string", "description": "工作目录(可选)"},
            },
        },
        "git_status": {
            "description": "查看 Git 仓库状态",
            "category": "development",
            "parameters": {},
        },
        "git_commit": {
            "description": "预览 Git 提交变更",
            "category": "development",
            "parameters": {
                "message": {"type": "string", "description": "提交信息"},
                "branch_name": {"type": "string", "description": "分支名(可选)"},
            },
        },
        # 多模态分析工具
        "image_analyze": {
            "description": "分析图片内容（无人机航拍/监控截图/污染现场照片/地图标注）。使用 OpenCV 进行颜色分析、边缘检测、污染识别，Tesseract OCR 提取文字。",
            "category": "multimodal",
            "parameters": {
                "file_path": {"type": "string", "description": "图片文件路径（支持 jpg/png/bmp/tiff）"},
                "analysis_type": {"type": "string", "description": "分析类型: general|pollution|vegetation|structure|ocr"},
            },
        },
        "video_analyze": {
            "description": "分析视频内容（无人机录像/监控视频/排污口记录）。使用 ffmpeg 提取关键帧 + OpenCV 帧间分析，检测运动/变化。",
            "category": "multimodal",
            "parameters": {
                "file_path": {"type": "string", "description": "视频文件路径（支持 mp4/avi/mov/mkv）"},
                "extract_frames": {"type": "integer", "description": "提取帧数（默认5，最多20）"},
                "analysis_type": {"type": "string", "description": "分析类型: motion|object|general"},
            },
        },
        "voice_transcribe": {
            "description": "语音转文字（会议录音/现场报告/执法记录）。自动提取音频特征，支持 Whisper 语音识别。",
            "category": "multimodal",
            "parameters": {
                "file_path": {"type": "string", "description": "音频文件路径（支持 wav/mp3/m4a/flac）"},
                "language": {"type": "string", "description": "语言: zh|en|auto"},
            },
        },
        "document_ocr": {
            "description": "文档OCR识别（扫描件/PDF/图片中的文字提取）。使用 Tesseract OCR 引擎，支持中英文混合识别，可提取表格和键值对。",
            "category": "multimodal",
            "parameters": {
                "file_path": {"type": "string", "description": "文件路径（支持 pdf/png/jpg/tiff）"},
                "output_format": {"type": "string", "description": "输出格式: text|structured"},
            },
        },
        # ─── 湖南生态环境政策 MCP ───
        "hunan_policy_search": {
            "description": "搜索湖南省生态环境厅最新政策法规（规范性文件/政策解读/通知公告/环保动态）。支持全文检索，数据源为 https://sthjt.hunan.gov.cn/ 实时抓取。",
            "category": "environment",
            "parameters": {
                "query": {"type": "string", "description": "搜索关键词（如'大气污染防治''排放标准'）"},
                "section": {"type": "string", "description": "板块过滤: gfxwj(规范性文件)|zcfgjd(政策解读)|tzgg_tz(通知)|tzgg_gg(公告)|zxdt(环保动态)|hjyw(环境要闻)"},
                "limit": {"type": "integer", "description": "返回条数，默认10"},
            },
        },
        "hunan_policy_latest": {
            "description": "获取湖南省生态环境厅最新发布的政策文件列表。可指定回溯天数和板块。",
            "category": "environment",
            "parameters": {
                "days": {"type": "integer", "description": "最近天数，默认7天"},
                "section": {"type": "string", "description": "板块过滤"},
                "limit": {"type": "integer", "description": "返回条数，默认10"},
            },
        },
        "hunan_policy_detail": {
            "description": "查看指定湖南省生态环境政策文件的完整内容（含附件列表和正文）。",
            "category": "environment",
            "parameters": {
                "article_id": {"type": "string", "description": "文章ID（从搜索结果中获取）"},
            },
        },
        "hunan_policy_crawl": {
            "description": "从湖南省生态环境厅官网实时抓取最新政策文件并更新本地数据库。",
            "category": "environment",
            "requires_approval": True,
            "parameters": {
                "sections": {"type": "array", "description": "要抓取的板块列表，空=全部"},
                "days_back": {"type": "integer", "description": "回溯天数，默认7"},
                "max_pages": {"type": "integer", "description": "每板块最大页数，默认3"},
            },
        },
    }

    def _make_async_wrapper(h):
        """工厂函数：为给定的 async handler 创建 EcoTool 兼容的包装器"""
        async def wrapper(**kw):
            return await h(kw)
        return wrapper

    for tool_name, defn in _tool_defs.items():
        if tool_name in API_TOOLS:
            handler = API_TOOLS[tool_name]
            registry.register(EcoTool(
                name=tool_name,
                description=defn["description"],
                handler=_make_async_wrapper(handler),
                category=defn["category"],
                requires_approval=defn.get("requires_approval", False),
                parameters=defn.get("parameters", {}),
            ))

    # ─── 注入 Hermes 级自主执行能力 ─────────────────
    try:
        from engine.hermes_tools import register_hermes_tools
        count = register_hermes_tools(registry)
        logger.info(f"✅ Hermes 能力注入成功: {count} 个工具")
    except Exception as e:
        logger.warning(f"⚠️ Hermes 能力注入失败: {e}")
