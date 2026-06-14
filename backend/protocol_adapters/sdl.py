"""
雪迪龙 (SDL / Scanning Digital Limited) 分析仪协议适配器

北京雪迪龙科技股份有限公司是国内知名的环境监测仪器制造商。
其产品线涵盖 CEMS、VOCs、水质在线监测等。

支持的型号:
  - SDL-CEMS-200: 烟气排放连续监测系统
  - SDL-CEMS-300: 便携式烟气分析仪
  - SDL-VOCs-100: VOCs在线监测系统
  - SDL-WQMS-200: 水质在线监测系统

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps, 8N1)
  - ethernet: 自定义 TCP 协议 (默认端口 8080)
  - modbus_tcp: Modbus TCP (默认端口 502)

典型用法:
    adapter = SDLAdapter(host="192.168.1.100", port=8080)
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


class SDLAdapter(ProtocolAdapter):
    """雪迪龙 (SDL) 分析仪协议适配器"""

    brand_name = "雪迪龙"
    supported_models = [
        "SDL-CEMS-200",
        "SDL-CEMS-300",
        "SDL-VOCs-100",
        "SDL-WQMS-200",
    ]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 8080

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
        self._transaction_id = 0

    async def connect(self) -> bool:
        """
        连接雪迪龙设备。

        雪迪龙使用 HJ 212-2017 兼容的 TCP 协议:
        1. 发送登录报文 (包含设备站号)
        2. 接收登录确认

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
                # 发送登录报文 (HJ 212 风格)
                login = b"##0039ST=32;CN=1011;PW=123456;MN=SDL001;CP=&&DataTime=20260101000000&&\r\n"
                self._writer.write(login)
                await self._writer.drain()
                ack = await asyncio.wait_for(
                    self._reader.readuntil(b"\r\n"), timeout=self.timeout
                )
                if b"Flag=1" not in ack and b"ACK" not in ack:
                    logger.warning("雪迪龙设备登录响应异常: %s", ack)

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
            logger.info("雪迪龙设备连接成功: %s:%d", self.host or self.serial_port, self.port)
            return True

        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except OSError as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _send_request(self, cn: str, cp: str = "") -> bytes:
        """发送 HJ 212 风格请求"""
        self._transaction_id += 1
        header = f"##0039ST=32;CN={cn};PW=123456;MN=SDL001;Flag=4;CP=&&{cp}&&\r\n"
        self._writer.write(header.encode("ascii"))
        await self._writer.drain()
        response = await asyncio.wait_for(
            self._reader.readuntil(b"\r\n"), timeout=self.timeout
        )
        return response

    async def read_parameters(self) -> dict:
        """
        读取雪迪龙设备参数。

        通过 HJ 212 CN=2011 (请求校准参数) 获取。

        Returns:
            dict: 校准参数
        """
        await self._ensure_connected()
        try:
            response = await self._send_request("2011", "PollId=01")
            text = response.decode("ascii", errors="ignore")

            # 解析 HJ 212 响应
            params = {}
            if "Slope" in text:
                import re
                slope_match = re.search(r"Slope=([\d.]+)", text)
                intercept_match = re.search(r"Intercept=([\d.-]+)", text)
                range_match = re.search(r"Range=([\d.]+)", text)
                if slope_match:
                    params["slope"] = float(slope_match.group(1))
                if intercept_match:
                    params["intercept"] = float(intercept_match.group(1))
                if range_match:
                    params["range_max"] = float(range_match.group(1))

            params.setdefault("slope", 1.0)
            params.setdefault("intercept", 0.0)
            params.setdefault("range_max", 100.0)
            params.setdefault("range_min", 0.0)
            params.setdefault("sampling_interval", 60)
            params["brand"] = self.brand_name
            return params

        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """
        读取雪迪龙设备内部原始数据。

        通过 HJ 212 CN=2051 (请求实时数据) 获取。

        Returns:
            dict: 原始测量数据
        """
        await self._ensure_connected()
        try:
            response = await self._send_request("2051", "PollId=01")
            text = response.decode("ascii", errors="ignore")

            import re
            data = {"raw_data_text": text}
            so2 = re.search(r"SO2-Rtd=([\d.]+)", text)
            nox = re.search(r"NOx-Rtd=([\d.]+)", text)
            pm = re.search(r"PM-Rtd=([\d.]+)", text)

            if so2:
                data["raw_so2"] = float(so2.group(1))
            if nox:
                data["raw_nox"] = float(nox.group(1))
            if pm:
                data["raw_pm25"] = float(pm.group(1))

            data["timestamp"] = asyncio.get_event_loop().time()
            return data

        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取雪迪龙设备运行状态"""
        await self._ensure_connected()
        try:
            response = await self._send_request("2061", "")
            text = response.decode("ascii", errors="ignore")

            import re
            status = "normal"
            if "Calibrating" in text:
                status = DeviceStatus.CALIBRATING
            elif "Maintenance" in text:
                status = DeviceStatus.MAINTENANCE
            elif "Fault" in text or "Error" in text:
                status = DeviceStatus.FAULT

            return {
                "status": status,
                "sampling_system": "ok",
                "analysis_system": "ok",
                "data_transmission": "ok",
                "alarms": re.findall(r"Alarm=(\w+)", text),
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取雪迪龙设备操作日志"""
        await self._ensure_connected()
        try:
            response = await self._send_request("2071", "LogNum=10")
            text = response.decode("ascii", errors="ignore")
            logs = []
            import re
            for match in re.finditer(r"(\d{14});(\w+);(.+?)(?=&&|\r\n)", text):
                ts, evt, detail = match.groups()
                logs.append({
                    "timestamp": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}T{ts[8:10]}:{ts[10:12]}:{ts[12:14]}",
                    "event_type": evt,
                    "detail": detail,
                })
            return logs
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取日志超时")

    async def disconnect(self):
        """断开与雪迪龙设备的连接"""
        if self._writer:
            try:
                logout = b"##0039ST=32;CN=1012;PW=123456;MN=SDL001;CP=&&&&\r\n"
                self._writer.write(logout)
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("雪迪龙设备断开异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def read_firmware_hash(self) -> Optional[str]:
        """读取雪迪龙设备固件哈希"""
        await self._ensure_connected()
        try:
            response = await self._send_request("2091", "FWHash=1")
            text = response.decode("ascii", errors="ignore")
            import re
            m = re.search(r"FWHash=([0-9a-fA-F]{64})", text)
            return m.group(1) if m else None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        """检测雪迪龙设备隐藏菜单"""
        await self._ensure_connected()
        menus = []
        try:
            response = await self._send_request("9001", "")
            text = response.decode("ascii", errors="ignore")
            if "Engineer" in text or "Debug" in text:
                menus.append("工程师调试模式 (CN=9001)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        """检测雪迪龙设备数据保持功能"""
        await self._ensure_connected()
        try:
            response = await self._send_request("2051", "PollId=01;HoldFlag=1")
            return b"HoldFlag=1" in response
        except Exception:
            return False
