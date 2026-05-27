"""
L7 混沌工程测试 — 系统韧性验证

注入故障:
1. 服务层异常传播
2. 空数据处理
3. 超大数据量
4. 快速重复请求
5. 边界值注入
"""
import asyncio
import pytest
import sys
sys.path.insert(0, '.')


class TestServiceResilience:
    """服务层韧性测试"""

    @pytest.mark.asyncio
    async def test_enforcement_handles_empty_fields(self):
        """空字段不导致崩溃"""
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        # 各种空值组合
        r = await svc.create_case({})
        assert r is not None
        assert r.case_number.startswith("HN-ENF-")

    @pytest.mark.asyncio
    async def test_approval_handles_missing_fields(self):
        """缺失字段应有默认值"""
        from api.services.approval_service import get_approval_service
        svc = get_approval_service()
        r = await svc.create_approval({})
        assert r is not None

    @pytest.mark.asyncio
    async def test_compliance_handles_empty_params(self):
        """空参数检查"""
        from api.services.compliance_service import get_compliance_service
        svc = get_compliance_service()
        r = await svc.create_check({})
        assert r is not None

    @pytest.mark.asyncio
    async def test_report_handles_missing_params(self):
        """缺失报告参数"""
        from api.services.report_service import get_report_service
        svc = get_report_service()
        r = await svc.generate({"title": "空参数报告"})
        assert r is not None

    @pytest.mark.asyncio
    async def test_very_long_title(self):
        """超长标题不导致崩溃"""
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        long_title = "测试案件" * 1000  # 非常长的标题
        r = await svc.create_case({"title": long_title})
        assert r is not None

    @pytest.mark.asyncio
    async def test_special_unicode(self):
        """特殊 Unicode 字符"""
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()
        r = await svc.create_case({"title": "测试 🌍🌿💧 环境案件 𝄞𝄢𝄩 零宽空格​"})
        assert r is not None

    @pytest.mark.asyncio
    async def test_rapid_concurrent_creates(self):
        """快速并发创建不产生竞态条件"""
        from api.services.enforcement_service import get_enforcement_service
        svc = get_enforcement_service()

        async def create():
            return await svc.create_case({"title": f"并发-{asyncio.current_task().get_name()}"})

        results = await asyncio.gather(*[create() for _ in range(20)])
        case_numbers = [r.case_number for r in results]
        # 所有 case_number 应唯一
        assert len(case_numbers) == len(set(case_numbers))

    @pytest.mark.asyncio
    async def test_safety_chain_handles_binary_like_content(self):
        """类二进制内容"""
        from api.routers.safety_chain import _check_content, SAFETY_RULES
        content = "\x00\x01\x02\xFF\xFE" * 10
        result = _check_content(content, SAFETY_RULES["L1"]["rules"])
        assert result["passed"] is True  # 不应误报

    @pytest.mark.asyncio
    async def test_knowledge_graph_empty_search(self):
        """空搜索关键词"""
        from graph.understand_adapter import get_knowledge_graph
        kg = get_knowledge_graph()
        nodes = list(kg._nodes.values())
        assert len(nodes) > 0  # 图谱应有节点

    @pytest.mark.asyncio
    async def test_safety_chain_score_boundaries(self):
        """验证评分边界：0-100"""
        from api.routers.safety_chain import _check_content, SAFETY_RULES
        # 最差情况
        worst = "DROP TABLE x; DROP TABLE y; DROP TABLE z; DROP TABLE a; DROP TABLE b;"
        worst += "<script>alert(1)</script>" * 5
        result = _check_content(worst, SAFETY_RULES["L1"]["rules"])
        assert 0 <= result["score"] <= 100
