"""
Emerson 分析仪协议适配器

Emerson (艾默生) 是全球领先的自动化解决方案提供商。
其 Rosemount 和 X-Stream 系列气体分析仪广泛应用于工业和环保领域。

支持的型号:
  - X-Stream: 多组分红外/紫外气体分析仪
  - Rosemount NGC: 天然气色谱分析仪
  - Rosemount 6888: 氧化锆氧分析仪
  - Micro Motion: 质量流量计

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps)
  - ethernet: Emerson 专有 TCP 协议 (默认端口 5000)
  - modbus_tcp: Modbus TCP (默认端口 502)

Emerson 设备通信协议特点:
  - X-Stream 系列支持 Modbus TCP
  - 部分型号支持 Hart 协议 (需要 Hart modem)
  - 支持 AMS DeviceManager 远程管理
  - 标准寄存器映射遵循 Emerson 规范
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


class EmersonAdapter(ProtocolAdapter):
    """Emerson (艾默生) 分析仪协议适配器"""

    brand_name = "Emerson"
    supported_models = [
        "X-Stream", "Rosemount NGC", "Rosemount 6888", "Micro Motion",
    ]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 5000

    # Emerson Modbus 寄存器映射
    _REG_SLOPE = 40001
    _REG_INTERCEPT = 40003
    _REG_RANGE = 40005
    _REG_CONCENTRATION = 30001
    _REG_STATUS = 40100

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
        """连接 Emerson 设备"""
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
                except ImportError:
                    raise ConnectionError("需要安装 pymodbus")
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
                # Emerson 握手: EM + 命令
                self._writer.write(b"EM\x01\x00")
                await self._writer.drain()
                ack = await asyncio.wait_for(self._reader.read(8), timeout=self.timeout)
                if not ack or ack[:2] != b"EM":
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
            logger.info("Emerson 设备连接成功: %s", self.host or self.serial_port)
            return True
        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except (ConnectionError, OSError) as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _read_reg(self, addr: int) -> float:
        """读取 Emerson 寄存器值"""
        if self._modbus_client:
            result = await self._modbus_client.read_holding_registers(addr - 40001, 2, slave=1)
            if result.isError():
                raise ReadTimeoutError(f"Modbus 读取失败: addr={addr}")
            return struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0]
        elif self._writer:
            self._writer.write(struct.pack(">BH", 0x03, addr & 0xFFFF))
            await self._writer.drain()
            resp = await asyncio.wait_for(self._reader.read(8), timeout=self.timeout)
            if len(resp) >= 8:
                return struct.unpack(">f", resp[4:8])[0]
            raise ReadTimeoutError("响应不完整")
        raise ConnectionError("无可用连接")

    async def read_parameters(self) -> dict:
        """读取 Emerson 校准参数"""
        await self._ensure_connected()
        try:
            slope = await self._read_reg(self._REG_SLOPE)
            intercept = await self._read_reg(self._REG_INTERCEPT)
            range_max = await self._read_reg(self._REG_RANGE)
            return {
                "slope": round(slope, 4), "intercept": round(intercept, 4),
                "range_max": round(range_max, 2), "range_min": 0.0,
                "sampling_interval": 60, "brand": self.brand_name,
            }
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """读取 Emerson 内部原始数据"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_input_registers(
                    self._REG_CONCENTRATION - 30001, 2, slave=1
                )
                if not result.isError():
                    conc = struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0]
                    return {"raw_concentration": round(conc, 4),
                            "timestamp": asyncio.get_event_loop().time()}
            else:
                self._writer.write(b"EM\x03\x00\x00")
                await self._writer.drain()
                resp = await asyncio.wait_for(self._reader.read(16), timeout=self.timeout)
                if len(resp) >= 8:
                    return {"raw_concentration": round(struct.unpack(">f", resp[4:8])[0], 4),
                            "timestamp": asyncio.get_event_loop().time()}
            return {"timestamp": asyncio.get_event_loop().time()}
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取 Emerson 设备状态"""
        await self._ensure_connected()
        try:
            status_code = await self._read_reg(self._REG_STATUS)
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
        """读取 Emerson 操作日志"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(500, 20, slave=1)
                logs = []
                if not result.isError():
                    for i in range(0, len(result.registers), 5):
                        if i + 4 < len(result.registers):
                            logs.append({
                                "timestamp": f"2026-{result.registers[i]>>8:02d}-{result.registers[i]&0xFF:02d}T{result.registers[i+1]>>8:02d}:{result.registers[i+1]&0xFF:02d}",
                                "event_type": f"event_{result.registers[i+2]}",
                                "data": f"{result.registers[i+3]:04X}{result.registers[i+4]:04X}",
                            })
                return logs
            return []
        except Exception:
            return []

    async def disconnect(self):
        """断开与 Emerson 设备的连接"""
        if self._modbus_client:
            try:
                self._modbus_client.close()
            except Exception:
                pass
            self._modbus_client = None
        if self._writer:
            try:
                self._writer.write(b"EM\xFF\x00\x00")
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("Emerson 断开异常: %s", e)
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
            if self._writer:
                self._writer.write(b"EM\x80\x00\x00")
                await self._writer.drain()
                resp = await asyncio.wait_for(self._reader.read(8), timeout=2.0)
                if resp and resp[:2] == b"EM" and resp[2] == 0x80:
                    menus.append("诊断模式 (cmd=0x80)")
                self._writer.write(b"EM\x81\x00\x00")
                await self._writer.drain()
                resp = await asyncio.wait_for(self._reader.read(8), timeout=2.0)
                if resp and resp[:2] == b"EM" and resp[2] == 0x81:
                    menus.append("校准参数调试 (cmd=0x81)")
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
