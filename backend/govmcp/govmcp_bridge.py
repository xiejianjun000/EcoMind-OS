"""
GovMCP MCP Server Bridge - 将 GovMCP 暴露为标准 MCP Server

提供 HTTP 接口供外部 MCP Client 连接
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from aiohttp import web

from .govmcp.server import GovMCPServer
from .mcp.protocol import MCPMessage, MCPProtocol

logger = logging.getLogger(__name__)


class GovMCPBridge:
    """
    GovMCP MCP Server Bridge

    将 GovMCP Server 暴露为标准 MCP 协议服务器
    支持外部 MCP Client 连接
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8081,
    ):
        self.host = host
        self.port = port
        self._gov_server: GovMCPServer | None = None
        self._app: web.Application | None = None
        self._runner: web.AppRunner | None = None
        self._initialized = False

    async def initialize(self):
        """初始化"""
        self._gov_server = GovMCPServer()
        await self._gov_server.initialize()
        self._initialized = True
        logger.info("GovMCP Bridge initialized")

    async def _handle_initialize(self, message: MCPMessage) -> MCPMessage:
        """处理 initialize 请求"""
        response_data = {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {},
                "resources": {},
            },
            "serverInfo": {
                "name": "GovMCP",
                "version": "1.0.0",
            },
        }
        return MCPMessage(id=message.id, result=response_data)

    async def _handle_tools_list(self, message: MCPMessage) -> MCPMessage:
        """处理 tools/list 请求"""
        if not self._gov_server:
            return MCPProtocol.create_error_response(
                code=-32603,
                message="GovMCP not initialized",
                request_id=message.id,
            )

        tools = self._gov_server.get_tools()
        return MCPMessage(
            id=message.id,
            result={"tools": tools},
        )

    async def _handle_tools_call(self, message: MCPMessage) -> MCPMessage:
        """处理 tools/call 请求"""
        if not self._gov_server:
            return MCPProtocol.create_error_response(
                code=-32603,
                message="GovMCP not initialized",
                request_id=message.id,
            )

        params = message.params or {}
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        if not tool_name:
            return MCPProtocol.create_error_response(
                code=-32602,
                message="Missing tool name",
                request_id=message.id,
            )

        try:
            result = await self._gov_server.call_tool(tool_name, arguments)

            parsed_result = json.loads(result) if isinstance(result, str) else result

            if isinstance(parsed_result, dict) and "error" in parsed_result:
                content = [{"type": "text", "text": str(parsed_result["error"])}]
                is_error = True
            else:
                content = [{"type": "text", "text": str(parsed_result)}]
                is_error = False

            return MCPMessage(
                id=message.id,
                result={
                    "content": content,
                    "isError": is_error,
                },
            )

        except Exception as e:
            logger.error(f"Tool call error: {tool_name} - {e}")
            return MCPMessage(
                id=message.id,
                result={
                    "content": [{"type": "text", "text": f"Error: {str(e)}"}],
                    "isError": True,
                },
            )

    async def _handle_ping(self, message: MCPMessage) -> MCPMessage:
        """处理 ping 请求"""
        return MCPMessage(id=message.id, result={})

    async def _process_message(self, message: MCPMessage) -> MCPMessage:
        """处理 MCP 消息"""
        handlers = {
            "initialize": self._handle_initialize,
            "tools/list": self._handle_tools_list,
            "tools/call": self._handle_tools_call,
            "ping": self._handle_ping,
        }

        handler = handlers.get(message.method)
        if not handler:
            return MCPProtocol.create_error_response(
                code=-32601,
                message=f"Method not found: {message.method}",
                request_id=message.id,
            )

        return await handler(message)

    async def _handle_message(self, request: web.Request) -> web.Response:
        """处理 JSON-RPC 请求"""
        try:
            body = await request.json()
            message = MCPMessage.from_json(json.dumps(body))
            response = await self._process_message(message)

            return web.json_response(json.loads(response.to_json()))

        except Exception as e:
            logger.error(f"Message handler error: {e}")
            return web.json_response(
                {"jsonrpc": "2.0", "error": {"code": -32603, "message": str(e)}},
                status=500,
            )

    async def start(self) -> str:
        """启动服务器"""
        if not self._initialized:
            await self.initialize()

        self._app = web.Application()

        self._app.router.add_post("/message", self._handle_message)

        self._app.router.add_get("/health", self._handle_health)

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()

        site = web.TCPSite(self._runner, self.host, self.port)
        await site.start()

        url = f"http://{self.host}:{self.port}"
        logger.info(f"GovMCP Bridge started at {url}")
        return url

    async def _handle_health(self, request: web.Request) -> web.Response:
        """健康检查"""
        return web.json_response({
            "status": "healthy",
            "service": "GovMCP Bridge",
            "version": "1.0.0",
            "initialized": self._initialized,
            "tools_count": len(self._gov_server.get_tools()) if self._gov_server else 0,
        })

    async def stop(self):
        """停止服务器"""
        if self._runner:
            await self._runner.cleanup()
            self._runner = None
            self._app = None
            logger.info("GovMCP Bridge stopped")

    @property
    def server_url(self) -> str:
        """获取服务器 URL"""
        return f"http://{self.host}:{self.port}"


async def run_bridge(host: str = "0.0.0.0", port: int = 8081):
    """运行 GovMCP Bridge"""
    bridge = GovMCPBridge(host=host, port=port)
    url = await bridge.start()
    print(f"GovMCP Bridge running at {url}")
    print(f"MCP endpoint: {url}/message")
    print(f"Health check: {url}/health")

    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        await bridge.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_bridge())
