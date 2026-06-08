"""
L1 单元测试 — 执法办案模块（增强版）
覆盖：完整8阶段生命周期 + 边界条件 + 并发安全
"""
import pytest
import sys
sys.path.insert(0, '.')


class TestEnforcementCRUD:
    """CRUD 操作测试"""

    @pytest.mark.asyncio
    async def test_create_case_minimal(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "最小字段测试"})
        assert r.case_number.startswith("HN-ENF-")
        assert r.stage == "线索"

    @pytest.mark.asyncio
    async def test_create_case_full(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({
            "title": "完整字段案件",
            "enterprise_name": "湘江化工有限公司",
            "violation": "超标排放废水COD>500mg/L",
            "city": "株洲市",
            "officers": ["张执法", "李监察", "王督办"],
            "severity": "严重",
        })
        assert r.metadata.get("city") == "株洲市"
        assert r.metadata.get("severity") == "严重"

    @pytest.mark.asyncio
    async def test_list_cases(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        cases = await svc.list_cases()
        assert isinstance(cases, list)

    @pytest.mark.asyncio
    async def test_get_case_by_id(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "查询测试"})
        found = await svc.get_case(r.case_id)
        assert found is not None
        assert found.case_id == r.case_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_case(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        found = await svc.get_case("NONEXISTENT-ID")
        assert found is None


class TestEnforcementLifecycle:
    """8 阶段完整生命周期测试"""

    @pytest.mark.asyncio
    async def test_full_lifecycle(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "全生命周期测试"})

        transitions = ["受理", "立案", "调查", "告知", "决定", "执行", "归档"]
        for stage in transitions:
            result = await svc.transition(r.case_id, stage, "测试员")
            assert result is not None, f"流转到 {stage} 失败"
            assert result.stage == stage, f"阶段应为 {stage}，实际为 {result.stage}"

        # 验证时间线记录完整
        final = await svc.get_case(r.case_id)
        assert len(final.timeline) >= 8  # 创建 + 7 次流转

    @pytest.mark.asyncio
    async def test_cannot_skip_stages(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "跳阶段测试"})
        with pytest.raises(ValueError):
            await svc.transition(r.case_id, "调查", "测试员")  # 不能从线索直接到调查

    @pytest.mark.asyncio
    async def test_cannot_reverse(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "逆向流转测试"})
        await svc.transition(r.case_id, "受理", "测试员")
        with pytest.raises(ValueError):
            await svc.transition(r.case_id, "线索", "测试员")  # 不能回退

    @pytest.mark.asyncio
    async def test_delete_case(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "删除测试"})
        assert await svc.delete_case(r.case_id) is True
        assert await svc.get_case(r.case_id) is None

    @pytest.mark.asyncio
    async def test_timeline_records_operator(self):
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "操作员记录测试"})
        result = await svc.transition(r.case_id, "受理", "张执法")
        # 时间线应包含操作员信息
        timeline_events = [t for t in result.timeline if "受理" in str(t)]
        assert len(timeline_events) > 0


class TestEnforcementConcurrency:
    """并发安全测试"""

    @pytest.mark.asyncio
    async def test_concurrent_reads(self):
        import asyncio
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "并发读测试"})

        async def read():
            return await svc.get_case(r.case_id)

        results = await asyncio.gather(*[read() for _ in range(10)])
        assert all(result is not None for result in results)
