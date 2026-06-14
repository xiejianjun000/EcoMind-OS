"""
聚光科技 (FPI / Focus Photonics Instrument) 分析仪协议适配器

聚光科技(杭州)股份有限公司是国内领先的 environmental monitoring 解决方案提供商。
其 CEMS/VOCs 分析仪使用 HJ 212 协议和自定义二进制协议。

支持的型号:
  - CEMS-2000: 烟气排放连续监测系统
  - CEMS-3000: 高精度烟气监测系统
  - Model 3000: 气体分析仪
  - VOCs-3000: 挥发性有机物在线监测系统

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps)
  - ethernet: 自定义 TCP 协议 (默认端口 5020)
  - modbus_tcp: Modbus TCP (默认端口 502)

典型用法:
    adapter = FPIAdapter(host="192.168.1.100", port=5020)
    await adapter.connect()
    params = await adapter.read_parameters()
    await adapter.disconnect()
"""

from __future__ import annotations

import asyncio
import logging
import struct
from typing import Any, Optional

from .registry import (
    ConnectionError,
    ConnectionType,
    DeviceStatus,
    ProtocolAdapter,
    ReadTimeoutError,
)

logger = logging.getLogger(__name__)


class FPIAdapter(ProtocolAdapter):
    """聚光科技 (FPI) 分析仪协议适配器"""

    brand_name = "聚光科技"
    supported_models = [
        "CEMS-2000",
        "CEMS-3000",
        "Model 3000",
        "VOCs-3000",
    ]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 5020

    # 聚光设备 Modbus 寄存器地址映射
    _MODBUS_REGS = {
        "slope_so2": 40001,
        "intercept_so2": 40002,
        "slope_nox": 40003,
        "intercept_nox": 40004,
        "range_so2": 40005,
        "range_nox": 40006,
        "device_status": 40100,
        "raw_so2": 30001,
        "raw_nox": 30002,
        "raw_pm": 30003,
    }

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
        super().__init__(
            host=host, port=port, serial_port=serial_port,
            baud_rate=baud_rate, timeout=timeout,
            connection_type=connection_type, **kwargs
        )
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None

    async def connect(self) -> bool:
        """
        连接聚光科技设备。

        聚光设备使用自定义二进制握手协议:
        1. 发送 SYNC (0x1B 0x1B 0x1B 0x1B)
        2. 接收 ACK (0x06) + 设备型号信息

        Returns:
            bool: 连接是否成功
        """
        try:
            if self.connection_type in (ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP):
                if not self.host:
                    raise ConnectionError("以太网连接需要提供 host 参数")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=self.timeout,
                )
                # 握手
                sync = bytes([0x1B, 0x1B, 0x1B, 0x1B])
                self._writer.write(sync)
                await self._writer.drain()
                ack = await asyncio.wait_for(
                    self._reader.read(64), timeout=self.timeout
                )
                if not ack or ack[0] != 0x06:
                    raise ConnectionError("握手失败: 未收到 ACK")

            elif self.connection_type == ConnectionType.SERIAL:
                try:
                    import serial_asyncio
                    self._reader, self._writer = await serial_asyncio.open_serial_connection(
                        url=self.serial_port, baudrate=self.baud_rate
                    )
                except ImportError:
                    raise ConnectionError("需要安装 pyserial-asyncio")
                except Exception as e:
                    raise ConnectionError(f"串口打开失败: {e}")

            self._connected = True
            logger.info("聚光科技设备连接成功: %s:%d", self.host or self.serial_port, self.port)
            return True

        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except OSError as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _read_register(self, reg_addr: int) -> float:
        """读取单个寄存器值"""
        if self.connection_type == ConnectionType.MODBUS_TCP:
            try:
                from pymodbus.client import AsyncModbusTcpClient
                client = AsyncModbusTcpClient(self.host, port=self.port)
                await client.connect()
                result = await client.read_holding_registers(reg_addr - 40001, 2, slave=1)
                value = struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0]
                client.close()
                return value
            except ImportError:
                raise ConnectionError("Modbus 通信需要安装 pymodbus")
        else:
            # 自定义协议读取
            cmd = struct.pack(">BBH", 0x01, 0x03, reg_addr)
            self._writer.write(cmd)
            await self._writer.drain()
            resp = await asyncio.wait_for(self._reader.read(8), timeout=self.timeout)
            if len(resp) >= 8:
                return struct.unpack(">f", resp[4:8])[0]
            raise ReadTimeoutError("寄存器读取响应不完整")

    async def read_parameters(self) -> dict:
        """
        读取聚光设备参数。

        获取斜率、截距、量程等校准参数。

        Returns:
            dict: 校准参数
        """
        await self._ensure_connected()
        try:
            slope_so2 = await self._read_register(self._MODBUS_REGS["slope_so2"])
            intercept_so2 = await self._read_register(self._MODBUS_REGS["intercept_so2"])
            slope_nox = await self._read_register(self._MODBUS_REGS["slope_nox"])
            intercept_nox = await self._read_register(self._MODBUS_REGS["intercept_nox"])
            range_so2 = await self._read_register(self._MODBUS_REGS["range_so2"])
            range_nox = await self._read_register(self._MODBUS_REGS["range_nox"])

            return {
                "slope_so2": round(slope_so2, 4),
                "intercept_so2": round(intercept_so2, 4),
                "slope_nox": round(slope_nox, 4),
                "intercept_nox": round(intercept_nox, 4),
                "range_so2": round(range_so2, 2),
                "range_nox": round(range_nox, 2),
                "alarm_threshold_so2": round(range_so2 * 0.8, 2),
                "alarm_threshold_nox": round(range_nox * 0.8, 2),
                "sampling_interval": 60,
                "brand": self.brand_name,
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """
        读取聚光设备内部原始数据。

        Returns:
            dict: 原始传感器数据
        """
        await self._ensure_connected()
        try:
            raw_so2 = await self._read_register(self._MODBUS_REGS["raw_so2"])
            raw_nox = await self._read_register(self._MODBUS_REGS["raw_nox"])
            raw_pm = await self._read_register(self._MODBUS_REGS["raw_pm"])

            return {
                "raw_so2": round(raw_so2, 4),
                "raw_nox": round(raw_nox, 4),
                "raw_pm25": round(raw_pm, 4),
                "timestamp": asyncio.get_event_loop().time(),
                "measurement_unit": "mg/m3",
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取聚光设备运行状态"""
        await self._ensure_connected()
        try:
            status_code = await self._read_register(self._MODBUS_REGS["device_status"])
            status_map = {
                0: DeviceStatus.NORMAL,
                1: DeviceStatus.CALIBRATING,
                2: DeviceStatus.MAINTENANCE,
                3: DeviceStatus.FAULT,
            }
            return {
                "status": status_map.get(int(status_code), DeviceStatus.UNKNOWN),
                "status_code": int(status_code),
                "sampling_system": "ok",
                "analysis_system": "ok",
                "data_transmission": "ok",
                "alarms": [],
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取聚光设备操作日志"""
        await self._ensure_connected()
        try:
            # 发送读日志命令
            cmd = bytes([0x02, 0x04, 0x00])
            self._writer.write(cmd)
            await self._writer.drain()
            response = await asyncio.wait_for(
                self._reader.read(1024), timeout=self.timeout
            )
            logs = []
            offset = 4
            while offset + 16 <= len(response):
                entry = response[offset:offset + 16]
                logs.append({
                    "timestamp": f"{entry[0]+2000}-{entry[1]:02d}-{entry[2]:02d}T{entry[3]:02d}:{entry[4]:02d}",
                    "event_type": ["parameter_change", "calibration", "maintenance", "alarm"][entry[5]] if entry[5] < 4 else "unknown",
                    "data": entry[6:16].hex(),
                })
                offset += 16
            return logs
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取日志超时")

    async def disconnect(self):
        """断开与聚光设备的连接"""
        if self._writer:
            try:
                self._writer.write(bytes([0x04, 0xFF]))
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("聚光设备断开异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def read_firmware_hash(self) -> Optional[str]:
        """读取聚光设备固件哈希"""
        await self._ensure_connected()
        try:
            cmd = bytes([0x0F, 0x00, 0x00, 0x20])
            self._writer.write(cmd)
            await self._writer.drain()
            response = await asyncio.wait_for(
                self._reader.read(68), timeout=self.timeout
            )
            if len(response) >= 36:
                import hashlib
                return hashlib.sha256(response[4:36]).hexdigest()
            return None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        """检测聚光设备隐藏菜单"""
        await self._ensure_connected()
        menus = []
        try:
            # 尝试工程师模式
            cmd = bytes([0x80, 0x00, 0x01])
            self._writer.write(cmd)
            await self._writer.drain()
            resp = await asyncio.wait_for(self._reader.read(8), timeout=2.0)
            if resp and resp[0] == 0x80:
                menus.append("工程师模式 (cmd=0x80)")
            # 尝试校准参数界面
            cmd = bytes([0x81, 0x00, 0x02])
            self._writer.write(cmd)
            await self._writer.drain()
            resp = await asyncio.wait_for(self._reader.read(8), timeout=2.0)
            if resp and resp[0] == 0x81:
                menus.append("校准参数界面 (cmd=0x81)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        """检测聚光设备数据保持功能"""
        await self._ensure_connected()
        try:
            cmd = bytes([0x05, 0x00])
            self._writer.write(cmd)
            await self._writer.drain()
            resp = await asyncio.wait_for(self._reader.read(5), timeout=2.0)
            return bool(resp[4] & 0x01) if len(resp) >= 5 else False
        except Exception:
            return False
