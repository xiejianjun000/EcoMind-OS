# 门神 Skill (Guardian) — 只读保护与基线校验智能体

> ECO-Audit V3.0 五智能体架构 · Agent 4

---

## 1. Skill 名称和描述

**名称**: `eco-audit/guardian-skill`
**代号**: 门神 (Guardian)
**描述**: ECO-Audit 系统的"安全基石"。作为独立 systemd 服务运行，负责使用 `blockdev --setro` 只读挂载目标磁盘，对关键文件进行 SHA256 校验比对"黄金基线"，并提供心跳监控。所有其他智能体的审计操作必须在 Guardian 建立的只读环境中执行。

**核心设计理念**: "铁证如山" —— 从源头确保审计数据的完整性与不可篡改性，为后续所有分析提供可信基础。

---

## 2. 触发条件

| 触发场景 | 示例 |
|----------|------|
| U盘插入启动 | 审计 U 盘插入目标工控机，自动启动 |
| systemd 服务启动 | `systemctl start eco-audit-guardian` |
| 用户手动触发只读挂载 | "启动门神保护"、"设置只读挂载" |
| 基线校验请求 | "校验黄金基线"、"检查文件完整性" |

---

## 3. 核心能力清单

### 3.1 只读挂载管理
- **磁盘只读锁定**: 使用 `blockdev --setro` 设置目标块设备为只读模式
- **只读验证**: 周期性验证只读状态未被绕过或修改
- **挂载点管理**: 自动识别并挂载目标分区（系统分区、数据分区、日志分区）
- **LUKS 解密支持**: 支持加密分区的只读解密挂载

### 3.2 黄金基线校验
- **SHA256 文件完整性**: 对关键系统文件计算 SHA256 哈希值
- **基线比对**: 与预存的"黄金基线"哈希表逐一对比
- **偏差告警**: 任何偏离基线的文件立即标记并记录
- **基线更新**: 管理员审核后支持基线更新（需物理写保护开关切换）

### 3.3 心跳监控
- **服务健康心跳**: 每 30 秒输出一次心跳信号
- **审计进度追踪**: 实时追踪哨兵/神探/专家的执行状态
- **异常中断检测**: 检测审计流程异常中断，自动保存当前状态
- **资源监控**: 监控 CPU/内存/磁盘 I/O，超限告警

### 3.4 安全审计
- **USB 设备识别**: 记录审计 U 盘插入时间和设备信息
- **操作日志**: 记录所有审计操作的开始/结束时间和结果
- **权限验证**: 验证执行用户权限，非授权操作拒绝执行
- **写保护验证**: 定期验证物理写保护开关状态

---

## 4. 工作流程

```
┌─────────────────────────────────────────────────────────┐
│                    门神工作流程                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: 服务启动初始化                                    │
│  ├─ systemd 服务激活                                     │
│  ├─ 识别目标磁盘设备（/dev/sdX）                            │
│  ├─ 验证物理写保护开关状态                                 │
│  └─ 记录启动时间戳                                        │
│                                                         │
│  Step 2: 只读挂载                                        │
│  ├─ blockdev --setro /dev/sdX                          │
│  ├─ mount -o ro /dev/sdX1 /mnt/target_sys               │
│  ├─ mount -o ro /dev/sdX2 /mnt/target_data              │
│  ├─ mount -o ro /dev/sdX3 /mnt/target_logs              │
│  └─ 验证只读状态：blockdev --getro6 /dev/sdX              │
│                                                         │
│  Step 3: 黄金基线校验                                     │
│  ├─ 加载黄金基线哈希表（baseline_sha256.json）               │
│  ├─ 对基线文件逐一对比 SHA256                              │
│  ├─ 标记偏离文件（新增/缺失/哈希不匹配）                      │
│  └─ 生成基线校验报告                                      │
│                                                         │
│  Step 4: 心跳循环（持续运行）                                │
│  ├─ 每 30 秒输出心跳信号                                   │
│  ├─ 检查只读状态是否仍然有效                                │
│  ├─ 监控子智能体执行状态                                   │
│  └─ 记录资源使用情况                                      │
│                                                         │
│  Step 5: 审计完成清理                                      │
│  ├─ 等待所有子智能体完成                                    │
│  ├─ 生成最终完整性报告                                     │
│  ├─ 卸载只读分区                                         │
│  └─ blockdev --setrw /dev/sdX（仅管理员授权）               │
│                                                         │
│  🔒 运行模式: 独立 systemd 服务                            │
│  📡 心跳间隔: 30 秒                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 依赖的其他 Skill/工具

| 依赖项 | 类型 | 说明 |
|--------|------|------|
| `sentry-skill` | 下游依赖 | 只读挂载完成后触发哨兵扫描 |
| systemd | 运行环境 | 作为独立系统服务运行 |
| `lib/baseline_sha256.json` | 核心数据 | 黄金基线哈希表 |
| `lib/legal_knowledge_base.json` | 间接依赖 | 法规合规性参考 |

---

## 6. 输出格式

### 6.1 只读挂载状态（JSON）

```json
{
  "agent": "guardian",
  "status": "active",
  "timestamp": "2026-06-14T15:55:00+08:00",
  "readonly_mounts": [
    {
      "device": "/dev/sdb1",
      "mount_point": "/mnt/target_sys",
      "readonly": true,
      "filesystem": "ext4"
    },
    {
      "device": "/dev/sdb2",
      "mount_point": "/mnt/target_data",
      "readonly": true,
      "filesystem": "ntfs"
    }
  ],
  "baseline_check": {
    "total_files_checked": 1847,
    "files_matching_baseline": 1842,
    "files_deviating": 3,
    "files_new": 2,
    "deviations": [
      {
        "file_path": "/mnt/target_sys/Windows/System32/drivers/data_intercept.sys",
        "status": "new",
        "sha256_current": "a1b2c3d4...",
        "sha256_baseline": "N/A (not in baseline)"
      }
    ]
  },
  "heartbeat": {
    "last_heartbeat": "2026-06-14T15:55:30+08:00",
    "uptime_seconds": 127,
    "readonly_verified": true
  }
}
```

### 6.2 systemd 服务配置

```ini
# /etc/systemd/system/eco-audit-guardian.service
[Unit]
Description=ECO-Audit Guardian - Readonly Mount & Baseline Verification
After=local-fs.target
Before=eco-audit-sentry.service

[Service]
Type=simple
ExecStart=/opt/eco-audit/bin/guardian --readonly --baseline-verify
Restart=on-failure
RestartSec=5
User=root
ReadOnlyPaths=/opt/eco-audit/data/
CapabilityBoundingSet=CAP_SYS_ADMIN CAP_DAC_READ_SEARCH

[Install]
WantedBy=multi-user.target
```

---

## 7. 关联的规则 ID 列表

门神 Skill 不直接执行审计规则，而是为其他 Skill 提供安全运行环境。以下规则的执行**依赖门神的只读挂载和基线校验**：

| 规则ID | 规则名称 | 依赖说明 |
|--------|----------|----------|
| R001 | 分析仪/工控机隐藏菜单与后门扫描 | 需在只读环境下扫描文件 |
| R002 | 进程白名单与可疑进程扫描 | 需在只读环境下读取进程列表 |
| R003 | 电子记录/日志完整性深度扫描 | 需在只读环境下扫描日志文件 |
| R010 | 设备认证与铭牌一致性校验 | 需读取原始认证文件 |
| R011 | 非法修改程序固件检测 | 需读取原始固件文件进行哈希校验 |
| R025 | 软件升级/固件更新记录审计 | 需读取系统升级日志 |
| R099 | 历史数据回填/篡改痕迹检测 | 需读取原始文件系统元数据 |
| R117 | 站房门禁/入侵检测合规性 | 需读取门禁日志文件 |
| R145 | 运维台账完整性和一致性校验 | 需读取原始运维台账文件 |
| R153 | 系统软件备份与恢复能力 | 需验证备份文件完整性 |
| R160 | 系统退役/报废数据归档合规性 | 需读取归档文件 |

**直接影响规则: 11 条**
**间接影响规则: 全部 ~200 条**（所有规则的执行都依赖 Guardian 提供的安全环境）

---

## 8. 适用审计模式

| 模式 | 是否适用 | 说明 |
|------|----------|------|
| 快速 | ✅ | 基础只读挂载 + 快速基线校验（前 500 个文件） |
| 标准 | ✅ | 完整只读挂载 + 全部基线文件校验 |
| 完整 | ✅ | 完整只读挂载 + 全部基线校验 + LUKS 解密验证 + 资源监控 |

---

## 9. 与其他智能体的协作关系

```
Guardian (门神) ──只读挂载完成──→ Sentry (哨兵) ──→ Sherlock (神探) ──→ Expert (专家)
     │
     └── 心跳监控 ──→ 所有子智能体
     │
     └── 基线校验 ──→ 法规合规性参考
```

- **上游**: 无（独立启动，作为审计流程的第一个环节）
- **下游**: 触发哨兵扫描，为所有后续智能体提供安全环境
- **并行**: 持续心跳监控，确保只读状态在整个审计过程中保持

---

## 10. 注意事项

1. **root 权限**: `blockdev --setro` 需要 root 权限，systemd 服务必须以 root 运行
2. **物理写保护**: 建议审计 U 盘配备物理写保护开关，双重保障
3. **基线管理**: 黄金基线应存储在加密分区中，防止被篡改
4. **紧急退出**: 检测到系统异常时，自动保存当前状态并安全卸载
5. **日志保护**: Guardian 自身的操作日志写入审计 U 盘的独立分区，不受只读挂载影响
