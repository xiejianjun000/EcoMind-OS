"""
GovMCP Server - 政务合规版 MCP Server

兼容 MCP 协议的国产政务版工具服务器
提供国密加密、审批工作流、审计日志等政务功能
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from .crypto import KeyManager, SM2Encryptor, SM4Encryptor, SM3Hash, AuditTrail
from .workflow import ApprovalWorkflow, ApprovalStatus
from .tools import GovTools

logger = logging.getLogger(__name__)


class GovMCPServer:
    """
    GovMCP Server

    国产政务版 MCP Server，兼容标准 MCP 协议
    提供以下工具类别：
    - 国密加密工具 (SM2/SM3/SM4)
    - 审批工作流工具
    - 审计日志工具
    - 政务数据处理工具
    """

    def __init__(self):
        self._key_manager = KeyManager()
        self._audit_trail = AuditTrail()
        self._approval_workflow = ApprovalWorkflow()
        self._gov_tools = GovTools()
        self._initialized = False
        self._tools: dict[str, dict[str, Any]] = {}
        self._register_tools()

    def _register_tools(self):
        """注册所有政务工具"""
        self._register_crypto_tools()
        self._register_workflow_tools()
        self._register_audit_tools()
        self._register_gov_tools()
        logger.info(f"GovMCP Server registered {len(self._tools)} tools")

    def _register_crypto_tools(self):
        """注册国密加密工具"""
        self._tools["sm3_hash"] = {
            "name": "sm3_hash",
            "description": "SM3 哈希算法 - 国产密码杂凑算法",
            "input_schema": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "待哈希的数据（UTF-8 字符串）",
                    },
                },
                "required": ["data"],
            },
            "handler": self._handle_sm3_hash,
        }

        self._tools["sm4_encrypt"] = {
            "name": "sm4_encrypt",
            "description": "SM4 对称加密 - 使用国密 SM4 算法加密数据",
            "input_schema": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "待加密的数据",
                    },
                    "key_id": {
                        "type": "string",
                        "description": "密钥 ID，默认为 'default'",
                        "default": "default",
                    },
                },
                "required": ["data"],
            },
            "handler": self._handle_sm4_encrypt,
        }

        self._tools["sm4_decrypt"] = {
            "name": "sm4_decrypt",
            "description": "SM4 对称解密 - 使用国密 SM4 算法解密数据",
            "input_schema": {
                "type": "object",
                "properties": {
                    "encrypted_data": {
                        "type": "string",
                        "description": "加密后的数据（Base64 编码）",
                    },
                    "key_id": {
                        "type": "string",
                        "description": "密钥 ID，默认为 'default'",
                        "default": "default",
                    },
                },
                "required": ["encrypted_data"],
            },
            "handler": self._handle_sm4_decrypt,
        }

        self._tools["sm2_encrypt"] = {
            "name": "sm2_encrypt",
            "description": "SM2 公钥加密 - 使用国密 SM2 算法加密数据",
            "input_schema": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "待加密的数据",
                    },
                    "public_key_id": {
                        "type": "string",
                        "description": "公钥 ID",
                        "default": "default",
                    },
                },
                "required": ["data"],
            },
            "handler": self._handle_sm2_encrypt,
        }

        self._tools["sm2_decrypt"] = {
            "name": "sm2_decrypt",
            "description": "SM2 私钥解密 - 使用国密 SM2 算法解密数据",
            "input_schema": {
                "type": "object",
                "properties": {
                    "encrypted_data": {
                        "type": "string",
                        "description": "加密后的数据",
                    },
                    "private_key_id": {
                        "type": "string",
                        "description": "私钥 ID",
                        "default": "default",
                    },
                },
                "required": ["encrypted_data"],
            },
            "handler": self._handle_sm2_decrypt,
        }

        self._tools["sm2_generate_keypair"] = {
            "name": "sm2_generate_keypair",
            "description": "SM2 密钥对生成 - 生成国密 SM2 公私钥对",
            "input_schema": {
                "type": "object",
                "properties": {
                    "key_id": {
                        "type": "string",
                        "description": "密钥 ID",
                        "default": "default",
                    },
                },
            },
            "handler": self._handle_sm2_generate_keypair,
        }

    def _register_workflow_tools(self):
        """注册审批工作流工具"""
        self._tools["approval_create"] = {
            "name": "approval_create",
            "description": "创建审批请求 - 发起新的政务审批流程",
            "input_schema": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "审批标题",
                    },
                    "description": {
                        "type": "string",
                        "description": "审批描述",
                    },
                    "requester": {
                        "type": "string",
                        "description": "申请人 ID",
                    },
                    "department": {
                        "type": "string",
                        "description": "申请部门",
                    },
                },
                "required": ["title", "description", "requester", "department"],
            },
            "handler": self._handle_approval_create,
        }

        self._tools["approval_submit"] = {
            "name": "approval_submit",
            "description": "提交审批 - 将审批请求提交到下一审批节点",
            "input_schema": {
                "type": "object",
                "properties": {
                    "request_id": {
                        "type": "string",
                        "description": "审批请求 ID",
                    },
                },
                "required": ["request_id"],
            },
            "handler": self._handle_approval_submit,
        }

        self._tools["approval_approve"] = {
            "name": "approval_approve",
            "description": "审批通过 - 批准当前审批节点",
            "input_schema": {
                "type": "object",
                "properties": {
                    "request_id": {
                        "type": "string",
                        "description": "审批请求 ID",
                    },
                    "approver_id": {
                        "type": "string",
                        "description": "审批人 ID",
                    },
                    "comment": {
                        "type": "string",
                        "description": "审批意见",
                        "default": "",
                    },
                },
                "required": ["request_id", "approver_id"],
            },
            "handler": self._handle_approval_approve,
        }

        self._tools["approval_reject"] = {
            "name": "approval_reject",
            "description": "审批拒绝 - 拒绝当前审批节点",
            "input_schema": {
                "type": "object",
                "properties": {
                    "request_id": {
                        "type": "string",
                        "description": "审批请求 ID",
                    },
                    "approver_id": {
                        "type": "string",
                        "description": "审批人 ID",
                    },
                    "comment": {
                        "type": "string",
                        "description": "拒绝原因",
                        "default": "",
                    },
                },
                "required": ["request_id", "approver_id"],
            },
            "handler": self._handle_approval_reject,
        }

        self._tools["approval_status"] = {
            "name": "approval_status",
            "description": "查询审批状态 - 获取审批请求的当前状态",
            "input_schema": {
                "type": "object",
                "properties": {
                    "request_id": {
                        "type": "string",
                        "description": "审批请求 ID",
                    },
                },
                "required": ["request_id"],
            },
            "handler": self._handle_approval_status,
        }

    def _register_audit_tools(self):
        """注册审计日志工具"""
        self._tools["audit_log"] = {
            "name": "audit_log",
            "description": "记录审计日志 - 记录操作行为到审计链",
            "input_schema": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "description": "操作类型",
                    },
                    "user_id": {
                        "type": "string",
                        "description": "用户 ID",
                    },
                    "resource": {
                        "type": "string",
                        "description": "资源标识",
                    },
                    "details": {
                        "type": "object",
                        "description": "详细信息",
                        "default": {},
                    },
                    "success": {
                        "type": "boolean",
                        "description": "是否成功",
                        "default": True,
                    },
                },
                "required": ["action", "user_id", "resource"],
            },
            "handler": self._handle_audit_log,
        }

        self._tools["audit_query"] = {
            "name": "audit_query",
            "description": "查询审计日志 - 按条件查询审计记录",
            "input_schema": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "用户 ID（可选）",
                    },
                    "action": {
                        "type": "string",
                        "description": "操作类型（可选）",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回记录数限制",
                        "default": 100,
                    },
                },
            },
            "handler": self._handle_audit_query,
        }

        self._tools["audit_verify"] = {
            "name": "audit_verify",
            "description": "验证审计链 - 验证审计链的完整性",
            "input_schema": {
                "type": "object",
                "properties": {},
            },
            "handler": self._handle_audit_verify,
        }

    def _register_gov_tools(self):
        """注册政务数据处理工具"""
        self._tools["mask_id_number"] = {
            "name": "mask_id_number",
            "description": "身份证号脱敏 - 脱敏身份证号（显示前3后4位）",
            "input_schema": {
                "type": "object",
                "properties": {
                    "id_number": {
                        "type": "string",
                        "description": "身份证号",
                    },
                },
                "required": ["id_number"],
            },
            "handler": self._handle_mask_id_number,
        }

        self._tools["mask_phone"] = {
            "name": "mask_phone",
            "description": "手机号脱敏 - 脱敏手机号（显示前3后4位）",
            "input_schema": {
                "type": "object",
                "properties": {
                    "phone": {
                        "type": "string",
                        "description": "手机号",
                    },
                },
                "required": ["phone"],
            },
            "handler": self._handle_mask_phone,
        }

        self._tools["mask_bank_card"] = {
            "name": "mask_bank_card",
            "description": "银行卡号脱敏 - 脱敏银行卡号（显示前6后4位）",
            "input_schema": {
                "type": "object",
                "properties": {
                    "bank_card": {
                        "type": "string",
                        "description": "银行卡号",
                    },
                },
                "required": ["bank_card"],
            },
            "handler": self._handle_mask_bank_card,
        }

        self._tools["validate_id_number"] = {
            "name": "validate_id_number",
            "description": "身份证号验证 - 验证身份证号格式和校验位",
            "input_schema": {
                "type": "object",
                "properties": {
                    "id_number": {
                        "type": "string",
                        "description": "身份证号",
                    },
                },
                "required": ["id_number"],
            },
            "handler": self._handle_validate_id_number,
        }

        self._tools["validate_credit_code"] = {
            "name": "validate_credit_code",
            "description": "统一社会信用代码验证 - 验证信用代码格式",
            "input_schema": {
                "type": "object",
                "properties": {
                    "credit_code": {
                        "type": "string",
                        "description": "统一社会信用代码",
                    },
                },
                "required": ["credit_code"],
            },
            "handler": self._handle_validate_credit_code,
        }

        self._tools["calculate_workday"] = {
            "name": "calculate_workday",
            "description": "工作日计算 - 计算指定天数后的工作日",
            "input_schema": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "起始日期（YYYY-MM-DD）",
                    },
                    "days": {
                        "type": "integer",
                        "description": "天数",
                    },
                },
                "required": ["start_date", "days"],
            },
            "handler": self._handle_calculate_workday,
        }

    async def _handle_sm3_hash(self, data: str, **kwargs) -> str:
        """处理 SM3 哈希请求"""
        result = SM3Hash.hash(data.encode("utf-8"))
        self._audit_trail.record_action(
            user_id=kwargs.get("user_id", "system"),
            action="sm3_hash",
            resource="crypto",
            details={"data_length": len(data)},
        )
        return json.dumps({"hash": result, "algorithm": "SM3"}, ensure_ascii=False)

    async def _handle_sm4_encrypt(self, data: str, key_id: str = "default", **kwargs) -> str:
        """处理 SM4 加密请求"""
        key = self._key_manager.get_sm4_key(key_id)
        if not key:
            key = self._key_manager.generate_sm4_key(key_id)
        encryptor = SM4Encryptor(key)
        result = encryptor.encrypt(data.encode("utf-8"))
        self._audit_trail.record_action(
            user_id=kwargs.get("user_id", "system"),
            action="sm4_encrypt",
            resource="crypto",
            details={"key_id": key_id, "data_length": len(data)},
        )
        return json.dumps({"encrypted_data": result, "key_id": key_id, "algorithm": "SM4"}, ensure_ascii=False)

    async def _handle_sm4_decrypt(self, encrypted_data: str, key_id: str = "default", **kwargs) -> str:
        """处理 SM4 解密请求"""
        key = self._key_manager.get_sm4_key(key_id)
        if not key:
            return json.dumps({"error": f"Key not found: {key_id}"}, ensure_ascii=False)
        encryptor = SM4Encryptor(key)
        try:
            result = encryptor.decrypt(encrypted_data)
            return json.dumps({"decrypted_data": result.decode("utf-8"), "key_id": key_id}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    async def _handle_sm2_encrypt(self, data: str, public_key_id: str = "default", **kwargs) -> str:
        """处理 SM2 加密请求"""
        key_pair = self._key_manager.get_sm2_key_pair(public_key_id)
        if not key_pair:
            key_pair = self._key_manager.generate_sm2_key_pair(public_key_id)
        encryptor = SM2Encryptor(key_pair)
        result = encryptor.encrypt(data.encode("utf-8"))
        self._audit_trail.record_action(
            user_id=kwargs.get("user_id", "system"),
            action="sm2_encrypt",
            resource="crypto",
            details={"key_id": public_key_id},
        )
        return json.dumps({"encrypted_data": result, "key_id": public_key_id, "algorithm": "SM2"}, ensure_ascii=False)

    async def _handle_sm2_decrypt(self, encrypted_data: str, private_key_id: str = "default", **kwargs) -> str:
        """处理 SM2 解密请求"""
        key_pair = self._key_manager.get_sm2_key_pair(private_key_id)
        if not key_pair:
            return json.dumps({"error": f"Private key not found: {private_key_id}"}, ensure_ascii=False)
        encryptor = SM2Encryptor(key_pair)
        try:
            result = encryptor.decrypt(encrypted_data)
            return json.dumps({"decrypted_data": result.decode("utf-8")}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    async def _handle_sm2_generate_keypair(self, key_id: str = "default", **kwargs) -> str:
        """处理 SM2 密钥对生成请求"""
        key_pair = self._key_manager.generate_sm2_key_pair(key_id)
        return json.dumps({
            "key_id": key_id,
            "public_key": key_pair.public_key,
            "message": "Key pair generated successfully",
        }, ensure_ascii=False)

    async def _handle_approval_create(self, title: str, description: str, requester: str, department: str, **kwargs) -> str:
        """处理审批创建请求"""
        request = self._approval_workflow.create_request(
            title=title,
            description=description,
            requester=requester,
            department=department,
        )
        self._audit_trail.record_action(
            user_id=requester,
            action="approval_create",
            resource=request.request_id,
            details={"title": title, "department": department},
        )
        return json.dumps({
            "request_id": request.request_id,
            "status": "draft",
            "created_at": str(request.created_at),
        }, ensure_ascii=False)

    async def _handle_approval_submit(self, request_id: str, **kwargs) -> str:
        """处理审批提交请求"""
        await self._approval_workflow.submit_request(request_id)
        self._audit_trail.record_action(
            user_id=kwargs.get("user_id", "system"),
            action="approval_submit",
            resource=request_id,
        )
        return json.dumps({"request_id": request_id, "status": "pending"})

    async def _handle_approval_approve(self, request_id: str, approver_id: str, comment: str = "", **kwargs) -> str:
        """处理审批通过请求"""
        await self._approval_workflow.approve(request_id, approver_id, comment)
        self._audit_trail.record_action(
            user_id=approver_id,
            action="approval_approve",
            resource=request_id,
            details={"comment": comment},
        )
        return json.dumps({"request_id": request_id, "status": "approved", "approver": approver_id})

    async def _handle_approval_reject(self, request_id: str, approver_id: str, comment: str = "", **kwargs) -> str:
        """处理审批拒绝请求"""
        await self._approval_workflow.reject(request_id, approver_id, comment)
        self._audit_trail.record_action(
            user_id=approver_id,
            action="approval_reject",
            resource=request_id,
            details={"comment": comment},
            success=False,
        )
        return json.dumps({"request_id": request_id, "status": "rejected", "approver": approver_id})

    async def _handle_approval_status(self, request_id: str, **kwargs) -> str:
        """处理审批状态查询请求"""
        request = self._approval_workflow.get_request(request_id)
        if not request:
            return json.dumps({"error": f"Request not found: {request_id}"}, ensure_ascii=False)
        return json.dumps({
            "request_id": request.request_id,
            "status": request.status.value,
            "current_step": request.current_step,
            "title": request.title,
            "requester": request.requester,
        }, ensure_ascii=False)

    async def _handle_audit_log(self, action: str, user_id: str, resource: str, details: dict = None, success: bool = True, **kwargs) -> str:
        """处理审计日志记录请求"""
        self._audit_trail.record_action(
            user_id=user_id,
            action=action,
            resource=resource,
            details=details,
            success=success,
        )
        return json.dumps({"status": "logged", "action": action, "user_id": user_id})

    async def _handle_audit_query(self, user_id: str = None, action: str = None, limit: int = 100, **kwargs) -> str:
        """处理审计日志查询请求"""
        records = self._audit_trail.get_records(user_id=user_id, action=action, limit=limit)
        return json.dumps({
            "count": len(records),
            "records": [
                {
                    "record_id": r.record_id,
                    "user_id": r.user_id,
                    "action": r.action,
                    "resource": r.resource,
                    "timestamp": str(r.timestamp),
                    "success": r.success,
                }
                for r in records
            ],
        }, ensure_ascii=False)

    async def _handle_audit_verify(self, **kwargs) -> str:
        """处理审计链验证请求"""
        is_valid, errors = self._audit_trail.verify_chain()
        return json.dumps({"valid": is_valid, "errors": errors, "record_count": len(self._audit_trail._records)})

    async def _handle_mask_id_number(self, id_number: str, **kwargs) -> str:
        """处理身份证号脱敏请求"""
        masked = self._gov_tools.id_number.mask_id_number(id_number)
        return json.dumps({"original_length": len(id_number), "masked": masked}, ensure_ascii=False)

    async def _handle_mask_phone(self, phone: str, **kwargs) -> str:
        """处理手机号脱敏请求"""
        masked = self._gov_tools.masking.mask_phone(phone)
        return json.dumps({"original_length": len(phone), "masked": masked}, ensure_ascii=False)

    async def _handle_mask_bank_card(self, bank_card: str, **kwargs) -> str:
        """处理银行卡号脱敏请求"""
        masked = self._gov_tools.masking.mask_bank_account(bank_card)
        return json.dumps({"original_length": len(bank_card), "masked": masked}, ensure_ascii=False)

    async def _handle_validate_id_number(self, id_number: str, **kwargs) -> str:
        """处理身份证号验证请求"""
        is_valid = self._gov_tools.id_number.validate_id_number(id_number)
        birthday = None
        if is_valid:
            bd = self._gov_tools.id_number.extract_birthday(id_number)
            birthday = bd.strftime("%Y-%m-%d") if bd else None
        return json.dumps({"valid": is_valid, "birthday": birthday, "id_number": id_number}, ensure_ascii=False)

    async def _handle_validate_credit_code(self, credit_code: str, **kwargs) -> str:
        """处理统一社会信用代码验证请求"""
        is_valid = self._gov_tools.credit_code.validate_credit_code(credit_code)
        return json.dumps({"valid": is_valid, "credit_code": credit_code}, ensure_ascii=False)

    async def _handle_calculate_workday(self, start_date: str, days: int, **kwargs) -> str:
        """处理工作日计算请求"""
        from datetime import datetime
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        result_date = self._gov_tools.calendar.add_workdays(start, days)
        return json.dumps({"start_date": start_date, "days": days, "result_date": result_date.strftime("%Y-%m-%d")}, ensure_ascii=False)

    def get_tools(self) -> list[dict[str, Any]]:
        """获取所有工具列表（MCP 协议格式）"""
        return [
            {
                "name": tool["name"],
                "description": tool["description"],
                "inputSchema": tool["input_schema"],
            }
            for tool in self._tools.values()
        ]

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> str:
        """调用指定工具"""
        if tool_name not in self._tools:
            return json.dumps({"error": f"Tool not found: {tool_name}"})

        tool = self._tools[tool_name]
        handler = tool["handler"]

        try:
            if asyncio.iscoroutinefunction(handler):
                result = await handler(**arguments)
            else:
                result = handler(**arguments)
            return result
        except Exception as e:
            logger.error(f"Tool call error: {tool_name} - {e}")
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    async def initialize(self) -> dict[str, Any]:
        """初始化 GovMCP Server"""
        self._key_manager.generate_sm2_key_pair("default")
        self._key_manager.generate_sm4_key("default")
        self._initialized = True
        logger.info("GovMCP Server initialized")
        return {
            "name": "GovMCP",
            "version": "1.0.0",
            "description": "国产政务版 MCP Server - 国密加密、审批工作流、审计日志",
            "protocol_version": "2024-11-05",
            "tools_count": len(self._tools),
        }

    @property
    def is_initialized(self) -> bool:
        return self._initialized


__all__ = ["GovMCPServer"]
