"""
中科天融 (Zhongke Tianrong) 分析仪协议适配器

中科天融是中国科学院旗下环境监测设备制造商。
产品涵盖烟气、水质、VOCs 在线监测。

支持的型号:
  - ZKTR-CEMS-100: 烟气在线监测系统
  - ZKTR-WQMS-100: 水质在线监测系统
  - ZKTR-VOCs-100: VOCs在线监测系统

连接方式:
  - serial: RS-232/RS-485 串口 (默认 9600bps)
  - ethernet: 自定义 TCP 协议 (默认端口 9000)

典型用法:
    adapter = ZhongkeTianrongAdapter(host="192.168.1.100", port=9000)
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


class ZhongkeTianrongAdapter(ProtocolAdapter):
    """中科天融 (Zhongke Tianrong) 分析仪协议适配器"""

    brand_name = "中科天融"
    supported_models = ["ZKTR-CEMS-100", "ZKTR-WQMS-100", "ZKTR-VOCs-100"]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET]
    default_port = 9000

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
        连接中科天融设备。

        握手协议: 发送 0x7E + 站号(2字节) + 0x01(连接请求)，
        接收 0x7E + 站号 + 0x81(连接确认)。

        Returns:
            bool: 连接是否成功
        """
        try:
            if self.connection_type == ConnectionType.ETHERNET:
                if not self.host:
                    raise ConnectionError("以太网连接需要 host")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=self.timeout
                )
                # 握手
                handshake = bytes([0x7E, 0x00, 0x01, 0x01])
                self._writer.write(handshake)
                await self._writer.drain()
                ack = await asyncio.wait_for(
                    self._reader.read(8), timeout=self.timeout
                )
                if not ack or ack[0] != 0x7E or ack[3] != 0x81:
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
            logger.info("中科天融设备连接成功: %s", self.host or self.serial_port)
            return True

        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时: {self.host}:{self.port}")
        except OSError as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _send_cmd(self, cmd_type: int, payload: bytes = b"") -> bytes:
        """发送命令帧: 0x7E + 类型 + 长度 + 数据 + CRC"""
        frame = bytes([0x7E, cmd_type, len(payload)]) + payload
        crc = sum(frame) & 0xFF
        frame += bytes([crc])
        self._writer.write(frame)
        await self._writer.drain()
        resp = await asyncio.wait_for(self._reader.read(512), timeout=self.timeout)
        return resp

    async def read_parameters(self) -> dict:
        """读取中科天融设备参数（斜率/截距/量程）"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd(0x10)  # 读参数
            if len(resp) >= 24:
                slope = struct.unpack(">f", resp[4:8])[0]
                intercept = struct.unpack(">f", resp[8:12])[0]
                range_max = struct.unpack(">f", resp[12:16])[0]
                return {
                    "slope": round(slope, 4),
                    "intercept": round(intercept, 4),
                    "range_max": round(range_max, 2),
                    "range_min": 0.0,
                    "sampling_interval": 60,
                    "brand": self.brand_name,
                }
            return {"slope": 1.0, "intercept": 0.0, "range_max": 100.0}
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """读取中科天融设备内部原始数据"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd(0x11)  # 读内部数据
            if len(resp) >= 20:
                return {
                    "raw_so2": round(struct.unpack(">f", resp[4:8])[0], 4),
                    "raw_nox": round(struct.unpack(">f", resp[8:12])[0], 4),
                    "raw_pm25": round(struct.unpack(">f", resp[12:16])[0], 4),
                    "raw_o2": round(struct.unpack(">f", resp[16:20])[0], 4),
                    "timestamp": asyncio.get_event_loop().time(),
                }
            return {"timestamp": asyncio.get_event_loop().time()}
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """读取中科天融设备状态"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd(0x12)
            if len(resp) >= 6:
                code = resp[4]
                status_map = {0: DeviceStatus.NORMAL, 1: DeviceStatus.CALIBRATING,
                              2: DeviceStatus.MAINTENANCE, 3: DeviceStatus.FAULT}
                return {
                    "status": status_map.get(code, DeviceStatus.UNKNOWN),
                    "status_code": code,
                    "sampling_system": "ok" if resp[5] & 0x01 else "fault",
                    "analysis_system": "ok" if resp[5] & 0x02 else "fault",
                    "alarms": [],
                }
            return {"status": DeviceStatus.UNKNOWN}
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """读取中科天融设备操作日志"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd(0x13)
            logs = []
            offset = 4
            while offset + 20 <= len(resp):
                entry = resp[offset:offset + 20]
                logs.append({
                    "timestamp": f"2026-{entry[0]:02d}-{entry[1]:02d}T{entry[2]:02d}:{entry[3]:02d}",
                    "event_type": ["param_change", "calibration", "maintenance", "alarm"][entry[4]] if entry[4] < 4 else "unknown",
                    "data": entry[5:20].hex(),
                })
                offset += 20
            return logs
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取日志超时")

    async def disconnect(self):
        """断开与中科天融设备的连接"""
        if self._writer:
            try:
                self._writer.write(bytes([0x7E, 0xFF, 0x00, 0xFF]))
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("中科天融断开异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def read_firmware_hash(self) -> Optional[str]:
        """读取中科天融固件哈希"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd(0x1F)
            if len(resp) >= 36:
                import hashlib
                return hashlib.sha256(resp[4:36]).hexdigest()
            return None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        """检测中科天融隐藏菜单"""
        await self._ensure_connected()
        menus = []
        try:
            resp = await self._send_cmd(0x80)
            if resp and len(resp) >= 5 and resp[1] == 0x80:
                menus.append("调试菜单 (cmd=0x80)")
            resp = await self._send_cmd(0x81)
            if resp and len(resp) >= 5 and resp[1] == 0x81:
                menus.append("工程模式 (cmd=0x81)")
        except Exception:
            pass
        return menus

    async def check_data_hold(self) -> bool:
        """检测中科天融数据保持功能"""
        await self._ensure_connected()
        try:
            resp = await self._send_cmd(0x14)
            return bool(resp[4] & 0x01) if len(resp) >= 5 else False
        except Exception:
            return False
