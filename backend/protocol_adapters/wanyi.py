"""
皖仪科技 (Wanyi) 分析仪协议适配器

安徽皖仪科技股份有限公司是专业分析仪器和环保监测设备制造商。
产品涵盖实验室分析仪器和在线监测设备。

支持的型号:
  - WY-CEMS-100: 烟气在线监测系统
  - WY-WQMS-100: 水质在线监测系统
  - WY-LC-3100: 实验室分析仪器

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps)
  - ethernet: 自定义 TCP 协议 (默认端口 8800)
  - modbus_tcp: Modbus TCP (默认端口 502)
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


class WanyiAdapter(ProtocolAdapter):
    """皖仪科技 (Wanyi) 分析仪协议适配器"""

    brand_name = "皖仪科技"
    supported_models = ["WY-CEMS-100", "WY-WQMS-100", "WY-LC-3100"]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 8800

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

    async def connect(self) -> bool:
        """连接皖仪科技设备 (握手: 'WY' + 命令码)"""
        try:
            if self.connection_type in (ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP):
                if not self.host:
                    raise ConnectionError("需要 host")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port), timeout=self.timeout
                )
                self._writer.write(b"WY\x01")
                await self._writer.drain()
                ack = await asyncio.wait_for(self._reader.read(8), timeout=self.timeout)
                if not ack or ack[:2] != b"WY":
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
            logger.info("皖仪科技设备连接成功: %s", self.host or self.serial_port)
            return True
        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except OSError as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _cmd(self, cmd: str) -> bytes:
        """发送 ASCII 命令 (WY + CMD + \\n)"""
        self._writer.write(f"WY{cmd}\n".encode("ascii"))
        await self._writer.drain()
        return await asyncio.wait_for(self._reader.readuntil(b"\n"), timeout=self.timeout)

    async def read_parameters(self) -> dict:
        """读取皖仪科技校准参数"""
        await self._ensure_connected()
        try:
            resp = await self._cmd("GET_PARAM")
            text = resp.decode("ascii", errors="ignore")
            import re
            slope = re.search(r"SLOPE=([\d.]+)", text)
            intercept = re.search(r"INTC=([\d.-]+)", text)
            range_max = re.search(r"RANGE=([\d.]+)", text)
            return {
                "slope": float(slope.group(1)) if slope else 1.0,
                "intercept": float(intercept.group(1)) if intercept else 0.0,
                "range_max": float(range_max.group(1)) if range_max else 100.0,
                "range_min": 0.0, "sampling_interval": 60, "brand": self.brand_name,
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """读取皖仪科技内部原始数据"""
        await self._ensure_connected()
        try:
            resp = await self._cmd("GET_RAW")
            text = resp.decode("ascii", errors="ignore")
            import re
            data = {"timestamp": asyncio.get_event_loop().time()}
            so2 = re.search(r"SO2=([\d.]+)", text)
            nox = re.search(r"NOX=([\d.]+)", text)
            pm = re.search(r"PM=([\d.]+)", text)
            if so2: data["raw_so2"] = float(so2.group(1))
            if nox: data["raw_nox"] = float(nox.group(1))
            if pm: data["raw_pm25"] = float(pm.group(1))
            return data
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取皖仪科技设备状态"""
        await self._ensure_connected()
        try:
            resp = await self._cmd("GET_STATUS")
            text = resp.decode("ascii", errors="ignore")
            status = DeviceStatus.NORMAL
            if "CALIBRATING" in text: status = DeviceStatus.CALIBRATING
            elif "MAINTENANCE" in text: status = DeviceStatus.MAINTENANCE
            elif "FAULT" in text: status = DeviceStatus.FAULT
            return {"status": status, "raw_status_text": text.strip(), "alarms": []}
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取皖仪科技操作日志"""
        await self._ensure_connected()
        try:
            resp = await self._cmd("GET_LOGS 10")
            text = resp.decode("ascii", errors="ignore")
            logs = []
            import re
            for line in text.strip().split("\n"):
                if line.startswith("LOG:"):
                    parts = line[4:].split("|")
                    if len(parts) >= 3:
                        logs.append({
                            "timestamp": parts[0].strip(),
                            "event_type": parts[1].strip(),
                            "detail": parts[2].strip(),
                        })
            return logs
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取日志超时")

    async def disconnect(self):
        """断开与皖仪科技设备的连接"""
        if self._writer:
            try:
                self._writer.write(b"WYDISCONNECT\n")
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("皖仪科技断开异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def read_firmware_hash(self) -> Optional[str]:
        await self._ensure_connected()
        try:
            resp = await self._cmd("GET_FW_HASH")
            text = resp.decode("ascii", errors="ignore")
            import re
            m = re.search(r"([0-9a-fA-F]{64})", text)
            return m.group(1) if m else None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        await self._ensure_connected()
        menus = []
        try:
            resp = await self._cmd("ENGINEER_MODE")
            if b"OK" in resp:
                menus.append("工程师模式 (ENGINEER_MODE)")
            resp = await self._cmd("DEBUG_MENU")
            if b"OK" in resp:
                menus.append("调试菜单 (DEBUG_MENU)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        await self._ensure_connected()
        try:
            resp = await self._cmd("GET_HOLD_FLAG")
            return b"HOLD=1" in resp
        except Exception:
            return False
