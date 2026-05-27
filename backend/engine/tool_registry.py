"""
EcoMind 工具注册表 — 自建，不依赖任何外部 Agent 框架。

支持动态注册、按角色过滤、MCP 协议导出。
"""

from __future__ import annotations

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
    registry.register(EcoTool(
        name="query_environment_data",
        description="查询生态环境数据：空气质量(AQI/PM2.5/PM10)、水质(pH/COD/氨氮)、噪声等",
        handler=lambda **kw: {"result": f"环境数据查询结果（{kw}）", "timestamp": datetime.now().isoformat()},
        category="environment",
        parameters={
            "data_type": {"type": "string", "description": "数据类型: air/water/noise/soil"},
            "location": {"type": "string", "description": "监测点位名称或编码"},
            "start_time": {"type": "string", "description": "起始时间 ISO8601"},
            "end_time": {"type": "string", "description": "结束时间 ISO8601"},
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
    registry.register(EcoTool(
        name="search_regulation",
        description="搜索生态环境法律法规和政策标准",
        handler=lambda **kw: {"laws": ["《环境保护法》", "《大气污染防治法》", "《碳排放权交易管理办法》"][:3]},
        category="legal",
        parameters={
            "keyword": {"type": "string", "description": "搜索关键词"},
            "category": {"type": "string", "description": "法规类别: law/standard/policy"},
        },
    ))

    logger.info(f"已注册 {len(registry)} 个内置工具")
