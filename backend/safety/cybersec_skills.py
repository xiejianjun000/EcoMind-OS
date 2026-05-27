"""
Cybersecurity Skills Mapper — 将 mukul975/Anthropic-Cybersecurity-Skills (9.6K ⭐) 接入安全链。

754 条结构化安全技能，映射到 5 大框架:
  - MITRE ATT&CK — 攻击行为分类
  - NIST CSF 2.0 — 网络安全框架
  - MITRE ATLAS — AI 对抗威胁
  - D3FEND — 防御技术映射
  - NIST AI RMF — AI 风险管理

EcoMind SafetyChain 6 层映射:
  L1 → 输入护栏 (Xiangxin Guardrails 等效)
  L2 → 策略护栏 (NeMo Guardrails 等效)
  L3 → 输出验证 (EcoVerifyAdapter 六层 VERIFY)
  L4 → 幻觉检测 (LettuceDetect 等效)
  L5 → 审计追踪 (Langfuse Tracer 等效)
  L6 → 政务审批 (GovWorkflowManager)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class SafetyChainLevel(str, Enum):
    L1_INPUT_GUARD = "input_guard"
    L2_POLICY_GUARD = "policy_guard"
    L3_OUTPUT_VERIFY = "output_verify"
    L4_HALLUCINATION = "hallucination_detect"
    L5_AUDIT_TRACE = "audit_trace"
    L6_GOV_APPROVAL = "gov_approval"


@dataclass
class SecurityCheckRule:
    """安全检测规则"""
    rule_id: str
    name: str
    level: SafetyChainLevel
    framework: str           # MITRE ATT&CK / NIST CSF 2.0 / MITRE ATLAS / D3FEND / NIST AI RMF
    domain: str              # 安全领域 (26 个之一)
    description: str
    check_pattern: str = ""   # 检测模式 (关键词/正则)
    severity: str = "medium"  # low / medium / high / critical
    remediation: str = ""


class CyberSecSkillMapper:
    """
    将 754 条安全技能映射到 EcoMind SafetyChain 6 层。

    内置精简版（核心规则），完整版从 Anthropic-Cybersecurity-Skills 仓库加载。
    """

    # 26 个安全领域
    DOMAINS = [
        "cloud_security", "network_security", "application_security",
        "endpoint_security", "data_security", "identity_access",
        "incident_response", "vulnerability_management", "threat_intelligence",
        "security_operations", "devsecops", "compliance", "risk_management",
        "supply_chain", "cryptography", "ai_ml_security", "iot_security",
        "mobile_security", "container_security", "serverless_security",
        "blockchain_security", "privacy", "forensics", "governance",
        "awareness_training", "physical_security",
    ]

    # 核心检测规则 (精简版，完整版 754 条从仓库加载)
    CORE_RULES: list[SecurityCheckRule] = [
        # ── L1 输入护栏 ──
        SecurityCheckRule("SEC-001", "Prompt注入检测", SafetyChainLevel.L1_INPUT_GUARD,
                          "MITRE ATLAS", "ai_ml_security",
                          "检测用户输入中的提示注入/越狱尝试",
                          check_pattern="ignore|bypass|jailbreak|忽略|绕过|越狱",
                          severity="high", remediation="拦截输入，记录告警"),
        SecurityCheckRule("SEC-002", "敏感信息泄露检测", SafetyChainLevel.L1_INPUT_GUARD,
                          "NIST AI RMF", "data_security",
                          "检测输入中是否包含身份证/手机号/银行卡等PII",
                          check_pattern=r"\d{15}|\d{18}|1[3-9]\d{9}",
                          severity="high", remediation="脱敏处理"),
        # ── L2 策略护栏 ──
        SecurityCheckRule("SEC-010", "合规知识范围检查", SafetyChainLevel.L2_POLICY_GUARD,
                          "NIST CSF 2.0", "compliance",
                          "确保AI输出不超出合规知识范围",
                          severity="medium", remediation="限制回答范围"),
        SecurityCheckRule("SEC-011", "执法建议质量控制", SafetyChainLevel.L2_POLICY_GUARD,
                          "NIST AI RMF", "governance",
                          "执法建议必须包含免责声明",
                          check_pattern="AI辅助生成.*人工审核",
                          severity="high", remediation="追加免责声明"),
        # ── L3 输出验证 ──
        SecurityCheckRule("SEC-020", "环境数据真实性验证", SafetyChainLevel.L3_OUTPUT_VERIFY,
                          "NIST AI RMF", "ai_ml_security",
                          "确保输出的环境数据有来源可查",
                          severity="critical", remediation="要求标注数据来源"),
        SecurityCheckRule("SEC-021", "法规引用准确性", SafetyChainLevel.L3_OUTPUT_VERIFY,
                          "NIST AI RMF", "compliance",
                          "法规条款引用需可验证",
                          severity="high", remediation="附法规全文链接"),
        # ── L4 幻觉检测 ──
        SecurityCheckRule("SEC-030", "碳排放数据幻觉检测", SafetyChainLevel.L4_HALLUCINATION,
                          "NIST AI RMF", "ai_ml_security",
                          "碳排放数值合理性检查（不可能出现负排放/数值量级异常）",
                          severity="high", remediation="标记待核实"),
        # ── L5 审计追踪 ──
        SecurityCheckRule("SEC-040", "Agent决策审计", SafetyChainLevel.L5_AUDIT_TRACE,
                          "NIST CSF 2.0", "security_operations",
                          "每次Agent工具调用需记录审计日志",
                          severity="medium", remediation="确保日志完整"),
        # ── L6 政务审批 ──
        SecurityCheckRule("SEC-050", "国密算法合规检查", SafetyChainLevel.L6_GOV_APPROVAL,
                          "NIST CSF 2.0", "cryptography",
                          "GOVMCP审批流必须使用SM2/SM3/SM4国密算法",
                          severity="critical", remediation="强制SM算法"),
    ]

    def __init__(self) -> None:
        self._rules: dict[str, SecurityCheckRule] = {}
        self._domain_rules: dict[str, list[str]] = {}
        for rule in self.CORE_RULES:
            self._rules[rule.rule_id] = rule
            self._domain_rules.setdefault(rule.domain, []).append(rule.rule_id)

    def check_input(self, user_input: str) -> list[dict]:
        """L1 输入安全检查"""
        findings = []
        for rule in self._rules.values():
            if rule.level != SafetyChainLevel.L1_INPUT_GUARD:
                continue
            if rule.check_pattern:
                import re
                if re.search(rule.check_pattern, user_input):
                    findings.append({
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "remediation": rule.remediation,
                    })
        return findings

    def check_output(self, llm_output: str) -> list[dict]:
        """L3/L4 输出安全检查"""
        findings = []
        for rule in self._rules.values():
            if rule.level not in (SafetyChainLevel.L3_OUTPUT_VERIFY, SafetyChainLevel.L4_HALLUCINATION):
                continue
            if rule.check_pattern:
                import re
                if re.search(rule.check_pattern, llm_output):
                    findings.append({
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "level": rule.level.value,
                        "severity": rule.severity,
                        "remediation": rule.remediation,
                    })
        return findings

    def get_rules_by_level(self, level: SafetyChainLevel) -> list[SecurityCheckRule]:
        return [r for r in self._rules.values() if r.level == level]

    def get_rules_by_domain(self, domain: str) -> list[SecurityCheckRule]:
        ids = self._domain_rules.get(domain, [])
        return [self._rules[rid] for rid in ids]

    def get_all_domains(self) -> list[str]:
        return list(self.DOMAINS)

    def build_safety_prompt(self, level: SafetyChainLevel) -> str:
        """构建安全提示词注入"""
        rules = self.get_rules_by_level(level)
        if not rules:
            return ""
        lines = [f"\n## 🛡️ {level.value} 安全规则\n"]
        for r in rules:
            lines.append(f"- [{r.severity.upper()}] {r.name}: {r.description}")
        return "\n".join(lines)

    def load_from_repo(self, repo_path: str) -> int:
        """从 Anthropic-Cybersecurity-Skills 仓库加载完整 754 条规则"""
        from pathlib import Path
        import json
        skills_dir = Path(repo_path)
        count = 0
        for json_file in skills_dir.rglob("*.json"):
            try:
                data = json.loads(json_file.read_text())
                if isinstance(data, list):
                    for item in data:
                        rule = SecurityCheckRule(
                            rule_id=f"CSS-{count:04d}",
                            name=item.get("name", ""),
                            level=SafetyChainLevel.L3_OUTPUT_VERIFY,
                            framework=item.get("framework", "NIST CSF 2.0"),
                            domain=item.get("domain", "ai_ml_security"),
                            description=item.get("description", ""),
                            severity=item.get("severity", "medium"),
                        )
                        self._rules[rule.rule_id] = rule
                        count += 1
            except Exception as e:
                logger.warning(f"加载安全规则失败 {json_file}: {e}")
        logger.info(f"从仓库加载了 {count} 条安全规则")
        return count


_cybersec_mapper: Optional[CyberSecSkillMapper] = None


def get_cybersec_mapper() -> CyberSecSkillMapper:
    global _cybersec_mapper
    if _cybersec_mapper is None:
        _cybersec_mapper = CyberSecSkillMapper()
    return _cybersec_mapper
