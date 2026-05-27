# EcoMind OS — 国产化 ARM64 / LoongArch 部署指南

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    省级 (鲲鹏 920)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Nginx    │  │ FastAPI  │  │ Ollama (qwen2.5:14b)  │  │
│  │ ARM64    │  │ 16 Core  │  │ + vLLM Atlas 300I     │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ openGauss 5.0 (SM4 国密) + 达梦 DM8 (审计)        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   市州级 (飞腾 S2500)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Nginx    │  │ FastAPI  │  │ Ollama (qwen2.5:7b)   │  │
│  │ ARM64    │  │ 8 Core   │  │ + llama.cpp Q4        │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 人大金仓 KingbaseES (PostgreSQL 协议)               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 个人工作站 (龙芯 3A6000)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Nginx    │  │ FastAPI  │  │ llama.cpp             │  │
│  │          │  │ 2 Core   │  │ qwen2.5-7b-q4.gguf    │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ SQLite (本地文件数据库)                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 省级部署 (鲲鹏 920 + openEuler)

```bash
# 安装 Docker ARM64
sudo yum install -y docker-ce docker-compose

# 设置 NUMA 亲和性 (鲲鹏多 NUMA 节点)
numactl --hardware

# 启动完整栈
PLATFORM=kunpeng docker compose -f docker-compose.kunpeng.yml up -d

# 安装模型
docker exec ecomind-ollama bash /setup.sh
```

### 2. 市州级部署 (飞腾 S2500 + 麒麟 V10)

```bash
# 飞腾平台 docker 安装
sudo apt install docker.io docker-compose

# 启动
docker compose -f docker-compose.phytium.yml up -d
```

### 3. 个人工作站 (龙芯 3A6000 + Loongnix)

```bash
# 编译 llama.cpp (LoongArch 需要从源码编译)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp && make -j4

# 下载量化模型
wget https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf -P ../models/

# 启动
docker compose -f docker-compose.loongson.yml up -d
```

## 模型清单

| 平台 | 模型 | 参数 | 推理方式 | 内存需求 |
|------|------|------|---------|---------|
| 鲲鹏 920 | qwen2.5:14b | 14B | Ollama ARM64 | 16 GB |
| 鲲鹏 920 | deepseek-r1:14b | 14B | Ollama ARM64 | 16 GB |
| 鲲鹏 920 | qwen2.5-coder:14b | 14B | Ollama ARM64 | 16 GB |
| 鲲鹏 920 | bge-m3:567m | 567M | Ollama ARM64 | 2 GB |
| 飞腾 S2500 | qwen2.5:7b | 7B | Ollama ARM64 | 8 GB |
| 飞腾 S2500 | qwen2.5:3b | 3B | Ollama ARM64 | 4 GB |
| 龙芯 3A6000 | qwen2.5-7b-q4 | 7B (Q4) | llama.cpp | 5 GB |

## 数据库选型

| 数据库 | 适用层级 | 协议 | 端口 | 特点 |
|--------|---------|------|------|------|
| **openGauss** | 省级 | PostgreSQL | 5432 | NUMA 感知, SM4 国密, 向量引擎 |
| **达梦 DM8** | 省级审计 | Oracle 兼容 | 5236 | 国密 SM2/SM3/SM4, PL/SQL |
| **人大金仓** | 市州级 | PostgreSQL | 54321 | PG 工具链兼容, GIS 支持 |
| **SQLite** | 个人工作站 | 嵌入式 | - | 零配置, 单文件 |

## 环境变量

```bash
# 必填
DB_PASSWORD=your_strong_password
DEEPSEEK_API_KEY=sk-your-deepseek-key    # 云端 API (降级方案)

# 可选
MINIO_USER=minioadmin
MINIO_PASSWORD=changeme
OLLAMA_NUM_PARALLEL=4
WORKERS=4
```

## 验证部署

```bash
# 前端
curl http://localhost

# 后端健康检查
curl http://localhost:8000/api/health

# 数据库
docker exec ecomind-gaussdb gsql -d ECOMIND -c "SELECT version()"

# 模型推理
curl http://localhost:11434/api/generate -d '{"model":"qwen2.5:7b","prompt":"你好","stream":false}'
```
