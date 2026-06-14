"""
Thermo Fisher 分析仪协议适配器

Thermo Fisher Scientific 是全球领先的环境监测仪器制造商。
其 CEMS 产品广泛应用于全球环保监测领域。

支持的型号:
  - 43i: SO2 分析仪
  - 42i: NO/NO2/NOx 分析仪
  - 1405e: PM2.5/PM10 颗粒物监测仪
  - 48i: CO 分析仪
  - 49i: O3 校准源

连接方式:
  - serial: RS-232 串口 (默认 9600bps, 8N1)
  - ethernet: Thermo Fisher 专有 TCP 协议 (默认端口 9001)
  - modbus_tcp: Modbus TCP (默认端口 502)

Thermo Fisher 设备通信协议特点:
  - 使用 ASCII 命令/响应模式
  - 命令以 CRLF 结束
  - 响应格式: [状态码] [数据]
  - 支持远程查询和配置

典型用法:
    adapter = ThermoFisherAdapter(host="192.168.1.100", port=9001)
    await adapter.connect()
    params = await adapter.read_parameters()
    await adapter.disconnect()
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


class ThermoFisherAdapter(ProtocolAdapter):
    """Thermo Fisher 分析仪协议适配器"""

    brand_name = "Thermo Fisher"
    supported_models = ["43i", "42i", "1405e", "48i", "49i"]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 9001

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
        """
        连接 Thermo Fisher 设备。

        Thermo Fisher 使用 ASCII 命令模式，连接后发送 CONN? 查询确认设备就绪。

        Returns:
            bool: 连接是否成功
        """
        try:
            if self.connection_type in (ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP):
                if not self.host:
                    raise ConnectionError("需要 host")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port), timeout=self.timeout
                )
                # 发送连接确认命令
                self._writer.write(b"CONN?\r\n")
                await self._writer.drain()
                resp = await asyncio.wait_for(
                    self._reader.readuntil(b"\r\n"), timeout=self.timeout
                )
                if b"OK" not in resp.upper():
                    logger.warning("Thermo Fisher 连接确认异常: %s", resp)
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
            logger.info("Thermo Fisher 设备连接成功: %s", self.host or self.serial_port)
            return True
        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except OSError as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _send_cmd(self, cmd: str) -> str:
        """发送 ASCII 命令并返回响应文本"""
        self._writer.write(f"{cmd}\r\n".encode("ascii"))
        await self._writer.drain()
        resp = await asyncio.wait_for(
            self._reader.readuntil(b"\r\n"), timeout=self.timeout
        )
        return resp.decode("ascii", errors="ignore").strip()

    async def read_parameters(self) -> dict:
        """
        读取 Thermo Fisher 设备参数。

        使用 SLOPE? / ZERO? / RANGE? 命令获取校准参数。

        Returns:
            dict: 校准参数
        """
        await self._ensure_connected()
        try:
            slope_resp = await self._send_cmd("SLOPE?")
            zero_resp = await self._send_cmd("ZERO?")
            range_resp = await self._send_cmd("RANGE?")

            def parse_val(text: str) -> float:
                m = re.search(r"[-\d.]+", text)
                return float(m.group()) if m else 0.0

            return {
                "slope": round(parse_val(slope_resp), 4),
                "intercept": round(parse_val(zero_resp), 4),
                "range_max": round(parse_val(range_resp), 2),
                "range_min": 0.0,
                "sampling_interval": 60,
                "brand": self.brand_name,
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """
        读取 Thermo Fisher 内部原始数据。

        使用 CONC? 获取当前浓度读数（原始传感器值）。

        Returns:
            dict: 原始测量数据
        """
        await self._ensure_connected()
        try:
            conc_resp = await self._send_cmd("CONC?")
            m = re.search(r"[-\d.]+", conc_resp)
            return {
                "raw_concentration": round(float(m.group()), 4) if m else 0.0,
                "raw_response_text": conc_resp,
                "timestamp": asyncio.get_event_loop().time(),
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取 Thermo Fisher 设备状态"""
        await self._ensure_connected()
        try:
            status_resp = await self._send_cmd("STAT?")
            status = DeviceStatus.NORMAL
            if "CAL" in status_resp.upper():
                status = DeviceStatus.CALIBRATING
            elif "MAINT" in status_resp.upper():
                status = DeviceStatus.MAINTENANCE
            elif "FAULT" in status_resp.upper() or "ERROR" in status_resp.upper():
                status = DeviceStatus.FAULT
            return {
                "status": status,
                "raw_status": status_resp,
                "sampling_system": "ok",
                "analysis_system": "ok",
                "alarms": [],
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取 Thermo Fisher 操作日志"""
        await self._ensure_connected()
        try:
            logs_resp = await self._send_cmd("LOG? N=10")
            logs = []
            for line in logs_resp.split("\n"):
                if line.strip():
                    logs.append({
                        "timestamp": "",
                        "event_type": "log_entry",
                        "raw_text": line.strip(),
                    })
            return logs
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取日志超时")

    async def disconnect(self):
        """断开与 Thermo Fisher 设备的连接"""
        if self._writer:
            try:
                self._writer.write(b"DISCONN\r\n")
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("Thermo Fisher 断开异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def read_firmware_hash(self) -> Optional[str]:
        """读取 Thermo Fisher 固件哈希"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd("FWHASH?")
            m = re.search(r"[0-9a-fA-F]{64}", resp)
            return m.group(1) if m else None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        """检测 Thermo Fisher 隐藏菜单"""
        await self._ensure_connected()
        menus = []
        try:
            resp = await self._send_cmd("DIAG?")
            if "OK" in resp.upper():
                menus.append("诊断模式 (DIAG)")
            resp = await self._send_cmd("SERVICE?")
            if "OK" in resp.upper():
                menus.append("服务模式 (SERVICE)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        """检测 Thermo Fisher 数据保持功能"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd("HOLD?")
            return "ON" in resp.upper() or "1" in resp
        except Exception:
            return False
