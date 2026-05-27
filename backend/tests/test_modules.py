"""
EcoMind OS — 集成测试（enforcement / approval / compliance / reports）
"""

import pytest
import sys
sys.path.insert(0, '.')


class TestEnforcementService:
    @pytest.mark.asyncio
    async def test_create_case(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        record = await svc.create_case({
            "title": "测试案件-集成测试",
            "enterprise_name": "测试企业",
            "violation": "测试违法事实",
            "city": "长沙市",
            "officers": ["张三", "李四"],
            "severity": "高",
        })
        assert record.case_number.startswith("HN-ENF-")
        assert record.stage == "线索"
        assert record.metadata.get("enterprise_name") == "测试企业"

    @pytest.mark.asyncio
    async def test_valid_transition(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        record = await svc.create_case({"title": "流转测试"})
        result = await svc.transition(record.case_id, "受理", "测试员")
        assert result is not None
        assert result.stage == "受理"
        assert len(result.timeline) >= 2

    @pytest.mark.asyncio
    async def test_invalid_transition_rejected(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        record = await svc.create_case({"title": "非法流转测试"})
        with pytest.raises(ValueError, match="状态流转不允许"):
            await svc.transition(record.case_id, "决定", "测试员")

    @pytest.mark.asyncio
    async def test_delete_clue_only(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        record = await svc.create_case({"title": "删除测试"})
        assert await svc.delete_case(record.case_id) is True
        assert await svc.get_case(record.case_id) is None


class TestApprovalService:
    @pytest.mark.asyncio
    async def test_create_approval(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        record = await svc.create_approval({
            "title": "测试审批",
            "approval_type": "环评报告",
            "applicant": "张三",
            "department": "环评处",
            "enterprise_name": "测试企业",
            "content": "测试内容",
        })
        assert record.approval_number.startswith("HN-APR-")
        assert record.status == "pending"
        assert record.level == "L1-科员"

    @pytest.mark.asyncio
    async def test_approve_L1_to_L2(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        record = await svc.create_approval({"title": "逐级审批", "approval_type": "环评报告"})
        result = await svc.transition(record.approval_id, "approve", "科员A")
        assert result.level == "L2-处长"
        assert result.status == "pending"

    @pytest.mark.asyncio
    async def test_approve_L3_final(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        record = await svc.create_approval({"title": "终审", "approval_type": "排污许可"})
        await svc.transition(record.approval_id, "approve", "科员")  # L1→L2
        await svc.transition(record.approval_id, "approve", "处长")  # L2→L3
        result = await svc.transition(record.approval_id, "approve", "厅领导")  # L3→approved
        assert result.status == "approved"

    @pytest.mark.asyncio
    async def test_reject_skip_level(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        record = await svc.create_approval({"title": "跳级驳回", "approval_type": "竣工验收"})
        result = await svc.transition(record.approval_id, "reject", "处长", "材料不足")
        assert result.status == "rejected"


class TestComplianceService:
    @pytest.mark.asyncio
    async def test_create_and_run_check(self):
        from api.services.compliance_service import get_compliance_service
        svc = get_compliance_service()
        check = await svc.create_check({
            "title": "合规测试",
            "category": "废水",
            "regulation": "《水污染防治法》第10条",
            "target": "XX化工厂",
        })
        assert check.status == "pending"
        result = await svc.run_check(check.check_id)
        assert result.status == "completed"
        assert result.result in ("pass", "fail")


class TestReportService:
    @pytest.mark.asyncio
    async def test_generate_report(self):
        from api.services.report_service import get_report_service
        svc = get_report_service()
        report = await svc.generate({
            "title": "测试报告",
            "report_type": "监测报告",
            "params": {"city": "长沙市", "aqi": "85", "conclusion": "良好"},
        })
        assert report.status == "generated"
        assert "长沙市" in report.content
        assert "85" in report.content


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
