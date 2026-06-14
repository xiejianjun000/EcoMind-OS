"""
先河环保 (Sailhero) 分析仪协议适配器

河北先河环保科技股份有限公司是国内领先的环境监测整体解决方案提供商。
产品涵盖空气/水质/烟气/噪声监测。

支持的型号:
  - SH-CEMS-1000: 烟气排放连续监测系统
  - SH-CEMS-2000: 超低排放烟气监测系统
  - SH-AQMS-1000: 空气质量自动监测系统
  - SH-WQMS-1000: 水质在线监测系统

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps)
  - ethernet: 自定义 TCP 协议 (默认端口 6001)
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


class SailheroAdapter(ProtocolAdapter):
    """先河环保 (Sailhero) 分析仪协议适配器"""

    brand_name = "先河环保"
    supported_models = [
        "SH-CEMS-1000", "SH-CEMS-2000",
        "SH-AQMS-1000", "SH-WQMS-1000",
    ]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 6001

    # 先河设备帧头
    _FRAME_HEADER = bytes([0x68, 0x53, 0x48])  # "SH"

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
        """连接先河环保设备"""
        try:
            if self.connection_type in (ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP):
                if not self.host:
                    raise ConnectionError("需要 host")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port), timeout=self.timeout
                )
                # 握手: 0x68 0x53 0x48 + 连接请求(0x01)
                self._writer.write(self._FRAME_HEADER + bytes([0x01]))
                await self._writer.drain()
                ack = await asyncio.wait_for(self._reader.read(8), timeout=self.timeout)
                if not ack or ack[:3] != self._FRAME_HEADER or ack[3] != 0x81:
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
            logger.info("先河环保设备连接成功: %s", self.host or self.serial_port)
            return True
        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except OSError as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _cmd(self, func: int) -> bytes:
        """发送功能命令"""
        frame = self._FRAME_HEADER + bytes([func])
        self._writer.write(frame)
        await self._writer.drain()
        return await asyncio.wait_for(self._reader.read(512), timeout=self.timeout)

    async def read_parameters(self) -> dict:
        """读取先河环保校准参数 (func=0x10)"""
        await self._ensure_connected()
        try:
            resp = await self._cmd(0x10)
            if len(resp) >= 20:
                return {
                    "slope": round(struct.unpack(">f", resp[4:8])[0], 4),
                    "intercept": round(struct.unpack(">f", resp[8:12])[0], 4),
                    "range_max": round(struct.unpack(">f", resp[12:16])[0], 2),
                    "range_min": 0.0, "sampling_interval": 60, "brand": self.brand_name,
                }
            return {"slope": 1.0, "intercept": 0.0, "range_max": 100.0}
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """读取先河环保内部原始数据 (func=0x11)"""
        await self._ensure_connected()
        try:
            resp = await self._cmd(0x11)
            if len(resp) >= 20:
                return {
                    "raw_so2": round(struct.unpack(">f", resp[4:8])[0], 4),
                    "raw_nox": round(struct.unpack(">f", resp[8:12])[0], 4),
                    "raw_pm25": round(struct.unpack(">f", resp[12:16])[0], 4),
                    "timestamp": asyncio.get_event_loop().time(),
                }
            return {"timestamp": asyncio.get_event_loop().time()}
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取先河环保设备状态 (func=0x12)"""
        await self._ensure_connected()
        try:
            resp = await self._cmd(0x12)
            if len(resp) >= 6:
                smap = {0: DeviceStatus.NORMAL, 1: DeviceStatus.CALIBRATING,
                        2: DeviceStatus.MAINTENANCE, 3: DeviceStatus.FAULT}
                return {"status": smap.get(resp[4], DeviceStatus.UNKNOWN),
                        "sampling_system": "ok", "analysis_system": "ok",
                        "data_transmission": "ok", "alarms": []}
            return {"status": DeviceStatus.UNKNOWN}
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取先河环保操作日志 (func=0x13)"""
        await self._ensure_connected()
        try:
            resp = await self._cmd(0x13)
            logs, off = [], 4
            while off + 16 <= len(resp):
                e = resp[off:off+16]
                logs.append({
                    "timestamp": f"2026-{e[0]:02d}-{e[1]:02d}T{e[2]:02d}:{e[3]:02d}",
                    "event_type": ["param_change", "calibration", "maintenance", "alarm"][e[4]] if e[4] < 4 else "unknown",
                    "data": e[5:16].hex(),
                })
                off += 16
            return logs
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取日志超时")

    async def disconnect(self):
        """断开与先河环保设备的连接"""
        if self._writer:
            try:
                self._writer.write(self._FRAME_HEADER + bytes([0xFF]))
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("先河环保断开异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def read_firmware_hash(self) -> Optional[str]:
        await self._ensure_connected()
        try:
            resp = await self._cmd(0x1F)
            if len(resp) >= 36:
                import hashlib
                return hashlib.sha256(resp[4:36]).hexdigest()
            return None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        await self._ensure_connected()
        menus = []
        try:
            resp = await self._cmd(0x80)
            if resp and len(resp) > 4 and resp[3] == 0x80:
                menus.append("工程模式 (func=0x80)")
            resp = await self._cmd(0x81)
            if resp and len(resp) > 4 and resp[3] == 0x81:
                menus.append("校准参数调试 (func=0x81)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        await self._ensure_connected()
        try:
            resp = await self._cmd(0x14)
            return bool(resp[4] & 0x01) if len(resp) >= 5 else False
        except Exception:
            return False
