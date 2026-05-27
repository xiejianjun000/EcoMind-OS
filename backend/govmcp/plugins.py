"""
GovMCP Plugin - 政务合规插件
"""

from __future__ import annotations

import logging
from typing import Any

from taiji_agent.plugin_system import Plugin, PluginConfig, PluginMetadata
from .crypto import (
    KeyManager,
    SM2Encryptor,
    SM4Encryptor,
    SM3Hash,
    AuditTrail,
)
from .workflow import ApprovalWorkflow, ApprovalStatus
from .tools import GovTools


logger = logging.getLogger(__name__)


class GovMCPPlugin(Plugin):
    """
    GovMCP 插件

    提供政务合规功能：
    - 国密加密 (SM2/SM3/SM4)
    - 审批工作流
    - 审计日志
    - 政务工具
    """

    def __init__(self):
        self.config = PluginConfig(
            name="govmcp",
            version="1.0.0",
            description="政务合规模块 - 国密加密、审批工作流、审计日志",
            author="Taiji Agent Team",
            settings={
                "encryption_enabled": True,
                "audit_enabled": True,
                "approval_required": True,
            },
        )
        self.metadata = PluginMetadata(
            plugin_id="govmcp",
            name="GovMCP",
            version="1.0.0",
            description="政务合规模块",
            author="Taiji Agent Team",
        )

        self.key_manager = KeyManager()
        self.approval_workflow = ApprovalWorkflow()
        self.audit_trail = AuditTrail()
        self.tools = GovTools()

    async def on_load(self) -> bool:
        """加载插件"""
        # 初始化密钥
        self.key_manager.generate_sm2_key_pair("default")
        self.key_manager.generate_sm4_key("default")
        
        logger.info("GovMCPPlugin loaded successfully")
        return True

    async def on_unload(self):
        """卸载插件"""
        logger.info("GovMCPPlugin unloaded")

    async def on_activate(self) -> bool:
        """激活插件"""
        logger.info("GovMCPPlugin activated")
        return True

    async def on_deactivate(self):
        """停用插件"""
        logger.info("GovMCPPlugin deactivated")

    async def encrypt_sm4(self, data: bytes) -> str:
        """SM4 加密"""
        if not self.config.settings.get("encryption_enabled", True):
            return data.decode()
        
        key = self.key_manager.get_sm4_key("default")
        if not key:
            key = self.key_manager.generate_sm4_key("default")
        
        encryptor = SM4Encryptor(key)
        return encryptor.encrypt(data)

    async def decrypt_sm4(self, encrypted_data: str) -> bytes:
        """SM4 解密"""
        key = self.key_manager.get_sm4_key("default")
        if not key:
            key = self.key_manager.generate_sm4_key("default")
        
        encryptor = SM4Encryptor(key)
        return encryptor.decrypt(encrypted_data)

    async def hash_sm3(self, data: bytes) -> str:
        """SM3 哈希"""
        return SM3Hash.hash(data)

    async def log_audit(
        self,
        action: str,
        user_id: str,
        resource: str,
        details: dict | None = None,
        success: bool = True,
    ):
        """记录审计日志"""
        if not self.config.settings.get("audit_enabled", True):
            return
        
        self.audit_trail.record_action(
            user_id=user_id,
            action=action,
            resource=resource,
            details=details,
            success=success,
        )

    async def create_approval(
        self,
        title: str,
        description: str,
        requester: str,
        department: str,
    ) -> str:
        """创建审批请求"""
        request = self.approval_workflow.create_request(
            title=title,
            description=description,
            requester=requester,
            department=department,
        )
        
        await self.log_audit(
            action="create_approval",
            user_id=requester,
            resource=title,
        )
        
        return request.request_id

    async def submit_approval(self, request_id: str):
        """提交审批"""
        await self.approval_workflow.submit_request(request_id)
        
        await self.log_audit(
            action="submit_approval",
            user_id="system",
            resource=request_id,
        )

    async def approve(
        self,
        request_id: str,
        approver_id: str,
        comment: str = "",
    ):
        """批准审批"""
        await self.approval_workflow.approve(
            request_id=request_id,
            approver_id=approver_id,
            comment=comment,
        )
        
        await self.log_audit(
            action="approve",
            user_id=approver_id,
            resource=request_id,
        )

    async def reject(
        self,
        request_id: str,
        approver_id: str,
        comment: str = "",
    ):
        """拒绝审批"""
        await self.approval_workflow.reject(
            request_id=request_id,
            approver_id=approver_id,
            comment=comment,
        )
        
        await self.log_audit(
            action="reject",
            user_id=approver_id,
            resource=request_id,
            success=False,
        )

    def get_approval_status(self, request_id: str) -> dict:
        """获取审批状态"""
        request = self.approval_workflow.get_request(request_id)
        if not request:
            return {"found": False}
        
        return {
            "found": True,
            "request_id": request_id,
            "status": request.status.value,
            "current_step": request.current_step,
            "title": request.title,
        }

    def get_audit_logs(
        self,
        user_id: str | None = None,
        action: str | None = None,
        limit: int = 100,
    ) -> list:
        """获取审计日志"""
        records = self.audit_trail.get_records(
            user_id=user_id,
            action=action,
            limit=limit,
        )
        
        return [
            {
                "record_id": r.record_id,
                "user_id": r.user_id,
                "action": r.action,
                "resource": r.resource,
                "timestamp": r.timestamp,
                "success": r.success,
                "details": r.details,
            }
            for r in records
        ]

    def verify_audit_chain(self) -> tuple[bool, list[str]]:
        """验证审计链"""
        return self.audit_trail.verify_chain()

    def get_stats(self) -> dict:
        """获取统计信息"""
        return {
            "audit_entries": len(self.audit_trail._records),
            "state": self.metadata.state.value,
            "encryption_enabled": self.config.settings.get("encryption_enabled", True),
            "audit_enabled": self.config.settings.get("audit_enabled", True),
        }
