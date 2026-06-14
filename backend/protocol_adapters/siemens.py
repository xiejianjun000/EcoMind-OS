"""
Siemens 分析仪协议适配器

Siemens (西门子) 是全球工业自动化和环境监测的领导者。
其 Ultramat/Calomat 系列气体分析仪广泛应用于环保和工业领域。

支持的型号:
  - Ultramat 23: 多组分红外气体分析仪
  - Ultramat 6: 红外气体分析仪
  - Calomat 6: 热导气体分析仪
  - LDS 6: 激光气体分析仪
  - SITRANS CW: 水质分析仪

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps)
  - ethernet: Siemens 专有 TCP 协议 (默认端口 102)
  - modbus_tcp: Modbus TCP (默认端口 502)

Siemens 设备通信协议特点:
  - 支持 Modbus TCP/RTU
  - Profibus DP 和 Profinet
  - 部分型号支持 ASCII 命令模式
  - Ultramat 系列使用标准寄存器映射
"""

from __future__ import annotations

import asyncio
import logging
import struct
from typing import Any, Optional

from .registry import (
    ConnectionError, ConnectionType, DeviceStatus,
    ProtocolAdapter, ReadTimeoutError,
)

logger = logging.getLogger(__name__)


class SiemensAdapter(ProtocolAdapter):
    """Siemens (西门子) 分析仪协议适配器"""

    brand_name = "Siemens"
    supported_models = [
        "Ultramat 23", "Ultramat 6",
        "Calomat 6", "LDS 6", "SITRANS CW",
    ]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 502  # Siemens 设备常用 Modbus TCP

    # Siemens Ultramat Modbus 寄存器地址 (Holding Registers)
    _REG_MAP = {
        "slope_ch1": 100,
        "zero_ch1": 102,
        "range_ch1": 104,
        "slope_ch2": 106,
        "zero_ch2": 108,
        "range_ch2": 110,
        "concentration_ch1": 200,
        "concentration_ch2": 202,
        "device_status": 300,
    }

    def __init__(
        self, host=None, port=None, serial_port=None, baud_rate=9600,
        timeout=5.0, connection_type=ConnectionType.ETHERNET, **kwargs
    ):
        super().__init__(
            host=host, port=port, serial_port=serial_port,
            baud_rate=baud_rate, timeout=timeout,
            connection_type=connection_type, **kwargs
        )
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._modbus_client = None

    async def connect(self) -> bool:
        """连接 Siemens 设备"""
        try:
            if self.connection_type == ConnectionType.MODBUS_TCP:
                try:
                    from pymodbus.client import AsyncModbusTcpClient
                    self._modbus_client = AsyncModbusTcpClient(
                        self.host or "localhost", port=self.port
                    )
                    result = await self._modbus_client.connect()
                    if not result:
                        raise ConnectionError("Modbus TCP 连接失败")
                    # 读取设备标识验证
                    result = await self._modbus_client.read_holding_registers(0, 4, slave=1)
                    if result.isError():
                        raise ConnectionError("读取设备标识失败")
                except ImportError:
                    raise ConnectionError("Modbus 通信需要安装 pymodbus")
                except ConnectionError:
                    raise
                except Exception as e:
                    raise ConnectionError(f"Modbus 连接失败: {e}")

            elif self.connection_type == ConnectionType.ETHERNET:
                if not self.host:
                    raise ConnectionError("需要 host")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port), timeout=self.timeout
                )
                # Siemens S7 风格握手
                self._writer.write(bytes([0x03, 0x00, 0x00, 0x16, 0x11, 0xE0,
                                           0x00, 0x00, 0x00, 0x01, 0x00, 0xC0,
                                           0x01, 0x0A, 0xC1, 0x02, 0x01, 0x00,
                                           0xC2, 0x02, 0x01, 0x01]))
                await self._writer.drain()
                ack = await asyncio.wait_for(self._reader.read(32), timeout=self.timeout)
                if not ack:
                    raise ConnectionError("握手失败")

            elif self.connection_type == ConnectionType.SERIAL:
                try:
                    import serial_asyncio
                    self._reader, self._writer = await serial_asyncio.open_serial_connection(
                        url=self.serial_port, baudrate=self.baud_rate
                    )
                except ImportError:
                    raise ConnectionError("需要 pyserial-asyncio")
                except Exception as e:
                    raise ConnectionError(f"串口失败: {e}")

            self._connected = True
            logger.info("Siemens 设备连接成功: %s", self.host or self.serial_port)
            return True
        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except (ConnectionError, OSError) as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _read_modbus_register(self, addr: int) -> float:
        """读取 Modbus 寄存器"""
        if self._modbus_client:
            result = await self._modbus_client.read_holding_registers(addr, 2, slave=1)
            if result.isError():
                raise ReadTimeoutError(f"Modbus 读取失败: addr={addr}")
            return struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0]
        elif self._writer:
            # 自定义协议读取
            self._writer.write(struct.pack(">BH", 0x03, addr))
            await self._writer.drain()
            resp = await asyncio.wait_for(self._reader.read(8), timeout=self.timeout)
            if len(resp) >= 8:
                return struct.unpack(">f", resp[4:8])[0]
            raise ReadTimeoutError("响应不完整")
        raise ConnectionError("无可用连接")

    async def read_parameters(self) -> dict:
        """读取 Siemens 设备校准参数"""
        await self._ensure_connected()
        try:
            slope = await self._read_modbus_register(self._REG_MAP["slope_ch1"])
            zero = await self._read_modbus_register(self._REG_MAP["zero_ch1"])
            range_max = await self._read_modbus_register(self._REG_MAP["range_ch1"])
            return {
                "slope": round(slope, 4), "intercept": round(zero, 4),
                "range_max": round(range_max, 2), "range_min": 0.0,
                "sampling_interval": 60, "brand": self.brand_name,
            }
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """读取 Siemens 内部原始数据"""
        await self._ensure_connected()
        try:
            ch1 = await self._read_modbus_register(self._REG_MAP["concentration_ch1"])
            ch2 = await self._read_modbus_register(self._REG_MAP["concentration_ch2"])
            return {
                "raw_ch1": round(ch1, 4), "raw_ch2": round(ch2, 4),
                "timestamp": asyncio.get_event_loop().time(),
            }
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取 Siemens 设备状态"""
        await self._ensure_connected()
        try:
            status_code = await self._read_modbus_register(self._REG_MAP["device_status"])
            smap = {0: DeviceStatus.NORMAL, 1: DeviceStatus.CALIBRATING,
                    2: DeviceStatus.MAINTENANCE, 3: DeviceStatus.FAULT}
            return {
                "status": smap.get(int(status_code), DeviceStatus.UNKNOWN),
                "status_code": int(status_code),
                "sampling_system": "ok", "analysis_system": "ok",
                "data_transmission": "ok", "alarms": [],
            }
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取 Siemens 操作日志"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(500, 20, slave=1)
                logs = []
                for i in range(0, len(result.registers), 4):
                    if i + 3 < len(result.registers):
                        logs.append({
                            "timestamp": f"2026-{result.registers[i]>>8:02d}-{result.registers[i]&0xFF:02d}T{result.registers[i+1]>>8:02d}:{result.registers[i+1]&0xFF:02d}",
                            "event_type": f"event_{result.registers[i+2]}",
                            "data": f"{result.registers[i+3]:04X}",
                        })
                return logs
            return []
        except Exception:
            return []

    async def disconnect(self):
        """断开与 Siemens 设备的连接"""
        if self._modbus_client:
            try:
                self._modbus_client.close()
            except Exception:
                pass
            self._modbus_client = None
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("Siemens 断开异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def read_firmware_hash(self) -> Optional[str]:
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(1000, 16, slave=1)
                if not result.isError():
                    import hashlib
                    data = b"".join(struct.pack(">H", r) for r in result.registers)
                    return hashlib.sha256(data).hexdigest()
            return None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        await self._ensure_connected()
        menus = []
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(2000, 2, slave=1)
                if not result.isError():
                    menus.append("服务模式 (寄存器 2000)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(400, 1, slave=1)
                if not result.isError() and result.registers[0] == 1:
                    return True
            return False
        except Exception:
            return False
