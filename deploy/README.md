# ECO-Audit V3.0 部署文档

> 文档版本: V3.0-Phase1  
> 更新日期: 2026-06-14  
> 适用对象: 部署工程师、系统管理员

---

## 目录

1. [U盘制作步骤](#1-u盘制作步骤)
2. [首次启动配置](#2-首次启动配置)
3. [审计流程说明](#3-审计流程说明)
4. [常见问题排查](#4-常见问题排查)
5. [目录结构](#5-目录结构)

---

## 1. U盘制作步骤

### 1.1 准备工作

**硬件要求:**
- ≥64GB 工业级U盘（SLC/MLC颗粒）
- USB 3.0+ 接口
- 带物理写保护开关（推荐）

**软件依赖:**
```bash
# Ubuntu/Debian
sudo apt install -y parted e2fsprogs exfat-fuse exfat-utils cryptsetup rsync

# Ventoy (手动安装)
# 下载地址: https://github.com/ventoy/Ventoy/releases
# 推荐版本: v1.0.97+
```

**ISO 文件准备:**
```bash
mkdir -p ./iso

# Ubuntu 22.04 Live Server
wget -O iso/ubuntu-22.04.3-live-server-amd64.iso \
  "https://releases.ubuntu.com/22.04.3/ubuntu-22.04.3-live-server-amd64.iso"

# WinPE (可选，用于Windows环境取证)
# 请自行准备 WinPE 审计镜像
```

### 1.2 制作流程

```bash
# 1. 确认U盘设备（⚠ 务必仔细确认，避免误操作系统盘）
lsblk
# 假设识别为 /dev/sdX

# 2. 预演模式（推荐先运行一次确认操作）
sudo ./make_usb.sh --dry-run /dev/sdX

# 3. 正式制作
sudo ./make_usb.sh /dev/sdX

# 制作过程中将:
#   ✓ 安装 Ventoy 引导管理器
#   ✓ 创建 4 个分区 (FAT32 / ext4 / exFAT / LUKS)
#   ✓ 复制 Ubuntu ISO 到启动分区
#   ✓ 格式化并配置持久化分区
#   ✓ 生成 SHA256 黄金基线
```

### 1.3 分区布局

| 分区 | 文件系统 | 容量 | 用途 | 卷标 |
|------|----------|------|------|------|
| 1 | FAT32 | 4GB | Ventoy引导 + ISO镜像 | ECOAUDIT_BOOT |
| 2 | ext4 | 8GB | 系统脚本/审计引擎/模型 | ECOAUDIT_PERSIST |
| 3 | exFAT | 16GB | 审计报告输出（跨平台可读） | ECOAUDIT_OUTPUT |
| 4 | LUKS | 剩余 | 加密证据存储 | ECOAUDIT_EVIDENCE |

---

## 2. 首次启动配置

### 2.1 从U盘启动

1. 将制作好的U盘插入目标工控机
2. 重启工控机，进入 BIOS 设置U盘为第一启动项
3. 保存并重启，选择 Ubuntu 22.04 Live Server

### 2.2 挂载持久化分区

```bash
# U盘启动后，持久化分区已包含部署文件
sudo mount /dev/sdX2 /mnt  # sdX2 为 ext4 分区

# 验证文件
ls /mnt/opt/ecomind/scripts/
ls /mnt/opt/ecomind/baseline.sha256
```

### 2.3 安装服务

```bash
# 复制 systemd 服务配置
sudo cp /mnt/etc/systemd/system/*.service /etc/systemd/system/

# 复制脚本到系统路径
sudo cp -r /mnt/opt/ecomind /opt/ecomind
sudo chmod +x /opt/ecomind/scripts/*.sh /opt/ecomind/scripts/*.py

# 重新生成基线（如果文件有变化）
cd /opt/ecomind && find . -type f -exec sha256sum {} \; > baseline.sha256
```

### 2.4 配置飞书通知（可选）

```bash
# 编辑环境变量
sudo tee -a /etc/systemd/system/openclaw-audit.service.d/override.conf <<'EOF'
[Service]
Environment="FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_HOOK_ID"
Environment="FEISHU_SECRET=YOUR_SECRET_KEY"
EOF

sudo systemctl daemon-reload
```

### 2.5 启动服务

```bash
# 启动顺序: Guardian → Hermes API → OpenClaw Audit
sudo systemctl enable --now guardian.service
sudo systemctl enable --now hermes-api.service
sudo systemctl enable --now openclaw-audit.service

# 检查状态
sudo systemctl status guardian.service
sudo systemctl status hermes-api.service
sudo systemctl status openclaw-audit.service
```

### 2.6 验证

```bash
# 查看门神日志
journalctl -u guardian.service -f

# 查看审计服务日志
journalctl -u openclaw-audit.service -f

# 手动执行一次健康检查
/opt/ecomind/scripts/audit_entry.sh --health-check
```

---

## 3. 审计流程说明

### 3.1 三级审计模式

| 模式 | 规则范围 | 预计耗时 | 内存要求 | LLM推理 |
|------|----------|----------|----------|---------|
| **快速** | R001-R015 | ≤15分钟 | 4-8GB | 无（纯规则引擎） |
| **标准** | R001-R110 | ≤30分钟 | 8-16GB | Qwen2.5-3B |
| **完整** | R001-R200 | ≤60分钟 | 16GB+ | Qwen2.5-7B |

### 3.2 手动执行审计

```bash
# 快速审计
sudo /opt/ecomind/scripts/audit_entry.sh --mode quick

# 标准审计（默认）
sudo /opt/ecomind/scripts/audit_entry.sh --mode standard

# 完整审计（指定目标磁盘）
sudo /opt/ecomind/scripts/audit_entry.sh --mode full --target /dev/sda

# 预演模式
sudo /opt/ecomind/scripts/audit_entry.sh --mode standard --dry-run
```

### 3.3 审计报告

报告输出位置：
```
/opt/ecomind/output/
├── audit_report_standard_YYYYMMDD_HHMMSS.html   # HTML可视化报告
├── audit_result_standard_YYYYMMDD_HHMMSS.json    # JSON结构化结果
└── audit_log_YYYYMMDD.log                        # 运行日志
```

### 3.4 五智能体协同

```
1. Guardian (门神) ─→ 只读挂载 / 基线校验 / 心跳监控
2. Sentry (哨兵)   ─→ 快速扫描 R001-R015
3. Sherlock (神探) ─→ 深度取证 R051-R110
4. Expert (专家)   ─→ 智能研判 R111-R200
5. Librarian (智库) ─→ 法规案例实时检索
```

---

## 4. 常见问题排查

### 4.1 U盘无法引导

```bash
# 检查 Ventoy 是否正确安装
sudo parted /dev/sdX print

# 确认 BIOS 中:
#   - Secure Boot: Disabled (或已添加 Ventoy 密钥)
#   - USB Boot: Enabled
#   - Boot Mode: UEFI (推荐)
```

### 4.2 分区无法挂载

```bash
# 检查分区状态
lsblk -f /dev/sdX

# 手动挂载测试
sudo mount /dev/sdX2 /mnt
mount | grep sdX2

# 文件系统检查
sudo fsck.ext4 -n /dev/sdX2
```

### 4.3 门神服务启动失败

```bash
# 查看日志
journalctl -u guardian.service --no-pager -n 50

# 常见原因:
#   1. 目标磁盘未正确检测 → 设置 TARGET_DISK 环境变量
#   2. 基线文件缺失 → 重新生成 baseline.sha256
#   3. blockdev 权限不足 → 确认以 root 运行

# 手动运行调试
sudo /opt/ecomind/scripts/guardian.sh
```

### 4.4 飞书通知未收到

```bash
# 测试飞书连通性
python3 /opt/ecomind/scripts/feishu_notify.py \
  --action alert \
  --level INFO \
  --message "飞书通知测试"

# 检查环境变量
systemctl show openclaw-audit.service | grep FEISHU

# 检查网络
curl -v "https://open.feishu.cn"  # 确认网络可达
```

### 4.5 LUKS 分区无法解锁

```bash
# 检查 LUKS 状态
sudo cryptsetup isLuks /dev/sdX4

# 解锁加密分区
sudo cryptsetup open /dev/sdX4 ecomind_evidence

# 挂载
sudo mount /dev/mapper/ecomind_evidence /mnt/evidence

# 使用完毕后关闭
sudo umount /mnt/evidence
sudo cryptsetup close ecomind_evidence
```

### 4.6 基线校验失败

```bash
# 查看失败文件
cd /opt/ecomind && sha256sum -c baseline.sha256

# 如果确认是正常更新，重新生成基线
cd /opt/ecomind && find . -type f -not -name "baseline.sha256" -exec sha256sum {} \; > baseline.sha256
```

---

## 5. 目录结构

```
deploy/
├── make_usb.sh                  # U盘制作脚本 (17KB)
├── README.md                    # 本部署文档
├── systemd/
│   ├── guardian.service         # 门神服务配置
│   ├── hermes-api.service       # Hermes API 服务配置
│   └── openclaw-audit.service   # OpenClaw 审计服务配置
└── scripts/
    ├── guardian.sh              # 门神守护脚本 (7KB)
    ├── audit_entry.sh           # 审计入口脚本 (11KB)
    └── feishu_notify.py         # 飞书通知模块 (7KB)
```

---

## 附录

### A. 环境变量一览

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `UBUNTU_ISO` | `./iso/ubuntu-22.04.3-live-server-amd64.iso` | Ubuntu ISO路径 |
| `WINPE_ISO` | `./iso/winpe_audit.iso` | WinPE ISO路径 |
| `VENTOY_DIR` | `./ventoy` | Ventoy安装目录 |
| `VENTOY_VERSION` | `1.0.97` | Ventoy版本 |
| `AUDIT_MODE` | `standard` | 默认审计模式 |
| `AUDIT_RULES_DIR` | `/opt/ecomind/rules` | 规则目录 |
| `AUDIT_OUTPUT_DIR` | `/opt/ecomind/output` | 输出目录 |
| `AUDIT_LOG_DIR` | `/opt/ecomind/logs` | 日志目录 |
| `FEISHU_WEBHOOK` | *(空)* | 飞书Webhook URL |
| `FEISHU_SECRET` | *(空)* | 飞书签名密钥 |
| `TARGET_DISK` | *(自动检测)* | 目标磁盘设备 |
| `GUARDIAN_INTERVAL` | `30` | 心跳间隔(秒) |

### B. 安全注意事项

1. ⚠ **写保护开关**: 审计时务必开启U盘物理写保护
2. ⚠ **基线校验**: Guardian 每次启动都会校验 SHA256 基线
3. ⚠ **证据加密**: 重要证据存储在 LUKS 加密分区
4. ⚠ **日志完整**: 所有操作均有日志记录，不可删除

---

*ECO-Audit V3.0 — 即插即审，深度见底*
