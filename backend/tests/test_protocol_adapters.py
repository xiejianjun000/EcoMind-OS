"""
ECO-Audit V3.0 协议适配器单元测试

测试覆盖:
  - AdapterRegistry 注册中心 (4 tests)
  - ProtocolAdapter 抽象基类 (3 tests)
  - 国内品牌适配器 10 个 × 5 tests = 50 tests
  - 国际品牌适配器 5 个 × 5 tests = 25 tests
  - BRANDS.md 品牌清单文件 (2 tests)

总计: 84 个测试用例

运行方式:
    cd backend
    python -m pytest tests/test_protocol_adapters.py -v
"""

import inspect
import os
import sys

import pytest

# ============================================================================
# 测试数据定义
# ============================================================================

# 国内品牌 (10个)
DOMESTIC_BRANDS = [
    {
        "module": "protocol_adapters.polycontrol",
        "class": "PolyControlAdapter",
        "brand_name": "力控",
    },
    {
        "module": "protocol_adapters.fpi",
        "class": "FPIAdapter",
        "brand_name": "聚光科技",
    },
    {
        "module": "protocol_adapters.sdl",
        "class": "SDLAdapter",
        "brand_name": "雪迪龙",
    },
    {
        "module": "protocol_adapters.zhongke_tianrong",
        "class": "ZhongkeTianrongAdapter",
        "brand_name": "中科天融",
    },
    {
        "module": "protocol_adapters.landun",
        "class": "LandunAdapter",
        "brand_name": "蓝盾光电",
    },
    {
        "module": "protocol_adapters.sailhero",
        "class": "SailheroAdapter",
        "brand_name": "先河环保",
    },
    {
        "module": "protocol_adapters.yuxing",
        "class": "YuxingAdapter",
        "brand_name": "宇星科技",
    },
    {
        "module": "protocol_adapters.wanyi",
        "class": "WanyiAdapter",
        "brand_name": "皖仪科技",
    },
    {
        "module": "protocol_adapters.zhongxing",
        "class": "ZhongxingAdapter",
        "brand_name": "中兴仪器",
    },
    {
        "module": "protocol_adapters.zhongrui",
        "class": "ZhongruiAdapter",
        "brand_name": "青岛众瑞",
    },
]

# 国际品牌 (5个)
INTERNATIONAL_BRANDS = [
    {
        "module": "protocol_adapters.thermo_fisher",
        "class": "ThermoFisherAdapter",
        "brand_name": "Thermo Fisher",
    },
    {
        "module": "protocol_adapters.siemens",
        "class": "SiemensAdapter",
        "brand_name": "Siemens",
    },
    {
        "module": "protocol_adapters.abb",
        "class": "ABBAdapter",
        "brand_name": "ABB",
    },
    {
        "module": "protocol_adapters.horiba",
        "class": "HoribaAdapter",
        "brand_name": "Horiba",
    },
    {
        "module": "protocol_adapters.emerson",
        "class": "EmersonAdapter",
        "brand_name": "Emerson",
    },
]

ALL_BRANDS = DOMESTIC_BRANDS + INTERNATIONAL_BRANDS

# 必须实现的抽象方法 (6个)
ABSTRACT_METHODS = [
    "connect",
    "read_parameters",
    "read_internal_data",
    "read_status",
    "read_logs",
    "disconnect",
]

# 核心方法 (9个: 6个抽象 + 3个审计默认方法)
CORE_METHODS = ABSTRACT_METHODS + [
    "read_firmware_hash",
    "check_hidden_menu",
    "check_data_hold",
]

# 注册中心
# ============================================================================


class TestAdapterRegistry:
    """注册中心 (AdapterRegistry) 测试"""

    def test_auto_discover(self):
        """自动发现所有品牌适配器"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        count = registry.auto_discover()

        assert count == 15, f"应发现 15 个品牌，实际发现 {count}"

    def test_get_adapter(self):
        """按品牌名称获取适配器类"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        # 测试国内品牌
        for brand in DOMESTIC_BRANDS:
            cls = registry.get_adapter_class(brand["brand_name"])
            assert cls is not None, f"未找到品牌 '{brand['brand_name']}' 的适配器"
            assert cls.brand_name == brand["brand_name"]

        # 测试国际品牌
        for brand in INTERNATIONAL_BRANDS:
            cls = registry.get_adapter_class(brand["brand_name"])
            assert cls is not None, f"未找到品牌 '{brand['brand_name']}' 的适配器"
            assert cls.brand_name == brand["brand_name"]

        # 测试不存在的品牌
        assert registry.get_adapter_class("不存在的品牌") is None

    def test_list_brands(self):
        """列出所有已注册的品牌"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        brands = registry.list_brands()
        assert isinstance(brands, list)
        assert len(brands) == 15

        # 验证所有品牌都在列表中
        expected_brands = {b["brand_name"] for b in ALL_BRANDS}
        assert set(brands) == expected_brands

    def test_brand_count(self):
        """品牌数量验证"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        assert registry.brand_count == 0  # 未初始化时为 0

        registry.auto_discover()
        assert registry.brand_count == 15


class TestProtocolAdapter:
    """基类 (ProtocolAdapter) 测试"""

    def test_abstract_methods(self):
        """验证 6 个抽象方法必须在子类中实现"""
        from protocol_adapters.registry import ProtocolAdapter

        abstract_names = set()
        for name, method in inspect.getmembers(ProtocolAdapter):
            if getattr(method, "__isabstractmethod__", False):
                abstract_names.add(name)

        assert "connect" in abstract_names, "connect 应为抽象方法"
        assert "read_parameters" in abstract_names, "read_parameters 应为抽象方法"
        assert "read_internal_data" in abstract_names, "read_internal_data 应为抽象方法"
        assert "read_status" in abstract_names, "read_status 应为抽象方法"
        assert "read_logs" in abstract_names, "read_logs 应为抽象方法"
        assert "disconnect" in abstract_names, "disconnect 应为抽象方法"

        assert len(abstract_names) == 6, f"应有 6 个抽象方法，实际 {len(abstract_names)}"

    def test_default_methods(self):
        """验证 3 个审计方法有默认实现"""
        from protocol_adapters.registry import ProtocolAdapter

        # 验证默认方法不是抽象的
        for method_name in ["read_firmware_hash", "check_hidden_menu", "check_data_hold"]:
            method = getattr(ProtocolAdapter, method_name, None)
            assert method is not None, f"ProtocolAdapter 应有 {method_name} 方法"
            assert not getattr(method, "__isabstractmethod__", False), \
                f"{method_name} 不应是抽象方法，应有默认实现"

    def test_brand_name_required(self):
        """验证 brand_name 属性必须正确设置"""
        from protocol_adapters.registry import ProtocolAdapter, AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        for brand in ALL_BRANDS:
            adapter_class = registry.get_adapter_class(brand["brand_name"])
            assert adapter_class is not None, f"未找到 '{brand['brand_name']}'"
            assert adapter_class.brand_name, \
                f"品牌 '{brand['brand_name']}' 的 brand_name 不应为空"
            assert adapter_class.brand_name == brand["brand_name"], \
                f"brand_name 应为 '{brand['brand_name']}'，实际为 '{adapter_class.brand_name}'"


# 品牌适配器测试
# ============================================================================

def _get_adapter_class(module_path: str, class_name: str):
    """动态导入并返回适配器类"""
    module = __import__(module_path, fromlist=[class_name])
    return getattr(module, class_name)


class TestDomesticBrands:
    """国内品牌适配器测试 (10个品牌 × 5 = 50 tests)"""

    @pytest.mark.parametrize("brand", DOMESTIC_BRANDS, ids=[b["brand_name"] for b in DOMESTIC_BRANDS])
    def test_domestic_import(self, brand):
        """验证可正常导入"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert cls is not None
        assert inspect.isclass(cls)

    @pytest.mark.parametrize("brand", DOMESTIC_BRANDS, ids=[b["brand_name"] for b in DOMESTIC_BRANDS])
    def test_domestic_has_all_methods(self, brand):
        """验证 9 个核心方法都存在"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        for method_name in CORE_METHODS:
            assert hasattr(cls, method_name), \
                f"{brand['brand_name']} ({brand['class']}) 缺少方法: {method_name}"
            assert callable(getattr(cls, method_name)), \
                f"{brand['brand_name']} 的 {method_name} 不可调用"

    @pytest.mark.parametrize("brand", DOMESTIC_BRANDS, ids=[b["brand_name"] for b in DOMESTIC_BRANDS])
    def test_domestic_brand_name(self, brand):
        """验证 brand_name 正确设置"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert cls.brand_name == brand["brand_name"], \
            f"brand_name 应为 '{brand['brand_name']}'，实际为 '{cls.brand_name}'"

    @pytest.mark.parametrize("brand", DOMESTIC_BRANDS, ids=[b["brand_name"] for b in DOMESTIC_BRANDS])
    def test_domestic_supported_models(self, brand):
        """验证 supported_models 非空"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert hasattr(cls, "supported_models")
        assert isinstance(cls.supported_models, list)
        assert len(cls.supported_models) > 0, \
            f"{brand['brand_name']} 的 supported_models 不应为空"

    @pytest.mark.parametrize("brand", DOMESTIC_BRANDS, ids=[b["brand_name"] for b in DOMESTIC_BRANDS])
    def test_domestic_connection_types(self, brand):
        """验证 connection_types 非空"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert hasattr(cls, "connection_types")
        assert isinstance(cls.connection_types, list)
        assert len(cls.connection_types) > 0, \
            f"{brand['brand_name']} 的 connection_types 不应为空"


class TestInternationalBrands:
    """国际品牌适配器测试 (5个品牌 × 5 = 25 tests)"""

    @pytest.mark.parametrize("brand", INTERNATIONAL_BRANDS, ids=[b["brand_name"] for b in INTERNATIONAL_BRANDS])
    def test_international_import(self, brand):
        """验证可正常导入"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert cls is not None
        assert inspect.isclass(cls)

    @pytest.mark.parametrize("brand", INTERNATIONAL_BRANDS, ids=[b["brand_name"] for b in INTERNATIONAL_BRANDS])
    def test_international_has_all_methods(self, brand):
        """验证 9 个核心方法都存在"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        for method_name in CORE_METHODS:
            assert hasattr(cls, method_name), \
                f"{brand['brand_name']} ({brand['class']}) 缺少方法: {method_name}"
            assert callable(getattr(cls, method_name)), \
                f"{brand['brand_name']} 的 {method_name} 不可调用"

    @pytest.mark.parametrize("brand", INTERNATIONAL_BRANDS, ids=[b["brand_name"] for b in INTERNATIONAL_BRANDS])
    def test_international_brand_name(self, brand):
        """验证 brand_name 正确设置"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert cls.brand_name == brand["brand_name"], \
            f"brand_name 应为 '{brand['brand_name']}'，实际为 '{cls.brand_name}'"

    @pytest.mark.parametrize("brand", INTERNATIONAL_BRANDS, ids=[b["brand_name"] for b in INTERNATIONAL_BRANDS])
    def test_international_supported_models(self, brand):
        """验证 supported_models 非空"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert hasattr(cls, "supported_models")
        assert isinstance(cls.supported_models, list)
        assert len(cls.supported_models) > 0, \
            f"{brand['brand_name']} 的 supported_models 不应为空"

    @pytest.mark.parametrize("brand", INTERNATIONAL_BRANDS, ids=[b["brand_name"] for b in INTERNATIONAL_BRANDS])
    def test_international_connection_types(self, brand):
        """验证 connection_types 非空"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert hasattr(cls, "connection_types")
        assert isinstance(cls.connection_types, list)
        assert len(cls.connection_types) > 0, \
            f"{brand['brand_name']} 的 connection_types 不应为空"


# 品牌清单文件测试
# ============================================================================

class TestBrandsFile:
    """BRANDS.md 品牌清单文件测试"""

    @pytest.fixture
    def brands_md_path(self):
        """获取 BRANDS.md 文件路径"""
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, "protocol_adapters", "BRANDS.md")

    def test_brands_md_exists(self, brands_md_path):
        """验证 BRANDS.md 文件存在"""
        assert os.path.isfile(brands_md_path), f"BRANDS.md 不存在: {brands_md_path}"

    def test_brands_md_format(self, brands_md_path):
        """验证 BRANDS.md 格式正确，15 个品牌均有记录"""
        with open(brands_md_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 验证所有品牌的适配器文件名都在文档中
        adapter_files = [
            "polycontrol.py", "fpi.py", "sdl.py", "zhongke_tianrong.py",
            "landun.py", "sailhero.py", "yuxing.py", "wanyi.py",
            "zhongxing.py", "zhongrui.py",
            "thermo_fisher.py", "siemens.py", "abb.py", "horiba.py",
            "emerson.py",
        ]

        for adapter_file in adapter_files:
            assert adapter_file in content, \
                f"BRANDS.md 中缺少品牌记录: {adapter_file}"

        # 验证所有品牌名称都在文档中
        for brand in ALL_BRANDS:
            assert brand["brand_name"] in content, \
                f"BRANDS.md 中缺少品牌: {brand['brand_name']}"

        # 验证文档包含国内和国际品牌分区
        assert "国内品牌" in content, "BRANDS.md 应包含'国内品牌'分区"
        assert "国际品牌" in content, "BRANDS.md 应包含'国际品牌'分区"

        # 验证文档包含版本信息
        assert "V3.0" in content, "BRANDS.md 应标注版本 V3.0"


# ============================================================================
# 额外测试: 适配器实例创建
# ============================================================================

class TestAdapterInstantiation:
    """适配器实例化测试"""

    @pytest.mark.parametrize("brand", ALL_BRANDS, ids=[b["brand_name"] for b in ALL_BRANDS])
    def test_adapter_can_instantiate(self, brand):
        """验证所有适配器类可以实例化"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        # 不带参数实例化（使用默认值）
        instance = cls()
        assert instance is not None
        assert instance.brand_name == brand["brand_name"]
        assert instance.is_connected is False  # 初始状态未连接

    @pytest.mark.parametrize("brand", ALL_BRANDS, ids=[b["brand_name"] for b in ALL_BRANDS])
    def test_adapter_host_init(self, brand):
        """验证带 host 参数实例化"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        instance = cls(host="192.168.1.100", port=8080)
        assert instance.host == "192.168.1.100"
        assert instance.port == 8080


# ============================================================================
# 额外测试: 注册中心高级功能
# ============================================================================

class TestRegistryAdvanced:
    """注册中心高级功能测试"""

    def test_create_adapter(self):
        """通过注册中心创建适配器实例"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        # 测试创建国内品牌
        adapter = registry.create_adapter("聚光科技", host="10.0.0.1")
        assert adapter is not None
        assert adapter.brand_name == "聚光科技"
        assert adapter.host == "10.0.0.1"

        # 测试创建国际品牌
        adapter = registry.create_adapter("Siemens", host="10.0.0.2")
        assert adapter is not None
        assert adapter.brand_name == "Siemens"

    def test_create_adapter_unknown_brand(self):
        """创建未知品牌适配器应抛出 KeyError"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        with pytest.raises(KeyError):
            registry.create_adapter("不存在的品牌")

    def test_register_custom_adapter(self):
        """手动注册自定义适配器"""
        from protocol_adapters.registry import (
            AdapterRegistry, ProtocolAdapter, ConnectionType,
        )

        class CustomAdapter(ProtocolAdapter):
            brand_name = "自定义品牌"
            supported_models = ["CUSTOM-001"]
            connection_types = [ConnectionType.ETHERNET]
            default_port = 9999

            async def connect(self):
                return True

            async def read_parameters(self):
                return {}

            async def read_internal_data(self):
                return {}

            async def read_status(self):
                return {}

            async def read_logs(self):
                return []

            async def disconnect(self):
                pass

        registry = AdapterRegistry()
        registry.register(CustomAdapter)
        assert registry.brand_count == 1

        adapter = registry.create_adapter("自定义品牌")
        assert adapter.brand_name == "自定义品牌"
        assert adapter.default_port == 9999

    def test_unregister_adapter(self):
        """取消注册适配器"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        initial_count = registry.brand_count
        assert initial_count == 15

        registry.unregister("ABB")
        assert registry.brand_count == initial_count - 1
        assert registry.get_adapter_class("ABB") is None

    def test_brand_alias(self):
        """品牌别名功能"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        registry.set_brand_alias("FPI", "聚光科技")
        cls = registry.get_adapter_class("FPI")
        assert cls is not None
        assert cls.brand_name == "聚光科技"

    def test_model_index(self):
        """通过型号获取适配器"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        # 通过型号查找
        cls = registry.get_adapter_by_model("EL3020")
        assert cls is not None
        assert cls.brand_name == "ABB"

        # 不存在的型号
        assert registry.get_adapter_by_model("NONEXISTENT") is None

    def test_adapter_metadata(self):
        """适配器 metadata 属性"""
        from protocol_adapters.registry import AdapterRegistry

        registry = AdapterRegistry()
        registry.auto_discover()

        for brand in ALL_BRANDS:
            info = registry.get_brand_info(brand["brand_name"])
            assert info is not None, f"获取品牌信息失败: {brand['brand_name']}"
            assert info.brand_name == brand["brand_name"]
            assert len(info.supported_models) > 0
            assert len(info.connection_types) > 0

        # 不存在的品牌
        assert registry.get_brand_info("不存在的品牌") is None


# ============================================================================
# 额外测试: 适配器继承关系
# ============================================================================

class TestInheritance:
    """适配器继承关系测试"""

    @pytest.mark.parametrize("brand", ALL_BRANDS, ids=[b["brand_name"] for b in ALL_BRANDS])
    def test_adapter_inherits_protocol_adapter(self, brand):
        """验证所有适配器继承自 ProtocolAdapter"""
        from protocol_adapters.registry import ProtocolAdapter

        cls = _get_adapter_class(brand["module"], brand["class"])
        assert issubclass(cls, ProtocolAdapter), \
            f"{brand['class']} 必须继承 ProtocolAdapter"

    @pytest.mark.parametrize("brand", ALL_BRANDS, ids=[b["brand_name"] for b in ALL_BRANDS])
    def test_adapter_not_abstract(self, brand):
        """验证所有适配器类不是抽象类（所有抽象方法已实现）"""
        from protocol_adapters.registry import ProtocolAdapter

        cls = _get_adapter_class(brand["module"], brand["class"])

        # 尝试实例化，如果还有未实现的抽象方法会抛 TypeError
        instance = cls()
        assert isinstance(instance, ProtocolAdapter)

    @pytest.mark.parametrize("brand", ALL_BRANDS, ids=[b["brand_name"] for b in ALL_BRANDS])
    def test_adapter_has_default_port(self, brand):
        """验证所有适配器设置了 default_port"""
        cls = _get_adapter_class(brand["module"], brand["class"])
        assert cls.default_port > 0, \
            f"{brand['brand_name']} 的 default_port 应 > 0"


# ============================================================================
# 额外测试: 异常类
# ============================================================================

class TestExceptions:
    """异常类测试"""

    def test_exception_hierarchy(self):
        """验证异常类继承关系"""
        from protocol_adapters.registry import (
            ProtocolAdapterError, ConnectionError,
            ReadTimeoutError, UnsupportedModelError,
            AuthenticationError,
        )

        assert issubclass(ConnectionError, ProtocolAdapterError)
        assert issubclass(ReadTimeoutError, ProtocolAdapterError)
        assert issubclass(UnsupportedModelError, ProtocolAdapterError)
        assert issubclass(AuthenticationError, ProtocolAdapterError)

    def test_exception_instantiation(self):
        """验证异常类可正常实例化"""
        from protocol_adapters.registry import (
            ProtocolAdapterError, ConnectionError,
            ReadTimeoutError, UnsupportedModelError,
            AuthenticationError,
        )

        ProtocolAdapterError("test")
        ConnectionError("connection failed")
        ReadTimeoutError("read timeout")
        UnsupportedModelError("unsupported model")
        AuthenticationError("auth failed")


# ============================================================================
# 额外测试: 数据模型
# ============================================================================

class TestDataModels:
    """数据模型测试"""

    def test_device_info(self):
        """DeviceInfo 数据模型"""
        from protocol_adapters.registry import DeviceInfo

        info = DeviceInfo(brand="test", model="model-1", serial_number="SN001")
        assert info.brand == "test"
        assert info.model == "model-1"
        assert info.serial_number == "SN001"

    def test_connection_config(self):
        """ConnectionConfig 数据模型"""
        from protocol_adapters.registry import ConnectionConfig, ConnectionType

        config = ConnectionConfig(host="10.0.0.1", port=8080)
        assert config.host == "10.0.0.1"
        assert config.port == 8080
        assert config.timeout == 5.0
        assert config.connection_type == ConnectionType.ETHERNET

    def test_adapter_metadata_model(self):
        """AdapterMetadata 数据模型"""
        from protocol_adapters.registry import AdapterMetadata, ConnectionType

        meta = AdapterMetadata(
            brand_name="test",
            supported_models=["M1", "M2"],
            connection_types=[ConnectionType.ETHERNET],
            default_port=8080,
        )
        assert meta.brand_name == "test"
        assert len(meta.supported_models) == 2
        assert len(meta.connection_types) == 1
