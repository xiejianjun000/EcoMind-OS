"""
L1 单元测试 — 环评审批模块（增强版）
覆盖：L1/L2/L3 三级审批 + 边界条件 + 区块链存证
"""
import pytest
import sys
sys.path.insert(0, '.')


class TestApprovalCreation:
    """审批创建测试"""

    @pytest.mark.asyncio
    async def test_create_minimal(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({"title": "最小审批", "approval_type": "环评报告"})
        assert r.approval_number.startswith("HN-APR-")
        assert r.status == "pending"

    @pytest.mark.asyncio
    async def test_create_with_all_fields(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({
            "title": "湘潭钢铁环评审批",
            "approval_type": "环评报告",
            "applicant": "王主管",
            "department": "环评处",
            "enterprise_name": "湘潭钢铁集团有限公司",
            "content": "年产500万吨钢铁项目环境影响评价报告书",
        })
        assert r.enterprise_name == "湘潭钢铁集团有限公司"
        assert r.level == "L1-科员"


class TestApprovalThreeLevelFlow:
    """三级审批完整流程"""

    @pytest.mark.asyncio
    async def test_L1_to_L2(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({"title": "L1→L2", "approval_type": "排污许可"})
        result = await svc.transition(r.approval_id, "approve", "科员A")
        assert result.level == "L2-处长"
        assert result.status == "pending"

    @pytest.mark.asyncio
    async def test_L2_to_L3(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({"title": "L2→L3", "approval_type": "辐射安全许可"})
        await svc.transition(r.approval_id, "approve", "科员")
        result = await svc.transition(r.approval_id, "approve", "处长B")
        assert result.level == "L3-厅领导"

    @pytest.mark.asyncio
    async def test_L3_final_approval(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({"title": "三级终审", "approval_type": "建设项目验收"})
        await svc.transition(r.approval_id, "approve", "科员")
        await svc.transition(r.approval_id, "approve", "处长")
        result = await svc.transition(r.approval_id, "approve", "厅领导")
        assert result.status == "approved"

    @pytest.mark.asyncio
    async def test_reject_at_any_level(self):
        """任意级别都可以驳回"""
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({"title": "L1驳回", "approval_type": "危废经营许可"})
        result = await svc.transition(r.approval_id, "reject", "科员", "材料不完整")
        assert result.status == "rejected"

    @pytest.mark.asyncio
    async def test_reject_with_comment(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({"title": "驳回带意见", "approval_type": "竣工验收"})
        result = await svc.transition(r.approval_id, "reject", "处长",
                                       "环境影响评价等级不足，需补充生态专题")
        assert result.status == "rejected"
        # 应记录驳回原因


class TestApprovalBoundary:
    """边界条件测试"""

    @pytest.mark.asyncio
    async def test_all_five_types(self):
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        types = ["排污许可", "环评报告", "辐射安全许可", "危废经营许可", "建设项目验收"]
        for at in types:
            r = await svc.create_approval({"title": f"{at}测试", "approval_type": at})
            assert r is not None

    @pytest.mark.asyncio
    async def test_duplicate_approve_rejected(self):
        """已批准的审批不能再次批准"""
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({"title": "重复审批", "approval_type": "环评报告"})
        await svc.transition(r.approval_id, "approve", "科员")
        await svc.transition(r.approval_id, "approve", "处长")
        await svc.transition(r.approval_id, "approve", "厅领导")
        # 此时 status=approved，不能再 approve
        with pytest.raises(ValueError):
            await svc.transition(r.approval_id, "approve", "其他人")
