"""
L1 单元测试 — 报告生成模块
"""
import pytest
import sys
sys.path.insert(0, '.')


class TestReportGeneration:
    @pytest.mark.asyncio
    async def test_generate_monitor_report(self):
        from api.services.report_service import get_report_service
        svc = get_report_service()
        r = await svc.generate({
            "title": "监测日报",
            "report_type": "监测报告",
            "params": {"city": "长沙市", "aqi": "85", "conclusion": "良好"},
        })
        assert r.status == "generated"
        assert "长沙市" in r.content

    @pytest.mark.asyncio
    async def test_generate_all_types(self):
        from api.services.report_service import get_report_service
        svc = get_report_service()
        types = ["监测日报", "执法周报", "碳排放月报", "环评报告", "年度公报"]
        for rt in types:
            r = await svc.generate({
                "title": rt,
                "report_type": rt,
                "params": {"city": "长沙市", "aqi": "85"},
            })
            assert r.status == "generated"

    @pytest.mark.asyncio
    async def test_empty_params(self):
        from api.services.report_service import get_report_service
        svc = get_report_service()
        r = await svc.generate({"title": "空参数", "report_type": "监测报告", "params": {}})
        assert r.status == "generated"

    @pytest.mark.asyncio
    async def test_report_content_not_empty(self):
        from api.services.report_service import get_report_service
        svc = get_report_service()
        r = await svc.generate({
            "title": "湘潭废水监测",
            "report_type": "监测报告",
            "params": {"city": "湘潭市", "aqi": "120", "conclusion": "轻度污染"},
        })
        assert len(r.content) > 20
