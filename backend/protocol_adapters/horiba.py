"""
Horiba 分析仪协议适配器

HORIBA 是日本知名的科学仪器制造商，其环境监测设备
在烟气分析和水质监测领域享有盛誉。

支持的型号:
  - PG-250: 便携式多组分气体分析仪
  - PG-350: 便携式排放气体分析仪
  - ENDA-55: NOx 分析仪
  - APDA-370: PM2.5/PM10 颗粒物监测仪
  - APNA-370: NOx 分析仪

连接方式:
  - serial: RS-232 串口 (默认 9600bps, 8N1)
  - ethernet: Horiba 专有 TCP 协议 (默认端口 10001)
  - modbus_tcp: Modbus TCP (默认端口 502)

Horiba 设备通信协议特点:
  - 使用标准 RS-232 串口通信
  - 命令格式: <STX><CMD><ETX><BCC>
  - 响应格式: <STX><DATA><ETX><BCC>
  - 支持远程查询和远程配置
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


class HoribaAdapter(ProtocolAdapter):
    """Horiba 分析仪协议适配器"""

    brand_name = "Horiba"
    supported_models = [
        "PG-250", "PG-350", "ENDA-55", "APDA-370", "APNA-370",
    ]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 10001

    _STX = bytes([0x02])
    _ETX = bytes([0x03])

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
        """连接 Horiba 设备 (握手: STX + ID + ETX + BCC)"""
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
                # Horiba 握手
                handshake = self._STX + b"ID" + self._ETX
                self._writer.write(handshake)
                await self._writer.drain()
                ack = await asyncio.wait_for(self._reader.read(16), timeout=self.timeout)
                if not ack or self._STX not in ack[:1]:
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
            logger.info("Horiba 设备连接成功: %s", self.host or self.serial_port)
            return True
        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except (ConnectionError, OSError) as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _send_cmd(self, cmd: bytes) -> bytes:
        """发送 Horiba 帧: STX + CMD + ETX + BCC"""
        frame = self._STX + cmd + self._ETX
        bcc = 0
        for b in frame:
            bcc ^= b
        frame += bytes([bcc])
        self._writer.write(frame)
        await self._writer.drain()
        resp = await asyncio.wait_for(self._reader.read(256), timeout=self.timeout)
        return resp

    async def read_parameters(self) -> dict:
        """读取 Horiba 校准参数"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(0, 6, slave=1)
                if result.isError():
                    raise ReadTimeoutError("Modbus 失败")
                slope = struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0]
                intercept = struct.unpack(">f", struct.pack(">HH", result.registers[2], result.registers[3]))[0]
                range_max = struct.unpack(">f", struct.pack(">HH", result.registers[4], result.registers[5]))[0]
            else:
                resp = await self._send_cmd(b"GETCAL")
                if len(resp) >= 16:
                    slope = struct.unpack(">f", resp[4:8])[0]
                    intercept = struct.unpack(">f", resp[8:12])[0]
                    range_max = struct.unpack(">f", resp[12:16])[0]
                else:
                    slope, intercept, range_max = 1.0, 0.0, 100.0
            return {
                "slope": round(slope, 4), "intercept": round(intercept, 4),
                "range_max": round(range_max, 2), "range_min": 0.0,
                "sampling_interval": 60, "brand": self.brand_name,
            }
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """读取 Horiba 内部原始数据"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(100, 4, slave=1)
                if not result.isError():
                    return {
                        "raw_ch1": round(struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0], 4),
                        "raw_ch2": round(struct.unpack(">f", struct.pack(">HH", result.registers[2], result.registers[3]))[0], 4),
                        "timestamp": asyncio.get_event_loop().time(),
                    }
            else:
                resp = await self._send_cmd(b"GETDATA")
                if len(resp) >= 12:
                    return {
                        "raw_ch1": round(struct.unpack(">f", resp[4:8])[0], 4),
                        "raw_ch2": round(struct.unpack(">f", resp[8:12])[0], 4),
                        "timestamp": asyncio.get_event_loop().time(),
                    }
            return {"timestamp": asyncio.get_event_loop().time()}
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取 Horiba 设备状态"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(200, 1, slave=1)
                if not result.isError():
                    smap = {0: DeviceStatus.NORMAL, 1: DeviceStatus.CALIBRATING,
                            2: DeviceStatus.MAINTENANCE, 3: DeviceStatus.FAULT}
                    return {"status": smap.get(result.registers[0], DeviceStatus.UNKNOWN),
                            "sampling_system": "ok", "analysis_system": "ok",
                            "data_transmission": "ok", "alarms": []}
            else:
                resp = await self._send_cmd(b"GETSTAT")
                code = resp[4] if len(resp) > 4 else 0
                smap = {0: DeviceStatus.NORMAL, 1: DeviceStatus.CALIBRATING,
                        2: DeviceStatus.MAINTENANCE, 3: DeviceStatus.FAULT}
                return {"status": smap.get(code, DeviceStatus.UNKNOWN),
                        "raw_status": resp.hex(), "alarms": []}
            return {"status": DeviceStatus.UNKNOWN}
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取 Horiba 操作日志"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(500, 16, slave=1)
                logs = []
                if not result.isError():
                    for i in range(0, len(result.registers), 4):
                        if i + 3 < len(result.registers):
                            logs.append({
                                "timestamp": f"2026-{result.registers[i]>>8:02d}-{result.registers[i]&0xFF:02d}",
                                "event_type": f"event_{result.registers[i+1]}",
                                "data": f"{result.registers[i+2]:04X}",
                            })
                return logs
            else:
                resp = await self._send_cmd(b"GETLOG")
                return [{"raw_data": resp.hex(), "event_type": "log"}]
        except Exception:
            return []

    async def disconnect(self):
        """断开与 Horiba 设备的连接"""
        if self._modbus_client:
            try:
                self._modbus_client.close()
            except Exception:
                pass
            self._modbus_client = None
        if self._writer:
            try:
                self._writer.write(self._STX + b"DISC" + self._ETX)
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("Horiba 断开异常: %s", e)
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
            resp = await self._send_cmd(b"DIAGMODE")
            if self._STX in resp[:1]:
                menus.append("诊断模式 (DIAGMODE)")
            resp = await self._send_cmd(b"SERVMODE")
            if self._STX in resp[:1]:
                menus.append("服务模式 (SERVMODE)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        await self._ensure_connected()
        try:
            resp = await self._send_cmd(b"GETHOLD")
            return resp[4] == 0x01 if len(resp) > 4 else False
        except Exception:
            return False
