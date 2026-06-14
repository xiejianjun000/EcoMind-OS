"""
ECO-Audit V3.0 协议适配库

插件式分析仪/数采仪协议适配器，覆盖≥15个主流品牌。
支持串口(serial)、以太网(ethernet)、Modbus TCP 等多种连接方式。

用法:
    from protocol_adapters.registry import AdapterRegistry

    registry = AdapterRegistry()
    adapter = registry.detect_and_connect(host="192.168.1.100", brand="聚光科技")
    params = await adapter.read_parameters()
    data = await adapter.read_internal_data()
    status = await adapter.read_status()
    await adapter.disconnect()
"""

from .registry import ProtocolAdapter, AdapterRegistry

__version__ = "3.0.0"
__all__ = ["ProtocolAdapter", "AdapterRegistry"]
