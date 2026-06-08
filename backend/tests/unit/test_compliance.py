"""
L1 单元测试 — 合规检查模块
覆盖：规则引擎、评分、批量检查、边界条件
"""
import pytest
import sys
sys.path.insert(0, '.')


class TestComplianceCRUD:
    @pytest.mark.asyncio
    async def test_create_check(self):
        from api.services.compliance_service import get_compliance_service
        svc = get_compliance_service()
        r = await svc.create_check({"title": "合规测试", "category": "废水", "regulation": "《水污染防治法》第10条"})
        assert r.status == "pending"

    @pytest.mark.asyncio
    async def test_run_check_pass(self):
        from api.services.compliance_service import get_compliance_service
        svc = get_compliance_service()
        r = await svc.create_check({"title": "合规通过测试", "category": "废水", "regulation": "标准内"})
        result = await svc.run_check(r.check_id)
        assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_all_categories(self):
        from api.services.compliance_service import get_compliance_service
        svc = get_compliance_service()
        categories = ["废水", "废气", "固废", "噪声", "辐射", "生态"]
        for cat in categories:
            r = await svc.create_check({"title": f"{cat}检查", "category": cat})
            assert r is not None


class TestComplianceBoundary:
    @pytest.mark.asyncio
    async def test_invalid_category(self):
        from api.services.compliance_service import get_compliance_service
        svc = get_compliance_service()
        # 无效分类应被处理（不崩溃）
        try:
            r = await svc.create_check({"title": "非法分类", "category": "INVALID"})
            assert r is not None
        except ValueError:
            pass  # 拒绝非法分类也是合理的

    @pytest.mark.asyncio
    async def test_run_twice(self):
        """重复运行检查"""
        from api.services.compliance_service import get_compliance_service
        svc = get_compliance_service()
        r = await svc.create_check({"title": "重复运行", "category": "废水"})
        r1 = await svc.run_check(r.check_id)
        r2 = await svc.run_check(r.check_id)
        assert r1 is not None and r2 is not None
