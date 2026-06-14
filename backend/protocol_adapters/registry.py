"""
ECO-Audit V3.0 协议适配器注册中心

提供:
  - ProtocolAdapter 抽象基类: 所有品牌适配器的统一接口
  - AdapterRegistry 注册中心: 自动发现、品牌检测、协议路由、连接池管理

设计理念:
  每个品牌分析仪/数采仪有其独特的通信协议（HJ 212、Modbus、
  私有TCP/串口协议等）。ProtocolAdapter 定义统一的数据读取接口，
  各品牌子类负责将底层协议映射为标准数据模型。

  AdapterRegistry 维护所有已注册的适配器类，支持按品牌名称、
  设备型号或自动探测方式选择合适的适配器。
"""

from __future__ import annotations

import asyncio
import importlib
import inspect
import logging
import pkgutil
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar, Optional

logger = logging.getLogger(__name__)


# ============================================================================
# 连接方式枚举
# ============================================================================

class ConnectionType:
    """设备连接方式"""
    SERIAL = "serial"
    ETHERNET = "ethernet"
    MODBUS_TCP = "modbus_tcp"
    MODBUS_RTU = "modbus_rtu"
    OPC_UA = "opc_ua"
    CUSTOM_TCP = "custom_tcp"


# ============================================================================
# 设备状态枚举
# ============================================================================

class DeviceStatus:
    """设备运行状态"""
    NORMAL = "normal"          # 正常运行
    CALIBRATING = "calibrating" # 校准中
    MAINTENANCE = "maintenance" # 维护中
    FAULT = "fault"            # 故障
    OFFLINE = "offline"        # 离线
    UNKNOWN = "unknown"        # 未知状态


# ============================================================================
# 异常类
# ============================================================================

class ProtocolAdapterError(Exception):
    """协议适配器通用异常"""
    pass


class ConnectionError(ProtocolAdapterError):
    """连接异常"""
    pass


class ReadTimeoutError(ProtocolAdapterError):
    """读取超时异常"""
    pass


class UnsupportedModelError(ProtocolAdapterError):
    """不支持的设备型号"""
    pass


class AuthenticationError(ProtocolAdapterError):
    """认证/授权失败"""
    pass


# ============================================================================
# 数据模型
# ============================================================================

@dataclass
class DeviceInfo:
    """设备基本信息"""
    brand: str = ""
    model: str = ""
    serial_number: str = ""
    firmware_version: str = ""
    hardware_version: str = ""
    ccep_cert: str = ""  # CCEP认证编号


@dataclass
class ConnectionConfig:
    """连接配置"""
    host: Optional[str] = None
    port: int = 0
    serial_port: Optional[str] = None
    baud_rate: int = 9600
    parity: str = "N"
    data_bits: int = 8
    stop_bits: int = 1
    timeout: float = 5.0
    connection_type: str = ConnectionType.ETHERNET


@dataclass
class AdapterMetadata:
    """适配器元数据"""
    brand_name: str = ""
    supported_models: list[str] = field(default_factory=list)
    connection_types: list[str] = field(default_factory=list)
    default_port: int = 0
    version: str = "1.0.0"
    author: str = "ECO-Audit Team"
    description: str = ""


# ============================================================================
# ProtocolAdapter 抽象基类
# ============================================================================

class ProtocolAdapter(ABC):
    """
    分析仪/数采仪协议适配器基类。

    所有品牌适配器必须继承此类并实现所有抽象方法。
    适配器负责将设备特有的通信协议映射为统一的标准接口。

    支持的连接方式:
      - serial:  串口通信 (RS-232/RS-485)，使用 pyserial-asyncio
      - ethernet: 以太网 TCP/UDP 连接
      - modbus_tcp: Modbus TCP 协议，使用 pymodbus
      - modbus_rtu: Modbus RTU over 串口
      - opc_ua: OPC-UA 协议
      - custom_tcp: 品牌特有的 TCP 协议

    子类必须设置的类属性:
      - brand_name: 品牌中文名称
      - supported_models: 支持的设备型号列表
      - connection_types: 支持的连接方式列表
      - default_port: 默认端口号（以太网连接时）

    典型用法:
        adapter = BrandAdapter(host="192.168.1.100", port=8502)
        await adapter.connect()
        params = await adapter.read_parameters()
        data = await adapter.read_internal_data()
        status = await adapter.read_status()
        logs = await adapter.read_logs()
        await adapter.disconnect()
    """

    # ========== 子类必须覆盖的类属性 ==========
    brand_name: ClassVar[str] = ""
    supported_models: ClassVar[list[str]] = []
    connection_types: ClassVar[list[str]] = []
    default_port: ClassVar[int] = 0

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        serial_port: Optional[str] = None,
        baud_rate: int = 9600,
        timeout: float = 5.0,
        connection_type: str = ConnectionType.ETHERNET,
        **kwargs: Any,
    ):
        """
        初始化适配器。

        Args:
            host: 设备 IP 地址或主机名（以太网连接时）
            port: 设备端口号（以太网连接时，默认使用 default_port）
            serial_port: 串口设备路径，如 "/dev/ttyUSB0"（串口连接时）
            baud_rate: 串口波特率，默认 9600
            timeout: 通信超时时间（秒），默认 5.0
            connection_type: 连接方式，默认 ethernet
            **kwargs: 品牌特有的扩展参数
        """
        self.host = host
        self.port = port or self.default_port
        self.serial_port = serial_port
        self.baud_rate = baud_rate
        self.timeout = timeout
        self.connection_type = connection_type
        self._connected = False
        self._connection = None
        self._device_info: Optional[DeviceInfo] = None
        self._extra_config = kwargs

    @property
    def is_connected(self) -> bool:
        """连接状态"""
        return self._connected

    @property
    def device_info(self) -> Optional[DeviceInfo]:
        """设备基本信息"""
        return self._device_info

    @property
    def metadata(self) -> AdapterMetadata:
        """适配器元数据"""
        return AdapterMetadata(
            brand_name=self.brand_name,
            supported_models=list(self.supported_models),
            connection_types=list(self.connection_types),
            default_port=self.default_port,
            description=self.__class__.__doc__ or "",
        )

    async def _ensure_connected(self) -> None:
        """确保已连接，否则抛出异常"""
        if not self._connected:
            raise ConnectionError(
                f"设备未连接: {self.brand_name} at {self.host or self.serial_port}"
            )

    async def _read_with_retry(
        self, read_func, max_retries: int = 3, delay: float = 1.0
    ) -> Any:
        """
        带重试的读取操作。

        Args:
            read_func: 异步读取函数
            max_retries: 最大重试次数
            delay: 重试间隔（秒）

        Returns:
            读取结果

        Raises:
            ReadTimeoutError: 超过最大重试次数仍失败
        """
        last_error = None
        for attempt in range(max_retries):
            try:
                return await read_func
            except (ConnectionError, ReadTimeoutError) as e:
                last_error = e
                if attempt < max_retries - 1:
                    logger.warning(
                        "读取失败 (尝试 %d/%d): %s，等待 %.1fs 后重试",
                        attempt + 1, max_retries, e, delay
                    )
                    await asyncio.sleep(delay)
        raise ReadTimeoutError(
            f"读取失败，已重试 {max_retries} 次: {last_error}"
        )

    # ========== 必须实现的抽象方法 ==========

    @abstractmethod
    async def connect(self) -> bool:
        """
        建立与设备的连接。

        根据连接类型（串口/以太网/Modbus TCP）建立物理连接，
        进行握手协议，验证设备型号是否支持。

        Returns:
            bool: 连接是否成功

        Raises:
            ConnectionError: 连接失败
            UnsupportedModelError: 设备型号不在支持列表中
            AuthenticationError: 认证失败（如需登录）
        """
        ...

    @abstractmethod
    async def read_parameters(self) -> dict:
        """
        读取设备参数。

        包括但不限于:
          - 斜率 (slope) 和截距 (intercept) — 用于校准计算
          - 量程 (range) 和零点 (zero)
          - 报警阈值
          - 采样周期
          - 通讯地址/站号

        Returns:
            dict: 参数键值对，如:
                {
                    "slope": 1.023,
                    "intercept": -0.015,
                    "range_max": 100.0,
                    "range_min": 0.0,
                    "alarm_threshold": 80.0,
                    "sampling_interval": 60,
                    ...
                }

        Raises:
            ConnectionError: 未连接或连接断开
            ReadTimeoutError: 读取超时
        """
        ...

    @abstractmethod
    async def read_internal_data(self) -> dict:
        """
        读取内部原始数据（非显示数据）。

        这是 ECO-Audit 审计的核心功能。分析仪内部存储的原始测量值
        可能与对外显示/传输的值不同（R007 双套算法检测）。

        包括但不限于:
          - 原始传感器读数（未经校准公式处理）
          - 校准前的原始电压/电流/光强值
          - 内部存储的历史数据
          - 备用通道数据

        Returns:
            dict: 内部数据键值对，如:
                {
                    "raw_so2": 23.45,       # 原始 SO2 读数
                    "raw_nox": 45.67,       # 原始 NOx 读数
                    "raw_pm25": 12.34,      # 原始 PM2.5 读数
                    "calibration_date": "2026-01-15",
                    "display_so2": 24.01,   # 对外显示的值
                    "discrepancy": 0.56,    # 原始值与显示值的偏差
                    ...
                }

        Raises:
            ConnectionError: 未连接或连接断开
            ReadTimeoutError: 读取超时
        """
        ...

    @abstractmethod
    async def read_status(self) -> dict:
        """
        读取设备运行状态。

        包括但不限于:
          - 运行状态（正常/校准/维护/故障/离线）
          - 各子系统状态（采样系统、分析系统、数据传输）
          - 报警信息
          - 维护倒计时
          - 运行时长

        Returns:
            dict: 状态信息，如:
                {
                    "status": "normal",
                    "sampling_system": "ok",
                    "analysis_system": "ok",
                    "data_transmission": "ok",
                    "alarms": [],
                    "maintenance_due_hours": 120,
                    "uptime_hours": 8760,
                    ...
                }

        Raises:
            ConnectionError: 未连接或连接断开
            ReadTimeoutError: 读取超时
        """
        ...

    @abstractmethod
    async def read_logs(self) -> list[dict]:
        """
        读取操作日志。

        用于 R003（日志完整性深度扫描）审计。
        包括但不限于:
          - 参数修改记录
          - 校准记录
          - 维护记录
          - 开关机记录
          - 故障报警记录
          - 数据标记记录

        Returns:
            list[dict]: 日志条目列表，如:
                [
                    {
                        "timestamp": "2026-05-18T14:30:00",
                        "event_type": "parameter_change",
                        "parameter": "slope",
                        "old_value": 1.0,
                        "new_value": 1.023,
                        "operator": "admin",
                        "source": "local_panel",
                    },
                    ...
                ]

        Raises:
            ConnectionError: 未连接或连接断开
            ReadTimeoutError: 读取超时
        """
        ...

    @abstractmethod
    async def disconnect(self):
        """
        断开与设备的连接，释放资源。

        应确保优雅断开，不会损坏设备或丢失数据。
        """
        ...

    # ========== 可选实现的扩展方法（ECO-Audit 审计专用） ==========

    async def read_firmware_hash(self) -> Optional[str]:
        """
        读取固件哈希值（用于 R011 非法修改程序固件检测）。

        通过读取设备固件二进制数据并计算 SHA-256 哈希，
        与厂家官方固件哈希进行比对，检测固件是否被篡改。

        Returns:
            str | None: 固件 SHA-256 哈希值，若不支持则返回 None

        Raises:
            ConnectionError: 未连接或连接断开
            ReadTimeoutError: 读取超时
        """
        logger.warning(
            "%s 适配器未实现 read_firmware_hash，返回 None",
            self.brand_name
        )
        return None

    async def check_hidden_menu(self) -> list[str]:
        """
        检测隐藏菜单（用于 R001 分析仪/工控机隐藏菜单与后门扫描）。

        尝试访问设备可能存在的隐藏菜单、工程模式、调试接口等。
        不同品牌的隐藏菜单进入方式不同（特定按键组合、秘密命令等）。

        Returns:
            list[str]: 发现的隐藏菜单/后门入口列表，如:
                ["工程模式入口", "调试菜单", "校准参数修改界面"]

        Raises:
            ConnectionError: 未连接或连接断开
            ReadTimeoutError: 读取超时
        """
        logger.warning(
            "%s 适配器未实现 check_hidden_menu，返回空列表",
            self.brand_name
        )
        return []

    async def check_data_hold(self) -> bool:
        """
        检测数据保持功能（用于 R005 数据保持/恒值输出功能审计）。

        检查设备在"维护"或"校准"状态下是否存在数据锁定功能，
        即继续输出上一次有效数据而非实时测量值。

        Returns:
            bool: 是否启用数据保持功能

        Raises:
            ConnectionError: 未连接或连接断开
            ReadTimeoutError: 读取超时
        """
        logger.warning(
            "%s 适配器未实现 check_data_hold，返回 False",
            self.brand_name
        )
        return False

    async def read_dual_channel_data(self) -> Optional[dict]:
        """
        读取双通道数据（用于 R007 双套算法/参数集检测）。

        同时读取"显示通道"和"原始通道"的数据，比对差异。

        Returns:
            dict | None: 双通道数据对比结果，若不支持则返回 None
        """
        logger.warning(
            "%s 适配器未实现 read_dual_channel_data，返回 None",
            self.brand_name
        )
        return None

    async def read_eeprom_params(self) -> Optional[dict]:
        """
        读取 EEPROM 存储的参数（用于 R004 全参数一致性快检）。

        从设备 EEPROM 中读取存储的校准参数，与数采仪配置、
        工控机软件参数进行四方比对。

        Returns:
            dict | None: EEPROM 参数，若不支持则返回 None
        """
        logger.warning(
            "%s 适配器未实现 read_eeprom_params，返回 None",
            self.brand_name
        )
        return None


# ============================================================================
# AdapterRegistry 注册中心
# ============================================================================

class AdapterRegistry:
    """
    协议适配器注册中心。

    功能:
      1. 自动发现: 扫描 protocol_adapters 包下所有模块，注册所有
         ProtocolAdapter 子类
      2. 品牌检测: 根据品牌名称或设备型号自动选择适配器
      3. 协议路由: 根据连接方式和设备特征选择最优适配器
      4. 连接池管理: 维护适配器实例的缓存，避免重复创建

    典型用法:
        registry = AdapterRegistry()
        registry.auto_discover()  # 自动发现所有适配器

        # 按品牌创建
        adapter = registry.create_adapter("聚光科技", host="192.168.1.100")

        # 自动检测（通过连接试探）
        adapter = await registry.auto_detect(host="192.168.1.100")
    """

    def __init__(self):
        self._adapters: dict[str, type[ProtocolAdapter]] = {}
        self._model_index: dict[str, str] = {}  # model -> brand
        self._brand_aliases: dict[str, str] = {}  # alias -> brand
        self._connection_pool: dict[str, ProtocolAdapter] = {}
        self._initialized = False

    def register(self, adapter_class: type[ProtocolAdapter]) -> None:
        """
        注册一个适配器类。

        Args:
            adapter_class: ProtocolAdapter 的子类
        """
        if not inspect.isclass(adapter_class):
            raise TypeError(f"必须是一个类: {adapter_class}")
        if not issubclass(adapter_class, ProtocolAdapter):
            raise TypeError(f"必须是 ProtocolAdapter 的子类: {adapter_class}")
        if adapter_class is ProtocolAdapter:
            return  # 不注册基类本身

        brand = adapter_class.brand_name
        if not brand:
            logger.warning("跳过未设置 brand_name 的适配器: %s", adapter_class.__name__)
            return

        self._adapters[brand] = adapter_class

        # 建立型号索引
        for model in adapter_class.supported_models:
            self._model_index[model] = brand

        logger.info("已注册适配器: %s (%s)", brand, adapter_class.__name__)

    def unregister(self, brand_name: str) -> None:
        """取消注册指定品牌的适配器"""
        if brand_name in self._adapters:
            adapter_class = self._adapters.pop(brand_name)
            for model in adapter_class.supported_models:
                self._model_index.pop(model, None)
            logger.info("已取消注册适配器: %s", brand_name)

    def get_adapter_class(self, brand_name: str) -> Optional[type[ProtocolAdapter]]:
        """
        根据品牌名称获取适配器类。

        Args:
            brand_name: 品牌名称（支持别名）

        Returns:
            适配器类，若未找到则返回 None
        """
        # 直接匹配
        if brand_name in self._adapters:
            return self._adapters[brand_name]
        # 别名匹配
        if brand_name in self._brand_aliases:
            return self._adapters.get(self._brand_aliases[brand_name])
        # 模糊匹配（不区分大小写）
        lower = brand_name.lower()
        for name, cls in self._adapters.items():
            if lower in name.lower() or name.lower() in lower:
                return cls
        return None

    def get_adapter_by_model(self, model: str) -> Optional[type[ProtocolAdapter]]:
        """
        根据设备型号获取适配器类。

        Args:
            model: 设备型号

        Returns:
            适配器类，若未找到则返回 None
        """
        brand = self._model_index.get(model)
        if brand:
            return self._adapters.get(brand)
        return None

    def create_adapter(
        self,
        brand_name: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        serial_port: Optional[str] = None,
        baud_rate: int = 9600,
        timeout: float = 5.0,
        connection_type: str = ConnectionType.ETHERNET,
        **kwargs: Any,
    ) -> ProtocolAdapter:
        """
        创建适配器实例。

        Args:
            brand_name: 品牌名称
            host: 设备 IP
            port: 端口号
            serial_port: 串口路径
            baud_rate: 波特率
            timeout: 超时时间
            connection_type: 连接方式
            **kwargs: 扩展参数

        Returns:
            适配器实例

        Raises:
            KeyError: 未找到对应品牌的适配器
        """
        adapter_class = self.get_adapter_class(brand_name)
        if adapter_class is None:
            available = list(self._adapters.keys())
            raise KeyError(
                f"未找到品牌 '{brand_name}' 的适配器。"
                f"可用品牌: {', '.join(available)}"
            )

        return adapter_class(
            host=host,
            port=port,
            serial_port=serial_port,
            baud_rate=baud_rate,
            timeout=timeout,
            connection_type=connection_type,
            **kwargs,
        )

    def list_brands(self) -> list[str]:
        """返回所有已注册的品牌名称列表"""
        return list(self._adapters.keys())

    def list_models(self) -> list[str]:
        """返回所有支持的设备型号列表"""
        return list(self._model_index.keys())

    def get_brand_info(self, brand_name: str) -> Optional[AdapterMetadata]:
        """获取指定品牌的适配器元数据"""
        adapter_class = self.get_adapter_class(brand_name)
        if adapter_class is None:
            return None
        # 创建临时实例获取元数据
        instance = adapter_class()
        return instance.metadata

    def auto_discover(self, package_name: str = "protocol_adapters") -> int:
        """
        自动发现并注册所有协议适配器。

        扫描指定包下所有模块，找出所有 ProtocolAdapter 的子类并注册。

        Args:
            package_name: 要扫描的包名

        Returns:
            发现的适配器数量
        """
        try:
            package = importlib.import_module(package_name)
            package_path = getattr(package, "__path__", [])

            for _, module_name, is_pkg in pkgutil.iter_modules(package_path):
                if module_name in ("registry", "__init__"):
                    continue
                try:
                    module = importlib.import_module(f".{module_name}", package_name)
                    for name, obj in inspect.getmembers(module, inspect.isclass):
                        if (
                            issubclass(obj, ProtocolAdapter)
                            and obj is not ProtocolAdapter
                            and obj.__module__ == module.__name__
                        ):
                            self.register(obj)
                except ImportError as e:
                    logger.warning("无法加载模块 %s: %s", module_name, e)
        except ImportError as e:
            logger.warning("无法导入包 %s: %s", package_name, e)

        self._initialized = True
        return len(self._adapters)

    def set_brand_alias(self, alias: str, brand_name: str) -> None:
        """
        设置品牌别名。

        Args:
            alias: 别名（如英文名、简称）
            brand_name: 正式品牌名称
        """
        if brand_name not in self._adapters:
            raise KeyError(f"品牌 '{brand_name}' 未注册")
        self._brand_aliases[alias] = brand_name

    async def auto_detect(
        self,
        host: Optional[str] = None,
        serial_port: Optional[str] = None,
        port: Optional[int] = None,
        timeout: float = 3.0,
    ) -> Optional[ProtocolAdapter]:
        """
        自动检测设备品牌并返回对应的适配器。

        通过依次尝试连接各品牌适配器（使用各品牌的默认端口和协议），
        检测哪个品牌能成功握手。

        Args:
            host: 设备 IP
            serial_port: 串口路径
            port: 端口号（可选，各品牌有自己的默认端口）
            timeout: 单次连接超时时间

        Returns:
            成功连接的适配器实例，若所有品牌均无法连接则返回 None
        """
        if not self._adapters:
            self.auto_discover()

        for brand_name, adapter_class in self._adapters.items():
            adapter = adapter_class(
                host=host,
                port=port,
                serial_port=serial_port,
                timeout=timeout,
            )
            try:
                connected = await asyncio.wait_for(adapter.connect(), timeout=timeout)
                if connected:
                    logger.info("自动检测成功: 设备品牌为 %s", brand_name)
                    return adapter
            except (asyncio.TimeoutError, ConnectionError, OSError) as e:
                logger.debug("品牌 %s 连接失败: %s", brand_name, e)
                try:
                    await adapter.disconnect()
                except Exception:
                    pass

        logger.warning("自动检测失败: 无法识别设备品牌 (host=%s)", host)
        return None

    def get_pool_key(self, adapter: ProtocolAdapter) -> str:
        """生成连接池缓存键"""
        return f"{adapter.brand_name}:{adapter.host or adapter.serial_port}:{adapter.port}"

    async def get_or_create(
        self,
        brand_name: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        **kwargs: Any,
    ) -> ProtocolAdapter:
        """
        从连接池获取或创建适配器实例。

        Args:
            brand_name: 品牌名称
            host: 设备 IP
            port: 端口号
            **kwargs: 其他连接参数

        Returns:
            适配器实例
        """
        temp = self.create_adapter(brand_name, host=host, port=port, **kwargs)
        pool_key = self.get_pool_key(temp)

        if pool_key in self._connection_pool:
            cached = self._connection_pool[pool_key]
            if cached.is_connected:
                return cached

        adapter = self.create_adapter(brand_name, host=host, port=port, **kwargs)
        self._connection_pool[self.get_pool_key(adapter)] = adapter
        return adapter

    def close_all(self) -> None:
        """关闭连接池中所有适配器（仅清理缓存，不主动断开）"""
        self._connection_pool.clear()

    @property
    def brand_count(self) -> int:
        """已注册品牌数量"""
        return len(self._adapters)

    @property
    def model_count(self) -> int:
        """支持的设备型号总数"""
        return len(self._model_index)
