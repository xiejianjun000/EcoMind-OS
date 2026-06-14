"""
ABB 分析仪协议适配器

ABB 是全球电力和自动化技术领导企业，其环保监测产品线
包括气体分析、水质分析等。

支持的型号:
  - EL3020: 多组分气体分析仪
  - AO2000: 模块化气体分析系统
  - AZ20: 水质分析仪
  - Advance Optima: 高端气体分析平台

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps)
  - ethernet: ABB 专有 TCP 协议 (默认端口 8000)
  - modbus_tcp: Modbus TCP (默认端口 502)

ABB 设备通信协议特点:
  - AO2000 系列支持标准的 Modbus TCP
  - EL3020 使用专有 ASCII 命令
  - 支持 OPC-UA (完整模式)
"""

from __future__ import annotations

import asyncio
import logging
import re
import struct
from typing import Any, Optional

from .registry import (
    ConnectionError, ConnectionType, DeviceStatus,
    ProtocolAdapter, ReadTimeoutError,
)

logger = logging.getLogger(__name__)


class ABBAdapter(ProtocolAdapter):
    """ABB 分析仪协议适配器"""

    brand_name = "ABB"
    supported_models = ["EL3020", "AO2000", "AZ20", "Advance Optima"]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 8000

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
        """连接 ABB 设备"""
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
            elif self.connection_type in (ConnectionType.ETHERNET,):
                if not self.host:
                    raise ConnectionError("需要 host")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port), timeout=self.timeout
                )
                # ABB 握手: 'ABB' + 版本
                self._writer.write(b"ABB\x01")
                await self._writer.drain()
                ack = await asyncio.wait_for(self._reader.read(8), timeout=self.timeout)
                if not ack or ack[:3] != b"ABB":
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
            logger.info("ABB 设备连接成功: %s", self.host or self.serial_port)
            return True
        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except (ConnectionError, OSError) as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _send_cmd(self, cmd: str) -> str:
        """发送 ABB ASCII 命令"""
        self._writer.write(f"{cmd}\n".encode("ascii"))
        await self._writer.drain()
        resp = await asyncio.wait_for(
            self._reader.readuntil(b"\n"), timeout=self.timeout
        )
        return resp.decode("ascii", errors="ignore").strip()

    async def read_parameters(self) -> dict:
        """读取 ABB 校准参数"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(0, 6, slave=1)
                if result.isError():
                    raise ReadTimeoutError("Modbus 读取失败")
                slope = struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0]
                intercept = struct.unpack(">f", struct.pack(">HH", result.registers[2], result.registers[3]))[0]
                range_max = struct.unpack(">f", struct.pack(">HH", result.registers[4], result.registers[5]))[0]
            else:
                slope_resp = await self._send_cmd("GET SLOPE")
                intc_resp = await self._send_cmd("GET ZERO")
                rng_resp = await self._send_cmd("GET RANGE")
                def pv(t):
                    m = re.search(r"[-\d.]+", t)
                    return float(m.group()) if m else 0.0
                slope, intercept, range_max = pv(slope_resp), pv(intc_resp), pv(rng_resp)
            return {
                "slope": round(slope, 4), "intercept": round(intercept, 4),
                "range_max": round(range_max, 2), "range_min": 0.0,
                "sampling_interval": 60, "brand": self.brand_name,
            }
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """读取 ABB 内部原始数据"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(100, 4, slave=1)
                if not result.isError():
                    ch1 = struct.unpack(">f", struct.pack(">HH", result.registers[0], result.registers[1]))[0]
                    ch2 = struct.unpack(">f", struct.pack(">HH", result.registers[2], result.registers[3]))[0]
                    return {"raw_ch1": round(ch1, 4), "raw_ch2": round(ch2, 4),
                            "timestamp": asyncio.get_event_loop().time()}
            else:
                resp = await self._send_cmd("GET CONCENTRATION")
                vals = re.findall(r"[-\d.]+", resp)
                return {"raw_values": [float(v) for v in vals],
                        "timestamp": asyncio.get_event_loop().time()}
            return {"timestamp": asyncio.get_event_loop().time()}
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取 ABB 设备状态"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(200, 1, slave=1)
                if not result.isError():
                    code = result.registers[0]
                    smap = {0: DeviceStatus.NORMAL, 1: DeviceStatus.CALIBRATING,
                            2: DeviceStatus.MAINTENANCE, 3: DeviceStatus.FAULT}
                    return {"status": smap.get(code, DeviceStatus.UNKNOWN),
                            "status_code": code, "sampling_system": "ok",
                            "analysis_system": "ok", "alarms": []}
            else:
                resp = await self._send_cmd("GET STATUS")
                status = DeviceStatus.NORMAL
                if "CAL" in resp.upper(): status = DeviceStatus.CALIBRATING
                elif "MAINT" in resp.upper(): status = DeviceStatus.MAINTENANCE
                elif "FAULT" in resp.upper(): status = DeviceStatus.FAULT
                return {"status": status, "raw_status": resp, "alarms": []}
            return {"status": DeviceStatus.UNKNOWN}
        except (asyncio.TimeoutError, ReadTimeoutError):
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取 ABB 操作日志"""
        await self._ensure_connected()
        try:
            if self._modbus_client:
                result = await self._modbus_client.read_holding_registers(500, 20, slave=1)
                logs = []
                if not result.isError():
                    for i in range(0, len(result.registers), 5):
                        if i + 4 < len(result.registers):
                            logs.append({
                                "timestamp": f"2026-{result.registers[i]>>8:02d}-{result.registers[i]&0xFF:02d}",
                                "event_type": f"code_{result.registers[i+1]}",
                                "data": f"{result.registers[i+2]:04X}{result.registers[i+3]:04X}",
                            })
                return logs
            else:
                resp = await self._send_cmd("GET LOG 10")
                return [{"timestamp": "", "event_type": "log", "raw_text": line}
                        for line in resp.split("\n") if line.strip()]
        except Exception:
            return []

    async def disconnect(self):
        """断开与 ABB 设备的连接"""
        if self._modbus_client:
            try:
                self._modbus_client.close()
            except Exception:
                pass
            self._modbus_client = None
        if self._writer:
            try:
                self._writer.write(b"DISCONNECT\n")
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("ABB 断开异常: %s", e)
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
            resp = await self._send_cmd("ENTER DIAG")
            if "OK" in resp.upper():
                menus.append("诊断模式 (ENTER DIAG)")
            resp = await self._send_cmd("ENTER SERVICE")
            if "OK" in resp.upper():
                menus.append("服务模式 (ENTER SERVICE)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        await self._ensure_connected()
        try:
            resp = await self._send_cmd("GET HOLD")
            return "ON" in resp.upper() or "1" in resp
        except Exception:
            return False
