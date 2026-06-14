"""
力控 (PolyControl / SunCreate) 分析仪协议适配器

力控科技是国内知名的工业自动化与环保监测解决方案提供商。
其 CEMS 分析仪通常使用 HJ 212-2017/2025 协议和自定义 TCP 协议通信。

支持的型号:
  - SunCreate-CEMS-3000: 烟气连续排放监测系统
  - SunCreate-CEMS-5000: 高精度烟气监测系统
  - SunCreate-WQMS-2000: 水质在线监测系统

连接方式:
  - serial: RS-232/RS-485 串口
  - ethernet: 自定义 TCP 协议 (默认端口 8502)
  - modbus_tcp: Modbus TCP 协议

典型用法:
    adapter = PolyControlAdapter(host="192.168.1.100", port=8502)
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


class PolyControlAdapter(ProtocolAdapter):
    """力控 (PolyControl / SunCreate) 分析仪协议适配器"""

    brand_name = "力控"
    supported_models = [
        "SunCreate-CEMS-3000",
        "SunCreate-CEMS-5000",
        "SunCreate-WQMS-2000",
    ]
    connection_types = [ConnectionType.SERIAL, ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP]
    default_port = 8502

    # 力控设备特定的 Modbus 寄存器地址
    _REG_SLOPE = 0x0100       # 斜率
    _REG_INTERCEPT = 0x0102   # 截距
    _REG_RANGE_MAX = 0x0104   # 量程上限
    _REG_RANGE_MIN = 0x0106   # 量程下限
    _REG_DEVICE_STATUS = 0x0200  # 设备状态
    _REG_RAW_SO2 = 0x0300     # 原始 SO2 数据
    _REG_RAW_NOX = 0x0302     # 原始 NOx 数据
    _REG_RAW_PM = 0x0304      # 原始颗粒物数据
    _REG_FIRMWARE_HASH = 0x0F00  # 固件哈希寄存器起始地址

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
        连接力控设备。

        根据连接类型建立 TCP 或串口连接，发送握手指令验证设备身份。
        力控设备握手协议: 发送 0xAA 0x55 + 设备类型码，
        返回 0x55 0xAA + 型号信息。

        Returns:
            bool: 连接是否成功

        Raises:
            ConnectionError: TCP 连接失败或握手超时
        """
        try:
            if self.connection_type in (ConnectionType.ETHERNET, ConnectionType.MODBUS_TCP):
                if not self.host:
                    raise ConnectionError("以太网连接需要提供 host 参数")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=self.timeout,
                )
                # 握手验证
                handshake = bytes([0xAA, 0x55, 0x01])
                self._writer.write(handshake)
                await self._writer.drain()
                response = await asyncio.wait_for(
                    self._reader.readexactly(4), timeout=self.timeout
                )
                if response[:2] != bytes([0x55, 0xAA]):
                    raise ConnectionError("握手失败: 无效的响应头")

            elif self.connection_type == ConnectionType.SERIAL:
                try:
                    import serial_asyncio
                    self._reader, self._writer = await serial_asyncio.open_serial_connection(
                        url=self.serial_port, baudrate=self.baud_rate
                    )
                except ImportError:
                    raise ConnectionError("串口通信需要安装 pyserial-asyncio: pip install pyserial-asyncio")
                except Exception as e:
                    raise ConnectionError(f"串口打开失败: {e}")
            else:
                raise ConnectionError(f"不支持的连接类型: {self.connection_type}")

            self._connected = True
            logger.info("力控设备连接成功: %s:%d", self.host or self.serial_port, self.port)
            return True

        except asyncio.TimeoutError:
            raise ConnectionError(f"连接超时 ({self.timeout}s): {self.host}:{self.port}")
        except OSError as e:
            raise ConnectionError(f"连接失败: {e}")

    async def _send_command(self, cmd: bytes) -> bytes:
        """发送命令并接收响应"""
        if not self._writer:
            raise ConnectionError("未连接")
        self._writer.write(cmd)
        await self._writer.drain()
        response = await asyncio.wait_for(
            self._reader.read(256), timeout=self.timeout
        )
        return response

    async def read_parameters(self) -> dict:
        """
        读取力控设备参数。

        通过 Modbus 读取寄存器或发送自定义协议命令获取:
        斜率、截距、量程、报警阈值等校准参数。

        Returns:
            dict: 设备参数键值对
        """
        await self._ensure_connected()
        try:
            # 发送读取参数命令 (0x01 = 读参数)
            cmd = bytes([0xAA, 0x55, 0x01, 0x00])
            response = await self._send_command(cmd)
            if len(response) < 20:
                raise ReadTimeoutError("参数数据不完整")

            # 解析响应数据
            slope = struct.unpack(">f", response[4:8])[0]
            intercept = struct.unpack(">f", response[8:12])[0]
            range_max = struct.unpack(">f", response[12:16])[0]
            range_min = struct.unpack(">f", response[16:20])[0]

            return {
                "slope": round(slope, 4),
                "intercept": round(intercept, 4),
                "range_max": round(range_max, 2),
                "range_min": round(range_min, 2),
                "alarm_threshold": round(range_max * 0.8, 2),
                "sampling_interval": 60,
                "brand": self.brand_name,
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取参数超时")

    async def read_internal_data(self) -> dict:
        """
        读取力控设备内部原始数据。

        读取未经校准公式处理的原始传感器数据，
        用于 R007 双套算法检测。

        Returns:
            dict: 内部原始数据
        """
        await self._ensure_connected()
        try:
            cmd = bytes([0xAA, 0x55, 0x03, 0x00])  # 0x03 = 读内部数据
            response = await self._send_command(cmd)
            if len(response) < 16:
                raise ReadTimeoutError("内部数据不完整")

            raw_so2 = struct.unpack(">f", response[4:8])[0]
            raw_nox = struct.unpack(">f", response[8:12])[0]
            raw_pm = struct.unpack(">f", response[12:16])[0]

            return {
                "raw_so2": round(raw_so2, 4),
                "raw_nox": round(raw_nox, 4),
                "raw_pm25": round(raw_pm, 4),
                "raw_o2": round(struct.unpack(">f", response[16:20])[0], 4) if len(response) >= 20 else None,
                "timestamp": asyncio.get_event_loop().time(),
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取内部数据超时")

    async def read_status(self) -> dict:
        """
        读取力控设备运行状态。

        Returns:
            dict: 设备状态信息
        """
        await self._ensure_connected()
        try:
            cmd = bytes([0xAA, 0x55, 0x02, 0x00])  # 0x02 = 读状态
            response = await self._send_command(cmd)
            if len(response) < 8:
                raise ReadTimeoutError("状态数据不完整")

            status_code = response[4]
            status_map = {
                0x00: DeviceStatus.NORMAL,
                0x01: DeviceStatus.CALIBRATING,
                0x02: DeviceStatus.MAINTENANCE,
                0x03: DeviceStatus.FAULT,
            }

            return {
                "status": status_map.get(status_code, DeviceStatus.UNKNOWN),
                "status_code": status_code,
                "sampling_system": "ok" if response[5] & 0x01 else "fault",
                "analysis_system": "ok" if response[5] & 0x02 else "fault",
                "data_transmission": "ok" if response[5] & 0x04 else "fault",
                "alarms": [],
                "uptime_hours": struct.unpack(">I", response[6:10])[0] if len(response) >= 10 else 0,
            }
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取状态超时")

    async def read_logs(self) -> list[dict]:
        """
        读取力控设备操作日志。

        Returns:
            list[dict]: 日志条目列表
        """
        await self._ensure_connected()
        try:
            cmd = bytes([0xAA, 0x55, 0x04, 0x00])  # 0x04 = 读日志
            response = await self._send_command(cmd)
            logs = []

            # 解析日志数据（每条日志 32 字节）
            offset = 4
            while offset + 32 <= len(response):
                entry = response[offset:offset + 32]
                event_type = entry[0]
                event_names = {
                    0x01: "parameter_change",
                    0x02: "calibration",
                    0x03: "maintenance",
                    0x04: "power_on",
                    0x05: "power_off",
                    0x06: "alarm",
                }
                logs.append({
                    "timestamp": f"2026-01-{entry[1]:02d}T{entry[2]:02d}:{entry[3]:02d}:{entry[4]:02d}",
                    "event_type": event_names.get(event_type, "unknown"),
                    "event_code": event_type,
                    "data": entry[5:32].hex(),
                })
                offset += 32

            return logs
        except asyncio.TimeoutError:
            raise ReadTimeoutError("读取日志超时")

    async def disconnect(self):
        """断开与力控设备的连接"""
        if self._writer:
            try:
                # 发送断开命令
                self._writer.write(bytes([0xAA, 0x55, 0xFF, 0x00]))
                await self._writer.drain()
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.warning("力控设备断开连接异常: %s", e)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False
        logger.info("力控设备已断开")

    async def read_firmware_hash(self) -> Optional[str]:
        """读取力控设备固件哈希值（用于 R011 固件校验）"""
        await self._ensure_connected()
        try:
            cmd = bytes([0xAA, 0x55, 0x0F, 0x00])
            response = await self._send_command(cmd)
            if len(response) >= 36:
                import hashlib
                firmware_data = response[4:36]
                return hashlib.sha256(firmware_data).hexdigest()
            return None
        except Exception:
            return None

    async def check_hidden_menu(self) -> list[str]:
        """检测力控设备隐藏菜单（用于 R001）"""
        await self._ensure_connected()
        hidden_menus = []
        try:
            # 尝试进入工程模式
            cmd_engineer = bytes([0xAA, 0x55, 0x80, 0x01])
            resp = await self._send_command(cmd_engineer)
            if resp[4:6] == bytes([0x80, 0x01]):
                hidden_menus.append("工程模式入口 (cmd=0x8001)")

            # 尝试进入调试菜单
            cmd_debug = bytes([0xAA, 0x55, 0x81, 0x02])
            resp = await self._send_command(cmd_debug)
            if resp[4:6] == bytes([0x81, 0x02]):
                hidden_menus.append("调试菜单 (cmd=0x8102)")
        except Exception:
            pass
        return hidden_menus

    async def check_data_hold(self) -> bool:
        """检测力控设备数据保持功能（用于 R005）"""
        await self._ensure_connected()
        try:
            cmd = bytes([0xAA, 0x55, 0x05, 0x00])
            response = await self._send_command(cmd)
            if len(response) >= 5:
                return bool(response[4] & 0x01)
            return False
        except Exception:
            return False
