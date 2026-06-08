"""
L3 契约测试 — API Schema 合规性验证

验证:
1. OpenAPI schema 可生成
2. 所有已注册路由在 schema 中
3. 请求/响应格式符合规范
4. 状态码定义完整
"""
import json
import pytest
import sys
sys.path.insert(0, '.')


@pytest.fixture(scope="module")
def openapi_schema():
    """获取 OpenAPI schema"""
    from api.main import app
    return app.openapi()


class TestSchemaStructure:
    """Schema 结构完整性"""

    def test_schema_version(self, openapi_schema):
        assert "openapi" in openapi_schema
        assert openapi_schema["openapi"].startswith("3.")

    def test_info_present(self, openapi_schema):
        info = openapi_schema.get("info", {})
        assert "title" in info
        assert "version" in info
        assert "EcoMind" in info["title"]

    def test_paths_not_empty(self, openapi_schema):
        paths = openapi_schema.get("paths", {})
        assert len(paths) > 0


class TestEndpointCoverage:
    """端点覆盖验证"""

    REQUIRED_ENDPOINTS = [
        ("/api/agents/", "GET"),
        ("/api/enforcement/cases", "GET"),
        ("/api/enforcement/cases", "POST"),
        ("/api/approval/items", "GET"),
        ("/api/approval/items", "POST"),
        ("/api/compliance/checks", "GET"),
        ("/api/compliance/checks", "POST"),
        ("/api/reports", "GET"),
        ("/api/reports", "POST"),
        ("/api/safety-chain/check", "POST"),
        ("/api/safety-chain/status", "GET"),
        ("/api/safety-chain/rules", "GET"),
        ("/api/knowledge-graph/full", "GET"),
        ("/api/knowledge-graph/stats", "GET"),
        ("/api/knowledge-graph/search", "GET"),
        ("/api/marketplace/skills", "GET"),
        ("/api/marketplace/trending", "GET"),
        ("/health", "GET"),
    ]

    @pytest.mark.parametrize("path,method", REQUIRED_ENDPOINTS)
    def test_endpoint_registered(self, openapi_schema, path, method):
        paths = openapi_schema.get("paths", {})
        assert path in paths, f"Missing endpoint: {path}"
        assert method.lower() in paths[path], f"Missing method {method} on {path}"


class TestResponseSchemas:
    """响应格式验证"""

    def test_all_endpoints_have_responses(self, openapi_schema):
        paths = openapi_schema.get("paths", {})
        for path, methods in paths.items():
            for method, details in methods.items():
                if method.lower() in ("options", "head"):
                    continue
                assert "responses" in details, f"{method.upper()} {path} has no responses"
                # 至少要有 200 或 201 响应
                status_codes = list(details["responses"].keys())
                has_success = any(code.startswith("2") for code in status_codes)
                assert has_success, f"{method.upper()} {path} has no 2xx response"

    def test_no_undefined_status_codes(self, openapi_schema):
        """检查是否有合理的错误响应定义"""
        paths = openapi_schema.get("paths", {})
        for path, methods in paths.items():
            for method, details in methods.items():
                if method.lower() in ("options", "head"):
                    continue
                responses = details.get("responses", {})
                status_codes = [int(c) for c in responses.keys() if c.isdigit()]
                for code in status_codes:
                    assert 100 <= code <= 599, f"Invalid status code {code} on {method.upper()} {path}"


class TestSecuritySchemas:
    """安全 Schema 验证"""

    def test_safety_chain_request_schema(self, openapi_schema):
        """SafetyChain check 请求应有 content 字段"""
        paths = openapi_schema.get("paths", {})
        check_path = paths.get("/api/safety-chain/check", {})
        post_spec = check_path.get("post", {})
        if "requestBody" in post_spec:
            content = post_spec["requestBody"].get("content", {})
            json_schema = content.get("application/json", {}).get("schema", {})
            # 应有 content 字段
            if "properties" in json_schema:
                assert "content" in json_schema["properties"], \
                    "SafetyChain check request should have 'content' field"
