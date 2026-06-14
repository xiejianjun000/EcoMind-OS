# ECO-Audit V3.0 协议适配库 - 品牌清单

> 版本: V3.0
> 更新日期: 2026-06-14
> 适配库路径: `backend/protocol_adapters/`

---

## 概述

本适配库支持 **15 个主流品牌** 的环境监测分析仪/数采仪，覆盖国内 10 个品牌和国际 5 个品牌。

所有适配器统一继承 `ProtocolAdapter` 基类，实现以下接口：

| 接口方法 | 用途 | 关联审计规则 |
|----------|------|-------------|
| `connect()` | 建立设备连接 | - |
| `read_parameters()` | 读取校准参数（斜率/截距/量程） | R004 全参数一致性快检 |
| `read_internal_data()` | 读取内部原始数据 | R007 双套算法检测 |
| `read_status()` | 读取设备运行状态 | R005 数据保持/恒值输出 |
| `read_logs()` | 读取操作日志 | R003 日志完整性扫描 |
| `disconnect()` | 断开连接 | - |
| `read_firmware_hash()` | 读取固件哈希 | R011 固件校验 |
| `check_hidden_menu()` | 检测隐藏菜单 | R001 隐藏菜单扫描 |
| `check_data_hold()` | 检测数据保持功能 | R005 数据保持审计 |

---

## 国内品牌 (10个)

### 1. 力控 (PolyControl / SunCreate)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `polycontrol.py` |
| 支持型号 | SunCreate-CEMS-3000, SunCreate-CEMS-5000, SunCreate-WQMS-2000 |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:8502), modbus_tcp |
| 通信协议 | 自定义二进制协议 (0xAA 0x55 帧头) |
| 已知限制 | 部分老旧型号不支持固件哈希读取 |

### 2. 聚光科技 (FPI)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `fpi.py` |
| 支持型号 | CEMS-2000, CEMS-3000, Model 3000, VOCs-3000 |
| 连接方式 | serial (RS-232/RS-485, 9600bps), ethernet (TCP:5020), modbus_tcp (TCP:502) |
| 通信协议 | 自定义二进制 (0x1B 同步头) + Modbus |
| 已知限制 | VOCs-3000 型号的内部数据寄存器地址可能与文档不一致 |

### 3. 雪迪龙 (SDL)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `sdl.py` |
| 支持型号 | SDL-CEMS-200, SDL-CEMS-300, SDL-VOCs-100, SDL-WQMS-200 |
| 连接方式 | serial (RS-232/RS-485, 9600bps), ethernet (TCP:8080), modbus_tcp |
| 通信协议 | HJ 212-2017/2025 兼容协议 |
| 已知限制 | 登录密码默认为 123456，部分设备可能已修改 |

### 4. 中科天融 (Zhongke Tianrong)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `zhongke_tianrong.py` |
| 支持型号 | ZKTR-CEMS-100, ZKTR-WQMS-100, ZKTR-VOCs-100 |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:9000) |
| 通信协议 | 自定义二进制 (0x7E 帧头) |
| 已知限制 | 不支持 Modbus TCP |

### 5. 蓝盾光电 (Landun)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `landun.py` |
| 支持型号 | LD-CEMS-600, LD-CEMS-800, LD-GAS-300 |
| 连接方式 | serial (RS-232/RS-485, 19200bps), ethernet (TCP:7000), modbus_tcp |
| 通信协议 | 自定义二进制 (STX/LD/ETX 帧格式) |
| 已知限制 | LD-GAS-300 型号的波特率可能为 38400bps |

### 6. 先河环保 (Sailhero)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `sailhero.py` |
| 支持型号 | SH-CEMS-1000, SH-CEMS-2000, SH-AQMS-1000, SH-WQMS-1000 |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:6001), modbus_tcp |
| 通信协议 | 自定义二进制 (0x68 0x53 0x48 帧头) |
| 已知限制 | SH-AQMS-1000 型号的日志格式可能不同 |

### 7. 宇星科技 (Yuxing)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `yuxing.py` |
| 支持型号 | YX-CEMS-500, YX-WQMS-300, YX-VOCs-200 |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:7070), modbus_tcp |
| 通信协议 | 自定义二进制 (0xAB 帧头) |
| 已知限制 | 部分设备需要额外的身份验证步骤 |

### 8. 皖仪科技 (Wanyi)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `wanyi.py` |
| 支持型号 | WY-CEMS-100, WY-WQMS-100, WY-LC-3100 |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:8800), modbus_tcp |
| 通信协议 | ASCII 命令模式 (WY 前缀) |
| 已知限制 | 实验室仪器 WY-LC-3100 的协议可能与在线监测型号不同 |

### 9. 中兴仪器 (Zhongxing)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `zhongxing.py` |
| 支持型号 | ZX-CEMS-300, ZX-GA-200, ZX-NGA-200 |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:8600), modbus_tcp |
| 通信协议 | 自定义二进制 (0x5A 0x58 帧头) |
| 已知限制 | 多组分型号 (ZX-NGA-200) 需要分别读取各通道参数 |

### 10. 青岛众瑞 (Zhongrui)

| 项目 | 详情 |
|------|------|
| 适配器文件 | `zhongrui.py` |
| 支持型号 | ZR-CEMS-200, ZR-3000, ZR-5000 |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:8200), modbus_tcp |
| 通信协议 | 自定义二进制 (0xFD 帧头) |
| 已知限制 | ZR-5000 水质型号的参数读取格式与烟气型号不同 |

---

## 国际品牌 (5个)

### 11. Thermo Fisher

| 项目 | 详情 |
|------|------|
| 适配器文件 | `thermo_fisher.py` |
| 支持型号 | 43i, 42i, 1405e, 48i, 49i |
| 连接方式 | serial (RS-232, 9600bps), ethernet (TCP:9001), modbus_tcp |
| 通信协议 | ASCII 命令/响应模式 |
| 已知限制 | 部分老型号 (如 43i 早期版本) 不支持远程参数修改 |

### 12. Siemens

| 项目 | 详情 |
|------|------|
| 适配器文件 | `siemens.py` |
| 支持型号 | Ultramat 23, Ultramat 6, Calomat 6, LDS 6, SITRANS CW |
| 连接方式 | serial (RS-232/RS-485), ethernet (S7 TCP:102), modbus_tcp (TCP:502) |
| 通信协议 | Modbus TCP/RTU + S7 协议 |
| 已知限制 | Ultramat 23 的 Modbus 寄存器地址需参考具体型号的文档 |

### 13. ABB

| 项目 | 详情 |
|------|------|
| 适配器文件 | `abb.py` |
| 支持型号 | EL3020, AO2000, AZ20, Advance Optima |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:8000), modbus_tcp |
| 通信协议 | Modbus TCP + ASCII 命令 |
| 已知限制 | AO2000 模块化系统需要针对每个模块单独通信 |

### 14. Horiba

| 项目 | 详情 |
|------|------|
| 适配器文件 | `horiba.py` |
| 支持型号 | PG-250, PG-350, ENDA-55, APDA-370, APNA-370 |
| 连接方式 | serial (RS-232, 9600bps), ethernet (TCP:10001), modbus_tcp |
| 通信协议 | STX/CMD/ETX/BCC 帧格式 + Modbus |
| 已知限制 | 便携式型号 (PG-250/PG-350) 可能不支持以太网连接 |

### 15. Emerson

| 项目 | 详情 |
|------|------|
| 适配器文件 | `emerson.py` |
| 支持型号 | X-Stream, Rosemount NGC, Rosemount 6888, Micro Motion |
| 连接方式 | serial (RS-232/RS-485), ethernet (TCP:5000), modbus_tcp |
| 通信协议 | Modbus TCP + 自定义二进制 (EM 帧头) |
| 已知限制 | Rosemount 6888 氧化锆型号的内部数据格式与 X-Stream 不同 |

---

## 默认端口汇总

| 品牌 | 默认 TCP 端口 | 默认串口波特率 |
|------|--------------|---------------|
| 力控 | 8502 | 9600 |
| 聚光科技 | 5020 | 9600 |
| 雪迪龙 | 8080 | 9600 |
| 中科天融 | 9000 | 9600 |
| 蓝盾光电 | 7000 | 19200 |
| 先河环保 | 6001 | 9600 |
| 宇星科技 | 7070 | 9600 |
| 皖仪科技 | 8800 | 9600 |
| 中兴仪器 | 8600 | 9600 |
| 青岛众瑞 | 8200 | 9600 |
| Thermo Fisher | 9001 | 9600 |
| Siemens | 502 (Modbus) | 9600 |
| ABB | 8000 | 9600 |
| Horiba | 10001 | 9600 |
| Emerson | 5000 | 9600 |

---

## 依赖安装

```bash
# 串口通信
pip install pyserial-asyncio

# Modbus 通信
pip install pymodbus

# 适配库核心（无额外依赖）
# 仅使用 Python 3.10+ 标准库 + asyncio
```

---

## 使用示例

```python
import asyncio
from protocol_adapters.registry import AdapterRegistry

async def main():
    registry = AdapterRegistry()
    
    # 方式1: 自动发现 + 按品牌创建
    registry.auto_discover()
    print(f"已注册 {registry.brand_count} 个品牌")
    
    adapter = registry.create_adapter(
        "聚光科技",
        host="192.168.1.100",
        port=5020,
    )
    
    await adapter.connect()
    
    # 读取数据
    params = await adapter.read_parameters()
    data = await adapter.read_internal_data()
    status = await adapter.read_status()
    logs = await adapter.read_logs()
    
    # ECO-Audit 审计专用
    fw_hash = await adapter.read_firmware_hash()
    hidden = await adapter.check_hidden_menu()
    data_hold = await adapter.check_data_hold()
    
    await adapter.disconnect()

asyncio.run(main())
```
