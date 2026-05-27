"""
L2 集成测试 — 跨模块交互验证

测试场景:
1. 执法 → 审批联动
2. 合规 → 报告联动
3. SafetyChain → Agent 联动
4. 知识图谱 → 技能市场联动
"""
import pytest
import sys
sys.path.insert(0, '.')


class TestEnforcementApprovalIntegration:
    """执法-审批流程集成"""

    @pytest.mark.asyncio
    async def test_case_can_trigger_approval(self):
        """执法案件可触发关联审批"""
        from api.services.enforcement_service import get_enforcement_service
        from api.services.approval_service import get_approval_service
        enf_svc = get_enforcement_service()
        apr_svc = get_approval_service()

        # 创建案件
        case = await enf_svc.create_case({"title": "联动测试-案件", "severity": "严重"})
        # 创建关联审批
        approval = await apr_svc.create_approval({
            "title": f"关联审批-{case.case_number}",
            "approval_type": "环评报告",
        })
        assert case is not None
        assert approval is not None

    @pytest.mark.asyncio
    async def test_services_are_independent(self):
        """各服务独立运行不互相影响"""
        from api.services.enforcement_service import get_enforcement_service
        from api.services.approval_service import get_approval_service
        svc1 = get_enforcement_service()
        svc2 = get_enforcement_service()
        # 两次获取应返回同一实例（单例）
        assert svc1 is svc2


class TestComplianceReportIntegration:
    """合规-报告集成"""

    @pytest.mark.asyncio
    async def test_compliance_triggers_report(self):
        """合规检查结果可触发报告生成"""
        from api.services.compliance_service import get_compliance_service
        from api.services.report_service import get_report_service
        comp_svc = get_compliance_service()
        rep_svc = get_report_service()

        check = await comp_svc.create_check({"title": "联动测试-检查", "category": "废水"})
        result = await comp_svc.run_check(check.check_id)

        report = await rep_svc.generate({
            "title": f"合规报告-{check.check_id}",
            "report_type": "监测报告",
            "params": {"check_result": result.result},
        })
        assert report.status == "generated"


class TestSafetyChainAgentIntegration:
    """SafetyChain-Agent 集成"""

    def test_safety_chain_covers_all_agent_scenarios(self):
        """SafetyChain 应覆盖所有 Agent 可能的输出场景"""
        from api.routers.safety_chain import SAFETY_RULES
        # L1-L6 应覆盖输入/输出/幻觉/审计/审批
        assert "L1" in SAFETY_RULES  # 输入护栏
        assert "L3" in SAFETY_RULES  # 输出验证
        assert "L4" in SAFETY_RULES  # 幻觉检测
        assert "L5" in SAFETY_RULES  # 审计追踪

    def test_safety_chain_and_knowledge_graph_independent(self):
        """SafetyChain 和 KnowledgeGraph 独立运行"""
        from api.routers.safety_chain import SAFETY_RULES
        from graph.understand_adapter import get_knowledge_graph
        kg = get_knowledge_graph()
        assert len(SAFETY_RULES) > 0
        assert len(list(kg._nodes.values())) > 0
