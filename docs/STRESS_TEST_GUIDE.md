# EcoMind OS 压力测试指南

## 📋 目录

1. [测试概述](#1-测试概述)
2. [测试环境要求](#2-测试环境要求)
3. [测试脚本说明](#3-测试脚本说明)
4. [测试执行步骤](#4-测试执行步骤)
5. [测试报告解读](#5-测试报告解读)
6. [性能基准参考](#6-性能基准参考)

---

## 1. 测试概述

### 1.1 测试目标

EcoMind OS 压力测试旨在全面评估系统的性能、稳定性和可靠性，涵盖以下维度：

| 测试维度 | 测试内容 | 目标指标 |
|----------|----------|----------|
| **API性能** | REST API端点响应时间、吞吐量 | P95 < 200ms, RPS > 500 |
| **并发能力** | 多用户并发请求处理 | 支持 100+ 并发用户 |
| **数据一致性** | CRUD操作数据正确性 | 100% 数据一致性 |
| **WebSocket** | 实时通信连接稳定性 | 支持 100+ 并发连接 |
| **Taiji Agent** | 核心模块处理能力 | 10,000+ ops/s |
| **GovMCP** | 政务模块加密/审批性能 | 5,000+ ops/s |
| **内存管理** | 长时间运行内存稳定性 | 内存增长 < 10%/小时 |

### 1.2 测试覆盖范围

```
┌─────────────────────────────────────────────────────────────────┐
│                    EcoMind OS 测试覆盖                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  前端测试     │  │  后端测试     │  │  集成测试     │         │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤         │
│  │ 组件渲染性能  │  │ API端点      │  │ 端到端流程   │         │
│  │ 状态管理     │  │ 数据库操作   │  │ 全链路压测   │         │
│  │ 路由响应     │  │ 缓存操作     │  │ 故障恢复     │         │
│  │ WebSocket    │  │ WebSocket    │  │ 监控告警     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │              核心模块测试                             │        │
│  ├──────────────────────────────────────────────────────┤        │
│  │ Taiji Verify 防幻觉验证    │ GovMCP 政务协议        │        │
│  │ Session Memory 记忆系统    │ Workflow 工作流引擎    │        │
│  │ Tool Registry 工具注册     │ Soul Loader 人格加载   │        │
│  │ Hallucination Detector   │ Hermes Provider        │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 测试类型

| 测试类型 | 说明 | 适用场景 |
|----------|------|----------|
| **基准测试** | 单操作性能基准测量 | 性能评估、回归对比 |
| **压力测试** | 逐步增加负载至系统极限 | 容量规划 |
| **负载测试** | 模拟真实负载水平 | SLA验证 |
| **浸泡测试** | 长时间持续运行 | 稳定性验证 |
| **尖峰测试** | 突发流量冲击 | 韧性测试 |
| **断路恢复** | 故障注入与恢复 | 容错能力 |

---

## 2. 测试环境要求

### 2.1 硬件要求

| 组件 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 4核 | 8核+ |
| 内存 | 8GB | 16GB+ |
| 磁盘 | 50GB SSD | 100GB+ SSD |
| 网络 | 100Mbps | 1Gbps+ |

### 2.2 软件要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Python | 3.11+ | 后端运行环境 |
| Node.js | 22+ | 前端构建环境 |
| pnpm | 11+ | 前端包管理器 |
| pip | 24+ | Python包管理器 |

### 2.3 Python依赖

```bash
# 核心依赖
pip install httpx websockets psutil numpy pytest pytest-asyncio

# Taiji Agent 依赖
cd backend/taiji-agent
pip install -e ".[dev]"
```

### 2.4 环境变量

```bash
# API服务地址 (默认: http://localhost:8000)
export API_BASE_URL=http://localhost:8000

# WebSocket地址 (默认: ws://localhost:8000)
export WS_BASE_URL=ws://localhost:8000

# LLM API Keys (可选，用于真实API测试)
export ANTHROPIC_API_KEY=sk-ant-xxx
export OPENAI_API_KEY=sk-xxx
```

---

## 3. 测试脚本说明

### 3.1 测试脚本清单

| 脚本 | 位置 | 说明 | 运行环境 |
|------|------|------|----------|
| `stress_test_ecomind.py` | `docs/` | 端到端完整压力测试 | API服务运行 |
| `stress_test_mock.py` | `docs/` | 模拟模式压力测试 | 独立运行 |
| `stress_test.py` | `backend/taiji-agent/tests/` | Taiji Agent基准测试 | 独立运行 |
| `stress_test_production.py` | `backend/taiji-agent/tests/` | 生产级压力测试 | 独立运行 |

### 3.2 stress_test_ecomind.py

**功能**：
- 完整的端到端压力测试
- 支持API服务和WebSocket连接测试
- 并发请求测试
- 模拟模式降级

**主要测试用例**：

```python
test_1_health_endpoint()           # 健康检查端点
test_2_agent_crud_operations()       # Agent CRUD操作
test_3_workflow_crud_operations()   # Workflow CRUD操作
test_4_security_operations()        # 安全模块操作
test_5_model_operations()          # 模型管理操作
test_6_concurrent_requests()        # 并发请求测试
test_7_websocket_connections()      # WebSocket连接
test_8_taiji_agent_core()          # Taiji Agent核心
test_9_govmcp_modules()            # GovMCP模块
test_10_memory_pressure()          # 内存压力测试
```

**执行方式**：

```bash
# 前提：启动后端API服务
cd backend/api
uvicorn main:app --reload --port 8000

# 新终端执行压力测试
cd docs
python stress_test_ecomind.py
```

### 3.3 stress_test_mock.py

**功能**：
- 无需API服务即可运行
- 测试核心模块性能
- 模拟数据结构操作
- 并发任务测试

**主要测试用例**：

```python
test_1_data_structures()           # 数据结构操作
test_2_string_operations()          # 字符串操作
test_3_json_operations()            # JSON序列化
test_4_hash_operations()            # 哈希算法
test_5_concurrent_tasks()           # 并发任务
test_6_taiji_verifier()            # Taiji Verify
test_7_hallucination_detector()    # 幻觉检测
test_8_session_memory()            # 会话记忆
test_9_govmcp_crypto()            # 国密算法
test_10_govmcp_workflow()         # 审批工作流
test_11_memory_pressure()         # 内存压力
test_12_soul_loader()              # Soul加载
test_13_tool_registry()            # 工具注册
```

**执行方式**：

```bash
cd docs
python stress_test_mock.py
```

---

## 4. 测试执行步骤

### 4.1 完整端到端测试流程

```bash
# Step 1: 环境准备
# ============

# 克隆项目
git clone https://github.com/xiejianjun000/EcoMind-OS.git
cd EcoMind-OS

# 安装前端依赖
cd frontend
pnpm install

# 安装后端依赖
cd ../backend/taiji-agent
pip install -e ".[all]"

# Step 2: 启动服务
# ============

# 终端1: 启动后端API
cd backend/api
uvicorn main:app --host 0.0.0.0 --port 8000

# 终端2: 启动前端 (可选)
cd frontend
pnpm dev

# Step 3: 执行压力测试
# ====================

# 终端3: 运行端到端测试
cd docs
python stress_test_ecomind.py

# Step 4: 查看报告
# ================

# 查看JSON报告
cat docs/ecomind_stress_test_report.json

# 查看HTML报告 (如有)
open docs/stress_test_report.html
```

### 4.2 模拟模式测试流程

```bash
# 无需启动服务，直接运行
cd EcoMind-OS/docs
python stress_test_mock.py
```

### 4.3 Taiji Agent 专项测试

```bash
cd backend/taiji-agent/tests

# 基础压力测试
python stress_test.py

# 生产级压力测试
python stress_test_production.py

# pytest测试套件
pytest tests/ -v
```

### 4.4 测试执行参数

#### 压力测试参数调整

```python
# 在 stress_test_ecomind.py 中调整

# API端点测试
iterations = 500          # 单端点迭代次数
concurrent_levels = [10, 25, 50]  # 并发级别

# WebSocket测试
test_connections = 50    # 连接数

# Taiji Agent测试
iterations = 1000        # 核心模块迭代次数
```

#### 生产级测试参数

```python
# 在 stress_test_production.py 中调整

# 基准测试参数
warmup = 10              # 预热迭代
iterations = 1000        # 基准迭代次数

# 负载测试参数
concurrent_users = 20    # 并发用户
duration_seconds = 60     # 测试时长
```

---

## 5. 测试报告解读

### 5.1 报告格式

```json
{
  "test_info": {
    "project": "EcoMind OS",
    "version": "1.0.0",
    "mode": "end_to_end",
    "start_time": "2024-01-01T10:00:00",
    "end_time": "2024-01-01T10:30:00",
    "api_available": true,
    "websocket_available": true
  },
  "summary": {
    "total_tests": 15,
    "successful_tests": 14,
    "failed_tests": 1,
    "total_requests": 50000,
    "successful_requests": 49950,
    "failed_requests": 50,
    "total_throughput_rps": 2500.0
  },
  "results": [
    {
      "name": "Agent CRUD - 创建Agent",
      "test_type": "POST /api/agents/",
      "iterations": 100,
      "concurrent_users": 1,
      "duration_seconds": 2.5,
      "total_requests": 100,
      "successful_requests": 98,
      "failed_requests": 2,
      "avg_latency_ms": 25.5,
      "p95_latency_ms": 45.2,
      "throughput_rps": 40.0,
      "error_rate": 0.02
    }
  ]
}
```

### 5.2 关键指标解读

| 指标 | 计算方式 | 优秀 | 良好 | 需改进 |
|------|----------|------|------|--------|
| **错误率** | 失败数/总数 | < 0.1% | < 1% | > 1% |
| **P95延迟** | 第95百分位响应时间 | < 100ms | < 200ms | > 200ms |
| **P99延迟** | 第99百分位响应时间 | < 200ms | < 500ms | > 500ms |
| **吞吐量** | 总请求/总时长 | > 1000 rps | > 500 rps | < 500 rps |
| **内存增长** | 测试后-测试前 | < 50MB | < 200MB | > 200MB |

### 5.3 测试通过标准

```yaml
验收标准:
  API测试:
    - 健康检查: 错误率 < 0.01%
    - CRUD操作: 错误率 < 1%
    - P95延迟 < 200ms

  WebSocket测试:
    - 连接成功率 > 99%
    - 平均连接时间 < 100ms

  核心模块测试:
    - Taiji Verify: > 10,000 ops/s
    - Hallucination Detector: > 5,000 ops/s
    - Session Memory: > 10,000 ops/s
    - SM3 Hash: > 20,000 ops/s

  并发测试:
    - 10并发: 错误率 < 1%
    - 50并发: 错误率 < 5%
    - 100并发: 错误率 < 10%

  内存测试:
    - 内存增长 < 200MB
    - 无内存泄漏
```

### 5.4 报告生成位置

```
EcoMind OS/
├── docs/
│   ├── stress_test_ecomind.py      # 端到端测试脚本
│   ├── stress_test_mock.py          # 模拟测试脚本
│   ├── ecomind_stress_test_report.json  # JSON报告
│   └── CODE_WIKI.md                 # 代码文档
│
└── backend/taiji-agent/
    └── tests/
        ├── stress_test_report.json   # Taiji Agent报告
        └── ...
```

---

## 6. 性能基准参考

### 6.1 Taiji Agent 模块基准

| 模块 | 操作 | 基准吞吐量 | 备注 |
|------|------|-----------|------|
| TaijiVerifier | 验证 | 50,000+ ops/s | 10000次测试 |
| HallucinationDetector | 检测 | 20,000+ ops/s | 25000次测试 |
| SessionMemory | 读写 | 10,000+ ops/s | 1000次测试 |
| SoulLoader | 加载 | 100,000+ ops/s | 1000次测试 |
| ToolRegistry | 查询 | 50,000+ ops/s | 5000次测试 |

### 6.2 GovMCP 模块基准

| 模块 | 操作 | 基准吞吐量 | 备注 |
|------|------|-----------|------|
| SM3Hash | 哈希 | 30,000+ ops/s | 10000次测试 |
| SM4Encryptor | 加密 | 5,000+ ops/s | 5000次测试 |
| ApprovalWorkflow | 创建 | 3,000+ ops/s | 3000次测试 |
| AuditTrail | 记录 | 5,000+ ops/s | 5000次测试 |

### 6.3 API 端点基准

| 端点 | 方法 | 预期P95 | 预期吞吐量 |
|------|------|---------|-----------|
| /health | GET | < 10ms | > 1000 rps |
| /api/agents/ | GET | < 100ms | > 100 rps |
| /api/agents/ | POST | < 200ms | > 50 rps |
| /api/workflows/ | POST | < 300ms | > 30 rps |
| /api/security/events | GET | < 150ms | > 100 rps |
| /ws | WebSocket | < 50ms | > 500 conn/s |

### 6.4 性能优化建议

1. **API 响应慢**
   - 检查数据库索引
   - 启用缓存 (Redis)
   - 优化查询语句
   - 考虑水平扩展

2. **WebSocket 连接不稳定**
   - 检查网络带宽
   - 调整心跳间隔
   - 优化消息序列化
   - 考虑负载均衡

3. **内存使用过高**
   - 检查内存泄漏
   - 优化数据结构
   - 增加 GC 频率
   - 考虑内存限制

4. **并发能力不足**
   - 增加 worker 数量
   - 优化线程池配置
   - 使用异步 I/O
   - 考虑分布式部署

---

## 附录

### A. 测试命令速查

```bash
# 快速测试 (模拟模式)
cd EcoMind-OS/docs && python stress_test_mock.py

# 完整测试 (需要API服务)
cd EcoMind-OS/docs && python stress_test_ecomind.py

# Taiji Agent 测试
cd EcoMind-OS/backend/taiji-agent/tests && python stress_test.py

# pytest 测试
cd EcoMind-OS/backend/taiji-agent && pytest tests/ -v
```

### B. 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| ImportError: taiji_agent | 依赖未安装 | `pip install -e ".[all]"` |
| ConnectionError: API | 服务未启动 | `uvicorn main:app --reload` |
| TimeoutError: WebSocket | 连接超时 | 检查网络配置 |
| MemoryError | 内存不足 | 增加物理内存或减少并发 |

### C. 联系支持

- **GitHub Issues**: https://github.com/xiejianjun000/EcoMind-OS/issues
- **文档**: https://github.com/xiejianjun000/EcoMind-OS#readme

---

*最后更新: 2026-05-26*
*版本: 1.0.0*
