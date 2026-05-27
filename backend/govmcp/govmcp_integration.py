"""
GovMCP 集成模块 - 将政务合规功能融入 Taiji Agent

提供：
- GovMCP Server 与 Hermes Agent 的深度集成
- 政务工具自动注册
- MCP 协议桥接
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .govmcp.server import GovMCPServer

logger = logging.getLogger(__name__)


class GovMCPIntegration:
    """
    GovMCP 集成到 Taiji Agent

    功能：
    1. 将 GovMCP Server 作为内置工具提供者
    2. 自动注册政务工具到 Hermes Agent
    3. 提供 MCP 协议桥接
    """

    def __init__(self):
        self._gov_server: GovMCPServer | None = None
        self._initialized = False
        self._tool_cache: dict[str, dict[str, Any]] = {}

    async def initialize(self) -> dict[str, Any]:
        """初始化 GovMCP Server"""
        if self._initialized:
            return self.get_server_info()

        self._gov_server = GovMCPServer()
        await self._gov_server.initialize()
        self._initialized = True

        self._cache_tools()

        logger.info("GovMCP Integration initialized")
        return self.get_server_info()

    def _cache_tools(self):
        """缓存工具信息"""
        if not self._gov_server:
            return

        tools = self._gov_server.get_tools()
        for tool in tools:
            self._tool_cache[tool["name"]] = tool

        logger.info(f"Cached {len(self._tool_cache)} GovMCP tools")

    @property
    def gov_server(self) -> GovMCPServer:
        """获取 GovMCP Server 实例"""
        if not self._gov_server:
            raise RuntimeError("GovMCP not initialized. Call initialize() first.")
        return self._gov_server

    def get_server_info(self) -> dict[str, Any]:
        """获取服务器信息"""
        if not self._gov_server:
            return {"initialized": False}

        return {
            "initialized": self._initialized,
            "name": "GovMCP",
            "version": "1.0.0",
            "tools_count": len(self._tool_cache),
            "categories": self._get_tool_categories(),
        }

    def _get_tool_categories(self) -> dict[str, int]:
        """获取工具分类统计"""
        categories = {
            "crypto": 0,
            "workflow": 0,
            "audit": 0,
            "gov": 0,
        }

        for tool_name in self._tool_cache.keys():
            if "sm" in tool_name:
                categories["crypto"] += 1
            elif "approval" in tool_name:
                categories["workflow"] += 1
            elif "audit" in tool_name:
                categories["audit"] += 1
            elif any(kw in tool_name for kw in ["mask", "validate", "calculate"]):
                categories["gov"] += 1

        return categories

    def get_tools(self) -> list[dict[str, Any]]:
        """获取所有工具列表"""
        return list(self._tool_cache.values())

    def get_tool(self, name: str) -> dict[str, Any] | None:
        """获取指定工具"""
        return self._tool_cache.get(name)

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> str:
        """调用工具"""
        if not self._gov_server:
            raise RuntimeError("GovMCP not initialized")

        return await self._gov_server.call_tool(tool_name, arguments)

    def get_mcp_protocol_tools(self) -> list[dict[str, Any]]:
        """获取 MCP 协议格式的工具列表"""
        return [
            {
                "name": tool["name"],
                "description": tool["description"],
                "inputSchema": tool["inputSchema"],
            }
            for tool in self._tool_cache.values()
        ]


class GovMCPToolAdapter:
    """
    GovMCP 工具适配器

    将 GovMCP 工具转换为 Hermes Agent 可用的格式
    """

    def __init__(self, integration: GovMCPIntegration):
        self._integration = integration

    def to_hermes_tools(self) -> list[dict[str, Any]]:
        """转换为 Hermes 工具格式"""
        tools = []
        for tool in self._integration.get_tools():
            tools.append({
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["inputSchema"],
                "category": self._categorize_tool(tool["name"]),
            })
        return tools

    def _categorize_tool(self, name: str) -> str:
        """分类工具"""
        if "sm" in name:
            return "crypto"
        elif "approval" in name:
            return "workflow"
        elif "audit" in name:
            return "audit"
        elif "mask" in name:
            return "privacy"
        elif "validate" in name:
            return "validation"
        elif "calculate" in name:
            return "calendar"
        return "general"


async def create_govmcp_integration() -> GovMCPIntegration:
    """创建并初始化 GovMCP 集成"""
    integration = GovMCPIntegration()
    await integration.initialize()
    return integration


__all__ = [
    "GovMCPIntegration",
    "GovMCPToolAdapter",
    "create_govmcp_integration",
]
