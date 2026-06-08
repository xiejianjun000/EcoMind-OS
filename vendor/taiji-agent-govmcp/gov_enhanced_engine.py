"""
GovMCP 增强的 Hermes Agent

将政务合规功能融入核心引擎
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

from .govmcp.server import GovMCPServer
from .govmcp_integration import GovMCPIntegration
from .hermes_engine import (
    CrossSessionMemory,
    EvolutionEngine,
    HermesAgentEngine,
    SubAgentOrchestrator,
)
from .mcp.client import MCPClientAdapter

logger = logging.getLogger(__name__)


class GovEnhancedHermesEngine(HermesAgentEngine):
    """
    GovMCP 增强的 Hermes Agent 引擎

    扩展 HermesAgentEngine，集成：
    - 国密加密工具 (SM2/SM3/SM4)
    - 审批工作流
    - 审计日志
    - 数据脱敏
    - MCP 协议桥接
    """

    def __init__(self):
        super().__init__()

        self._gov_integration: GovMCPIntegration | None = None
        self._gov_server: GovMCPServer | None = None
        self._gov_enabled = False

    async def enable_govmcp(self) -> dict[str, Any]:
        """启用 GovMCP 功能"""
        if self._gov_enabled:
            return self._gov_integration.get_server_info() if self._gov_integration else {}

        self._gov_integration = GovMCPIntegration()
        await self._gov_integration.initialize()
        self._gov_server = self._gov_integration.gov_server
        self._gov_enabled = True

        await self._audit_action("govmcp_enabled", "system", "engine", {"version": "1.0.0"})

        logger.info("GovMCP enabled in Hermes Engine")
        return self._gov_integration.get_server_info()

    async def disable_govmcp(self):
        """禁用 GovMCP 功能"""
        if not self._gov_enabled:
            return

        await self._audit_action("govmcp_disabled", "system", "engine", {})

        self._gov_integration = None
        self._gov_server = None
        self._gov_enabled = False

        logger.info("GovMCP disabled in Hermes Engine")

    async def _audit_action(
        self,
        action: str,
        user_id: str,
        resource: str,
        details: dict | None = None,
    ):
        """记录审计日志"""
        if self._gov_enabled and self._gov_server:
            try:
                await self._gov_server.call_tool(
                    "audit_log",
                    {
                        "action": action,
                        "user_id": user_id,
                        "resource": resource,
                        "details": details or {},
                    },
                )
            except Exception as e:
                logger.warning(f"Audit logging failed: {e}")

    @property
    def govmcp_enabled(self) -> bool:
        """检查 GovMCP 是否启用"""
        return self._gov_enabled

    def get_govmcp_tools(self) -> list[dict[str, Any]]:
        """获取 GovMCP 工具列表"""
        if not self._gov_enabled or not self._gov_integration:
            return []
        return self._gov_integration.get_tools()

    def get_govmcp_tool(self, name: str) -> dict[str, Any] | None:
        """获取指定 GovMCP 工具"""
        if not self._gov_enabled or not self._gov_integration:
            return None
        return self._gov_integration.get_tool(name)

    async def call_govmcp_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str | None = None,
    ) -> str:
        """调用 GovMCP 工具"""
        if not self._gov_enabled or not self._gov_integration:
            raise RuntimeError("GovMCP is not enabled")

        await self._audit_action(
            f"tool_call:{tool_name}",
            user_id or "anonymous",
            f"govmcp:{tool_name}",
            {"arguments": arguments},
        )

        return await self._gov_integration.call_tool(tool_name, arguments)

    async def encrypt_data(
        self,
        data: str,
        algorithm: str = "SM4",
        key_id: str = "default",
        user_id: str | None = None,
    ) -> str:
        """加密数据"""
        if algorithm.upper() == "SM4":
            tool_name = "sm4_encrypt"
        elif algorithm.upper() == "SM2":
            tool_name = "sm2_encrypt"
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")

        return await self.call_govmcp_tool(
            tool_name,
            {"data": data, "key_id": key_id},
            user_id=user_id,
        )

    async def decrypt_data(
        self,
        encrypted_data: str,
        algorithm: str = "SM4",
        key_id: str = "default",
        user_id: str | None = None,
    ) -> str:
        """解密数据"""
        if algorithm.upper() == "SM4":
            tool_name = "sm4_decrypt"
        elif algorithm.upper() == "SM2":
            tool_name = "sm2_decrypt"
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")

        return await self.call_govmcp_tool(
            tool_name,
            {"encrypted_data": encrypted_data, "key_id": key_id},
            user_id=user_id,
        )

    async def hash_data(
        self,
        data: str,
        algorithm: str = "SM3",
        user_id: str | None = None,
    ) -> str:
        """计算数据哈希"""
        return await self.call_govmcp_tool(
            "sm3_hash",
            {"data": data},
            user_id=user_id,
        )

    async def create_approval(
        self,
        title: str,
        description: str,
        requester: str,
        department: str,
        user_id: str | None = None,
    ) -> str:
        """创建审批请求"""
        return await self.call_govmcp_tool(
            "approval_create",
            {
                "title": title,
                "description": description,
                "requester": requester,
                "department": department,
            },
            user_id=user_id,
        )

    async def approve_approval(
        self,
        request_id: str,
        approver_id: str,
        comment: str = "",
        user_id: str | None = None,
    ) -> str:
        """批准审批"""
        return await self.call_govmcp_tool(
            "approval_approve",
            {
                "request_id": request_id,
                "approver_id": approver_id,
                "comment": comment,
            },
            user_id=user_id,
        )

    async def get_approval_status(
        self,
        request_id: str,
        user_id: str | None = None,
    ) -> str:
        """获取审批状态"""
        return await self.call_govmcp_tool(
            "approval_status",
            {"request_id": request_id},
            user_id=user_id,
        )

    async def log_audit(
        self,
        action: str,
        user_id: str,
        resource: str,
        details: dict | None = None,
        success: bool = True,
    ) -> str:
        """记录审计日志"""
        return await self.call_govmcp_tool(
            "audit_log",
            {
                "action": action,
                "user_id": user_id,
                "resource": resource,
                "details": details or {},
                "success": success,
            },
        )

    async def verify_audit_chain(self, user_id: str | None = None) -> str:
        """验证审计链"""
        return await self.call_govmcp_tool("audit_verify", {}, user_id=user_id)

    async def mask_sensitive_data(
        self,
        data_type: str,
        value: str,
        user_id: str | None = None,
    ) -> str:
        """脱敏敏感数据"""
        tool_map = {
            "id_number": "mask_id_number",
            "phone": "mask_phone",
            "bank_card": "mask_bank_card",
        }

        tool_name = tool_map.get(data_type.lower())
        if not tool_name:
            raise ValueError(f"Unknown data type: {data_type}")

        return await self.call_govmcp_tool(
            tool_name,
            {data_type: value},
            user_id=user_id,
        )

    async def validate_gov_data(
        self,
        data_type: str,
        value: str,
        user_id: str | None = None,
    ) -> str:
        """验证政务数据"""
        tool_map = {
            "id_number": "validate_id_number",
            "credit_code": "validate_credit_code",
        }

        tool_name = tool_map.get(data_type.lower())
        if not tool_name:
            raise ValueError(f"Unknown data type: {data_type}")

        return await self.call_govmcp_tool(
            tool_name,
            {data_type: value},
            user_id=user_id,
        )

    def get_stats(self) -> dict:
        """获取统计信息"""
        stats = super().get_stats()

        if self._gov_enabled:
            stats["govmcp"] = {
                "enabled": True,
                "tools_count": len(self.get_govmcp_tools()),
            }
        else:
            stats["govmcp"] = {
                "enabled": False,
            }

        return stats


__all__ = ["GovEnhancedHermesEngine"]
