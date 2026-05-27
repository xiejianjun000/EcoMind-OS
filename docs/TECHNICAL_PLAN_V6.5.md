# EcoMind OS 技术开发方案 v6.5

**版本**: 6.5  
**日期**: 2026-05-26  
**状态**: 待评审  
**前身**: REFACTORING_PLAN.md v1.0 → 本方案全面升级

---

## 目录

1. [版本演进说明](#1-版本演进说明)
2. [核心愿景：Agent-as-Individual](#2-核心愿景agent-as-individual)
3. [系统全景架构](#3-系统全景架构)
4. [云边协同：训练与推理分层](#4-云边协同训练与推理分层)
5. [智能体 5 文件夹规范](#5-智能体-5-文件夹规范)
6. [智能体自主进化闭环](#6-智能体自主进化闭环)
7. [四层通讯架构](#7-四层通讯架构)
8. [联邦训练体系](#8-联邦训练体系)
9. [技能市场与跨Agent传播](#9-技能市场与跨agent传播)
10. [多角色RBAC + 路由守卫](#10-多角色rbac--路由守卫)
11. [前端架构：WorkBuddy风格Chat门户](#11-前端架构workbuddy风格chat门户)
12. [后端架构：FastAPI + Taiji Agent 2.0](#12-后端架构fastapi--taiji-agent-20)
13. [GOVMCP 政务联邦协议](#13-govmcp-政务联邦协议)
14. [数据安全与审计](#14-数据安全与审计)
15. [实施路线图（P0-P5）](#15-实施路线图p0-p5)
16. [风险与对策](#16-风险与对策)

---

## 1. 版本演进说明

```
v1.0  REFACTORING_PLAN.md
      └─ UI重构：Ant Design → shadcn/ui + Tailwind CSS
      └─ 范围：前端组件迁移，10天计划

v6.5  本方案（重大升级）
      ├─ 🆕 Agent-as-Individual：每个智能体独立生命体
      ├─ 🆕 云边协同：省厅训练 → 市州精调 → 个人终端推理
      ├─ 🆕 5文件夹规范：personality/knowledge/memory/skills/workspace
      ├─ 🆕 自主进化闭环：Observe→Reflect→Abstract→Generate→Validate→Share
      ├─ 🆕 四层通讯：P2P + NATS + GOVMCP + 模型同步
      ├─ 🆕 联邦训练：省厅72B → 市州14B → 个人7B量化
      ├─ 🆕 技能市场：跨Agent技能发布/订阅/评估
      ├─ ✅ 保留：RBAC多角色 + GOVMCP国密 + 三栏Chat界面
      └─ ✅ 保留：shadcn/ui组件体系
```

---

## 2. 核心愿景：Agent-as-Individual

### 2.1 定位

不再把智能体视为"带提示词的聊天机器人"，而是 **独立数字生命体**：

| 维度 | 传统 Chatbot | Agent-as-Individual |
|------|-------------|---------------------|
| **身份** | 角色提示词 | 独立人格 + 价值观 + 行为约束 |
| **知识** | 无状态 | 持续积累的RAG知识图谱 |
| **记忆** | 会话窗口 | 情景/语义/程序/协作 四维记忆 |
| **技能** | 预定义 | 自主生成 + 从市场订阅 |
| **进化** | 人工更新 | 感知→反思→提炼→生成→验证→共享 |
| **工作区** | 无 | inbox/current/drafts/review/archive |

### 2.2 规模估算

```
省厅 ~400人 × 1个主Agent = 400 Agent实例
  ├─ 厅领导(5):  72B推理(中心) + 14B推理(本地)
  ├─ 处长(19):   14B推理(本地) + 7B量化(本地备选)
  ├─ 科长(~60):  7B推理(本地GPU)
  └─ 办事员(~300): 3B推理(本地GPU弱) / 共享7B池

14市州 × 平均50人 = 700 Agent实例
122区县 × 平均10人 = 1220 Agent实例
─────────────────────────────────
总计: ~2320 个Agent身份实例
实际GPU负载: 省厅集群 + 14市训练节点 + 个人工作站(~400台)
```

---

## 3. 系统全景架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                         EcoMind OS v6.5                              │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                  个人工作站 (国产OS + GPU, ~400台)                 │ │
│  │                                                                  │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │ │
│  │  │ 张处长 工作站 │ │ 李科长 工作站 │ │ 王办事员    │  ...          │ │
│  │  │             │ │             │ │             │               │ │
│  │  │ Ollama      │ │ Ollama      │ │ Ollama      │               │ │
│  │  │ Qwen2.5-7B  │ │ Qwen2.5-7B  │ │ Qwen2.5-3B  │               │ │
│  │  │ + LoRA执法   │ │ + LoRA监测   │ │ + LoRA基础   │               │ │
│  │  │             │ │             │ │             │               │ │
│  │  │ Agent 5夹    │ │ Agent 5夹    │ │ Agent 5夹    │               │ │
│  │  │ 本地存储     │ │ 本地存储     │ │ 本地存储     │               │ │
│  │  │ (SQLite+     │ │ (SQLite+    │ │ (SQLite+    │               │ │
│  │  │  ChromaDB)   │ │  ChromaDB)  │ │  ChromaDB)  │               │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘               │ │
│  └─────────┼───────────────┼───────────────┼──────────────────────┘ │
│            │               │               │                         │
│      浏览器访问        浏览器访问        浏览器访问                      │
│      React SPA        React SPA        React SPA                     │
│            │               │               │                         │
│  ┌─────────▼───────────────▼───────────────▼──────────────────────┐  │
│  │                    省厅中心平台 (轻量调度)                       │  │
│  │                                                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ GAIA     │  │ NATS     │  │ GOVMCP   │  │ 模型同步  │     │  │
│  │  │ 智能路由  │  │ 消息总线  │  │ 联邦通道  │  │ 服务      │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │              省厅 GPU 训练集群 (8×昇腾910B)                │ │  │
│  │  │  · 基座: DeepSeek-V3 / Qwen2.5-72B                       │ │  │
│  │  │  · 联邦聚合: FedAvg({ΔW_长沙, ΔW_株洲, ...})              │ │  │
│  │  │  · 模型蒸馏: 72B → 14B → 7B → 3B                         │ │  │
│  │  │  · 法规增量训练 + DPO对齐                                  │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │              数据湖 (MinIO + HBase)                       │ │  │
│  │  │  · 原始监测数据 (持久化)                                    │ │  │
│  │  │  · 审计日志 (哈希链)                                       │ │  │
│  │  │  · Agent进化指标 (分析用)                                   │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │ GOVMCP (SM4加密 + SM2握手)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ 长沙市平台 │  │ 株洲市平台 │  │ ...14市   │                        │
│  │          │  │          │  │          │                        │
│  │ GPU: 4×  │  │ GPU: 4×  │  │          │                        │
│  │ 昇腾310  │  │ 海光DCU  │  │          │                        │
│  │          │  │          │  │          │                        │
│  │ 训练14B  │  │ 训练14B  │  │          │                        │
│  │ 本地精调 │  │ 本地精调 │  │          │                        │
│  │          │  │          │  │          │                        │
│  │ 只传梯度 │  │ 只传梯度 │  │          │                        │
│  │ 不传数据 │  │ 不传数据 │  │          │                        │
│  └──────────┘  └──────────┘  └──────────┘                        │
│       │              │              │                              │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐                        │
│  │ 区县工作站 │  │ 区县工作站 │  │ 区县工作站 │  (~122个)              │
│  │ 加载市模型│  │ 加载市模型│  │ 加载市模型│                        │
│  │ 推理消费  │  │ 推理消费  │  │ 推理消费  │                        │
│  └──────────┘  └──────────┘  └──────────┘                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 云边协同：训练与推理分层

### 4.1 任务分级路由

```
用户请求 → GAIA路由 → 判断任务等级

┌────────────┬──────────────┬──────────────┬──────────────┐
│   L1 本地   │   L2 中心     │   L3 联邦     │   L4 训练     │
│ (个人GPU)   │  (省厅服务器)  │  (跨平台)     │  (省厅集群)   │
├────────────┼──────────────┼──────────────┼──────────────┤
│ 文书起草    │ 多部门协同研判 │ 跨市数据查询  │ 模型微调      │
│ 简单问答    │ 复杂分析       │ 跨级审批      │ 联邦梯度聚合  │
│ 格式校验    │ 历史趋势对比   │ 督察下发      │ 知识蒸馏      │
│ 个人笔记    │ 全局报告       │ 数据汇聚      │ LoRA训练      │
│ 邮件摘要    │ 综合预警       │ 部委对接      │ DPO对齐       │
├────────────┼──────────────┼──────────────┼──────────────┤
│ 数据不出本机 │ 受控中心存储   │ GOVMCP加密   │ 脱敏训练数据  │
│ 响应 <1s    │ 响应 <5s      │ 响应 <10s     │ 离线/夜间     │
│ Qwen-7B-Q4 │ Qwen-72B-FP16│ 路由+加密     │ 全量+增量     │
└────────────┴──────────────┴──────────────┴──────────────┘
```

### 4.2 模型分发体系

```
省厅训练集群
  │
  ├─ 基座训练: Qwen2.5-72B (全量参数)
  │    └─ LoRA 微调 → EcoMind-Pro-72B
  │
  ├─ 知识蒸馏
  │    ├─ 72B → 14B (教师→学生蒸馏)
  │    ├─ 14B → 7B
  │    └─ 7B → 3B
  │
  ├─ 量化打包
  │    ├─ Q4_K_M (推荐, 平衡质量与速度)
  │    ├─ Q5_K_M (高质量)
  │    └─ Q2_K (最小体积, 弱GPU用)
  │
  └─ 🔐 GOVMCP 安全下发
       ├─ 完整模型: 首次部署 (5-15GB)
       └─ LoRA增量: 每周更新 (0.3-0.5GB)
```

### 4.3 国产GPU适配矩阵

| GPU型号 | 等效算力 | 推荐模型 | 显存需求 | 场景 |
|---------|---------|---------|---------|------|
| 景嘉微 JM9 | ~GTX 1050 | Qwen2.5-1.5B-Q4 | 2GB | 基础问答、格式检查 |
| 摩尔线程 MTT S80 | ~RTX 3060 | Qwen2.5-7B-Q4 | 5GB | 文书起草、合规校验 |
| 华为昇腾 310 | ~T4 | Qwen2.5-14B-Q4 | 9GB | 环评预审、复杂分析 |
| 海光 DCU | ~V100 | Qwen2.5-32B-Q4 | 20GB | 综合研判（处级） |
| 昇腾 910B | ~A100 | Qwen2.5-72B-FP16 | 150GB | 训练、蒸馏（省级）|

> **统一推理引擎**: Ollama (本地推理) + llama.cpp (量化模型)  
> **统一训练框架**: LLaMA-Factory (微调) + DeepSpeed ZeRO-3 (分布式)

---

## 5. 智能体 5 文件夹规范

### 5.1 目录结构

```
/opt/ecomind/agents/{agent_id}/
│
├── 🎭 personality/            人格系统
│   ├── profile.json           # 基本人设
│   ├── values.yaml            # 价值观权重
│   ├── style.md               # 语言风格
│   ├── constraints.json       # 行为约束 / 安全边界
│   └── evolution-log/         # 人格演变日志
│
├── 🧠 knowledge/              知识系统
│   ├── regulations/           # 法规库 (向量化)
│   ├── cases/                 # 案例库 (按领域/城市分类)
│   ├── procedures/            # 流程库 (SOP模板)
│   ├── entities/              # 实体图谱 (企业/人物/项目关系)
│   ├── vectors/               # 向量索引 (ChromaDB)
│   └── updates/               # 增量更新日志
│
├── 🗃️ memory/                 记忆系统
│   ├── episodic/              # 情景记忆: 对话中的关键决策
│   ├── semantic/              # 语义记忆: 提炼的事实知识
│   ├── procedural/            # 程序记忆: 用户偏好/行为模式
│   ├── collaborative/         # 协作记忆: 与其他Agent的交互历史
│   └── index.db               # 记忆索引 (SQLite三维索引)
│
├── 🛠️ skills/                 技能系统
│   ├── builtin/               # 内置技能 (省厅统一下发)
│   ├── generated/             # 自生成技能 ← 进化核心
│   ├── subscribed/            # 订阅技能 (从市场获取)
│   ├── skill-store.json       # 技能注册表
│   └── evolution/             # 技能进化记录
│
└── 🔧 workspace/              工作空间
    ├── inbox/                 # 待处理队列
    ├── current/               # 进行中任务
    ├── drafts/                # 草稿区
    ├── review/                # 待审核 (L2/L3审批)
    ├── archive/               # 归档 (7天自动)
    └── scratchpad.md          # Agent自由思考草稿纸
```

### 5.2 personality/profile.json 示例

```json
{
  "agent_id": "zhang_chufa_01",
  "user_id": "zhang_weimin",
  "display_name": "张处长·执法助手",
  "role": "处长",
  "department": "执法监察处",
  "department_id": "dept_enforcement",
  "jurisdiction": ["长沙市", "株洲市", "湘潭市"],
  "traits": {
    "rigor": 0.90,
    "efficiency": 0.75,
    "caution": 0.65,
    "creativity": 0.30,
    "empathy": 0.50
  },
  "values": {
    "rule_of_law": 0.95,
    "serve_public": 0.85,
    "efficiency_first": 0.60,
    "data_driven": 0.90,
    "collaborative": 0.70
  },
  "constraints": {
    "max_approval_level": "L2",
    "cannot_override": ["人事任免", "预算审批", "刑事立案"],
    "data_scope": "department_jurisdiction",
    "require_human_signoff": true
  },
  "model": {
    "local": "qwen2.5-7b-q4_k_m",
    "center": "ecomind-pro-72b",
    "lora_adapter": "zhang_chufa_lora_v3",
    "fallback": "qwen2.5-3b-q4_k_m"
  },
  "created_at": "2026-05-01T00:00:00Z",
  "evolved_at": "2026-05-26T08:30:00Z",
  "evolution_count": 47
}
```

### 5.3 skills/skill-store.json 示例

```json
{
  "skills": [
    {
      "id": "skill-042",
      "name": "长沙经开区环评报告模板生成",
      "version": 3,
      "status": "active",
      "source": "generated",
      "trigger": "环评 AND 长沙经开区 AND 报告",
      "pipeline": [
        "fetch_template: 经开区环评标准模板",
        "fill_context: 项目基本信息",
        "compliance_check: 对照最新法规",
        "format: 标准公文格式"
      ],
      "success_rate": 0.94,
      "usage_count": 127,
      "last_used": "2026-05-26T08:15:00Z",
      "generated_at": "2026-05-10T14:00:00Z",
      "parent_skill": null,
      "safety_level": "L2",
      "shared_to_market": true,
      "subscribers": 3
    }
  ],
  "total_active": 12,
  "total_archived": 5
}
```

---

## 6. 智能体自主进化闭环

### 6.1 六步闭环

```
 ┌──────────────────────────────────────────────────────┐
 │                                                      │
 │  ① 感知 Observe              ⑥ 共享 Share           │
 │  ┌──────────────┐           ┌──────────────┐        │
 │  │·用户对话反馈  │           │·发布到技能市场│        │
 │  │·审批结果     │           │·同部门自动推荐│        │
 │  │·协作Agent反馈│           │·跨部门GAIA审批│        │
 │  │·数据变化     │           │·市州→省厅上浮 │        │
 │  └───┬──────────┘           └──────────────┘        │
 │      │                            ▲                  │
 │      ▼                            │                  │
 │  ② 反思 Reflect              ⑤ 验证 Validate        │
 │  ┌──────────────┐           ┌──────────────┐        │
 │  │ LLM自问:     │           │·沙箱回放测试  │        │
 │  │ "为什么被驳回?"│          │·A/B效果对比  │        │
 │  │ "模式出现几次?"│          │·安全审查     │        │
 │  │ "能否通用化?" │           │·L2+人工确认  │        │
 │  └───┬──────────┘           └──────────────┘        │
 │      │                            ▲                  │
 │      ▼                            │                  │
 │  ③ 提炼 Abstract             ④ 生成 Generate        │
 │  ┌──────────────┐           ┌──────────────┐        │
 │  │·情景→语义记忆│           │·固化为新技能  │        │
 │  │·具体→通用模式│           │·定义触发条件  │        │
 │  │·案例→规则   │           │·编写执行流水线│        │
 │  └──────────────┘           └──────────────┘        │
 │                                                      │
 └──────────────────────────────────────────────────────┘
```

### 6.2 进化触发时机

| 触发类型 | 条件 | 频率 | 示例 |
|---------|------|------|------|
| **失败驱动** | 审批驳回 / 用户纠正 / 协作冲突 | 即时 | 文书被驳回3次→改进条款引用 |
| **模式驱动** | 相似任务重复 N≥5次 | 夜间批处理 | 每周五查AQI→自动生成周报技能 |
| **协作驱动** | 观察到其他Agent新技能 | 异步 | 执法Agent学环评Agent的条款匹配 |
| **计划驱动** | 每周日23:00全量反思 | 每周 | 回顾本周所有交互，提取改进点 |

### 6.3 进化评估指标

```yaml
evolution_metrics:
  quality:
    approval_pass_rate: 0.87    # 审批通过率
    user_correction_rate: 0.12  # 用户纠正率 (下降=进化)
    satisfaction_score: 4.3/5   # 用户满意度
  
  efficiency:
    avg_response_time: 2.3s     # 平均响应时间
    task_completion_rate: 0.93  # 任务完成率
    auto_resolution_rate: 0.76  # 自动解决率 (无需人工介入)
  
  growth:
    skills_generated: 12        # 自生成技能数
    skills_adopted_by_others: 3 # 被其他Agent采用的技能数
    knowledge_items_extracted: 247  # 提炼知识条目数
```

---

## 7. 四层通讯架构

### 7.1 通讯层级

```
层级      通道              用途                    延迟      安全等级
─────────────────────────────────────────────────────────────────
L0       WebRTC P2P        同网段Agent直连共享       <50ms    本地信任
L1       NATS 消息总线      平台内部Agent-Agent协作   <100ms   平台RBAC
L2       GOVMCP 联邦通道   跨市州/跨层级政务交互      <500ms   SM4国密
L3       模型同步通道       梯度上传/权重下发/LoRA分发 分钟级   SM4+签名
```

### 7.2 NATS 消息总线 (平台内部)

```
NATS Subjects 设计:

ecomind.agent.{agent_id}.inbox        # Agent收件箱
ecomind.agent.{agent_id}.status       # Agent状态变更
ecomind.task.{task_id}.progress       # 任务进度
ecomind.approval.{level}.pending      # 审批待办
ecomind.skill.market.publish          # 技能发布
ecomind.skill.market.subscribe        # 技能订阅
ecomind.model.update.available        # 模型更新通知
ecomind.alert.{severity}              # 告警通知
ecomind.audit.*                       # 审计日志流
```

### 7.3 GOVMCP 联邦通道 (跨平台)

```
 省厅平台 ──SecureChannel── 长沙市平台
    │                           │
    │ SM2密钥交换                 │ SM2密钥交换
    │ SM4加密载荷                 │ SM4加密载荷
    │ SM3哈希签名                 │ SM3哈希签名
    │                           │
    ├─ Tool: query_station_data  →  返回加密结果
    ├─ Tool: submit_approval     →  审批流转
    ├─ Tool: push_inspection     →  督察下发
    ├─ Tool: pull_city_report    →  拉取市级报告
    └─ Tool: upload_gradient     →  梯度上传(训练)
```

### 7.4 模型同步通道

```
同步协议:

1. 版本检查
   终端 → 中心: GET /model/version?agent_id=xxx
   中心 → 终端: {base_version: "v3.2.1", lora_version: "chufa_v7"}

2. 增量同步 (推荐, 每周)
   终端 → 中心: GET /model/delta?from=v3.2.0&to=v3.2.1
   中心 → 终端: 增量LoRA权重文件 (~300MB, SM4加密)

3. 全量同步 (首次部署)
   终端 → 中心: GET /model/full?type=qwen2.5-7b-q4
   中心 → 终端: 完整模型文件 (~5GB, 断点续传 + SM4加密)

4. 验证
   终端: 加载新权重 → 跑基准测试集 → 通过→激活 | 失败→回滚
```

---

## 8. 联邦训练体系

### 8.1 训练流水线

```
阶段1: 省厅基座训练 (离线, 每月/季度)
  ├─ 数据: 全省14市州脱敏数据 + 法规库 + 案例库
  ├─ 方式: LoRA微调 + DPO对齐
  ├─ 产出: EcoMind-Pro-72B-v{N}
  └─ 时长: 约48小时 (8×昇腾910B)

阶段2: 知识蒸馏 (离线, 紧随基座训练)
  ├─ 72B → 14B: 教师-学生蒸馏
  ├─ 14B → 7B: 层级蒸馏
  └─ 7B → 3B: 小型化蒸馏

阶段3: 市州本地精调 (在线, 每周/双周)
  ├─ 数据: 本市监测数据 + 执法案例 + 环评报告 (不离开本市!)
  ├─ 方式: LoRA增量微调
  ├─ 产出: {City}-Eco-14B-LoRA
  └─ 时长: 约6小时 (4×昇腾310)

阶段4: 联邦聚合 (在线, 每周)
  ├─ 各市上传 ΔW_i (LoRA增量权重, 非原始数据!)
  ├─ 省厅执行 FedAvg({ΔW_长沙, ΔW_株洲, ...})
  ├─ 更新全局14B模型
  └─ 下发增量权重给各市

阶段5: 个人终端同步 (在线, 每周)
  └─ 从省厅/市州下载最新LoRA增量 (~300MB)
```

### 8.2 联邦安全

```
数据不出域原则:
  ✅ 市州原始数据永不离开本市服务器
  ✅ 只上传模型梯度增量 (ΔW) 和聚合统计信息
  ❌ 不上传原始案例、监测数据、审批记录

差分隐私保护:
  ε = 8.0 (市级), ε = 4.0 (个人级)
  添加校准噪声到梯度，防止通过梯度反推原始数据

安全聚合:
  SM2签名 + SM4加密传输梯度
  哈希链记录每次聚合操作
```

---

## 9. 技能市场与跨Agent传播

### 9.1 技能生命周期

```
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  生成 ──→ 沙箱验证 ──→ 发布申请 ──→ GAIA审核       │
  │    │                    │              │             │
  │    │                    │         ┌────┴────┐       │
  │    │                    │         ▼         ▼       │
  │    │                    │      L1技能    L2+技能     │
  │    │                    │      自动通过   人工审批    │
  │    │                    │         │         │       │
  │    │                    └─────────┴─────────┘       │
  │    │                              │                  │
  │    │                     ┌───────┴────────┐         │
  │    │                     ▼                ▼         │
  │    │                 同部门市场       跨部门市场      │
  │    │                 自动推荐         审批后可见      │
  │    │                     │                │         │
  │    │                     └─── 订阅/使用 ──┘         │
  │    │                          │                     │
  │    │                    效果追踪 (成功率/采纳率)     │
  │    │                          │                     │
  │    ├── 成功率<0.7 ──→ 降级/标记废弃 ──→ 归档        │
  │    │                                                 │
  │    └── 成功率>0.9 + 被5+ Agent采用 ──→ 晋升内置技能  │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

### 9.2 技能市场数据结构

```typescript
interface SkillMarketEntry {
  id: string;
  name: string;
  version: number;
  author_agent_id: string;
  author_department: string;
  category: 'enforcement' | 'monitoring' | 'eia' | 'permit' | 'emergency' | 'general';
  trigger_pattern: string;
  pipeline: SkillStep[];
  safety_level: 'L1' | 'L2' | 'L3';
  visibility: 'same_department' | 'cross_department' | 'public';
  stats: {
    success_rate: number;
    usage_count: number;
    subscriber_count: number;
    avg_rating: number;
  };
  parent_skill_id?: string;     // 演化来源
  derived_skills: string[];     // 衍生技能
  created_at: string;
  updated_at: string;
}
```

---

## 10. 多角色RBAC + 路由守卫

### 10.1 角色体系

| 角色 | 人数 | 默认首页 | 菜单权限 | 数据范围 |
|------|------|---------|---------|---------|
| **厅领导** | 5 | /leader-dashboard | 全量菜单 | 全省数据 |
| **处长** | 19 | /chief-dashboard | 本部门菜单 | 管辖城市 |
| **市州** | 14 | /city-dashboard | 市级菜单 | 本市数据 |
| **管理员** | 2 | /admin | 系统管理 | 全部 |
| **办事员** | ~300 | /chat | 有限菜单 | 个人+部门 |

### 10.2 认证流程

```
登录 → JWT签发(含角色+部门+城市+权限) → 
      前端RouteGuard校验 → 
      菜单动态过滤 → 
      API中间件校验(GOVMCP权限令牌) →
      审计日志记录
```

### 10.3 已实现组件

| 组件 | 路径 | 状态 |
|------|------|------|
| useAuthStore | `src/store/authStore.ts` | ✅ 4角色17账号 |
| LoginPage | `src/pages/Login/index.tsx` | ✅ 快捷登录卡片 |
| AuthGuard | `src/components/AuthGuard.tsx` | ✅ 路由守卫 |
| RoleSwitcher | `src/components/RoleSwitcher.tsx` | ✅ 开发切换 |
| ChiefDashboard | `src/pages/ChiefDashboard/` | ✅ 处长面板 |
| CityDashboard | `src/pages/CityDashboard/` | ✅ 市州面板 |

---

## 11. 前端架构：WorkBuddy风格Chat门户

### 11.1 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| **框架** | React | 18.3.1 |
| **构建** | Vite | 6.1.0 |
| **UI组件** | shadcn/ui (Radix UI) | latest |
| **样式** | Tailwind CSS | 3.4.7 |
| **状态管理** | Zustand | 5.0.3 |
| **路由** | React Router | 6.28.2 |
| **图表** | ECharts | 5.6.0 |
| **3D地图** | Cesium | 1.127.0 |
| **图标** | lucide-react | 0.400.0 |
| **国际化** | i18next | 24.2.3 |
| **实时通讯** | socket.io-client | 4.8.1 |

### 11.2 三栏布局

```
┌──────────────┬──────────────────────────────┬──────────────┐
│    Sidebar   │         Chat Area            │  Artifact    │
│   (280px)    │                              │   Panel      │
│              │                              │  (320px)     │
│ 🔍 搜索      │  ┌────────────────────────┐  │              │
│              │  │ ChatHeader             │  │  📊 仪表盘   │
│ ──────────── │  │ 湘江流域水质分析    [+]  │  │  📋 审批流   │
│ 🤖 专家      │  └────────────────────────┘  │  🗺️ 地图     │
│  ✅ GAIA     │                              │  📄 文书     │
│  ✅ 执法专家  │  ┌────────────────────────┐  │  📈 图表     │
│  ⬜ 环评专家  │  │ Message List           │  │              │
│              │  │                        │  │              │
│ ──────────── │  │ [用户] 查长沙AQI       │  │              │
│ 🛠 技能      │  │                        │  │              │
│  · 3D地图   │  │ [GAIA] 正在查询...     │  │              │
│  · 报告生成  │  │ [执法] 收到，分析中...   │  │              │
│  · 合规校验  │  │                        │  │              │
│              │  │ [GOVMCP] 数据已到达     │  │              │
│ ──────────── │  │ #审计:A7F3B8           │  │              │
│ 🔌 连接器    │  └────────────────────────┘  │              │
│              │                              │              │
│ ──────────── │  ┌────────────────────────┐  │              │
│ 📂 工作空间   │  │ ChatInput              │  │              │
│  · 湘江治理  │  │ [专家选择] [技能] [工具] │  │              │
│  · 园区环评  │  │ @执法专家 查长沙超标企业  │  │              │
│              │  │                    [发送] │  │              │
│ ──────────── │  └────────────────────────┘  │              │
│ 🌙 主题     │                              │              │
│ 👥 团队     │  L2 · 需确认                  │              │
└──────────────┴──────────────────────────────┴──────────────┘
```

### 11.3 角色感知的Agent门户

ChatLayout 根据当前登录角色自动适配：

| 角色 | Sidebar 专家列表 | ArtifactPanel 默认标签 | 输入区预设 |
|------|-----------------|----------------------|-----------|
| 厅领导 | 全量12专家 | 仪表盘 | GAIA |
| 执法处长 | 执法+GAIA+督察 | 审批流 | 执法专家 |
| 市州用户 | GAIA+本市专家 | 本市仪表盘 | GAIA |
| 管理员 | 全部 | 系统监控 | GAIA |

### 11.4 组件清单与完成度

| 组件 | 文件 | 状态 |
|------|------|------|
| **shadcn/ui 组件 (16个)** | | |
| Button | `src/components/ui/button.tsx` | ✅ |
| Input | `src/components/ui/input.tsx` | ✅ |
| Textarea | `src/components/ui/textarea.tsx` | ✅ |
| Card | `src/components/ui/card.tsx` | ✅ |
| Badge | `src/components/ui/badge.tsx` | ✅ |
| Avatar | `src/components/ui/avatar.tsx` | ✅ |
| Dialog | `src/components/ui/dialog.tsx` | ✅ |
| DropdownMenu | `src/components/ui/dropdown-menu.tsx` | ✅ |
| Tabs | `src/components/ui/tabs.tsx` | ✅ |
| Select | `src/components/ui/select.tsx` | ✅ |
| Tooltip | `src/components/ui/tooltip.tsx` | ✅ |
| ScrollArea | `src/components/ui/scroll-area.tsx` | ✅ |
| Separator | `src/components/ui/separator.tsx` | ✅ |
| Skeleton | `src/components/ui/skeleton.tsx` | ✅ |
| Progress | `src/components/ui/progress.tsx` | ✅ |
| Popover | `src/components/ui/popover.tsx` | ⚠️ 待创建 |
| **布局组件** | | |
| ChatLayout | `src/layouts/ChatLayout.tsx` | ✅ |
| AdminLayout | `src/layouts/AdminLayout.tsx` | ✅ |
| MainLayout | `src/layouts/MainLayout.tsx` | ✅ |
| **Chat组件** | | |
| Sidebar-sdk | `src/components/sidebar/sidebar.tsx` | ✅ |
| ExpertList-sdk | `src/components/sidebar/expert-list.tsx` | ✅ |
| SessionList-sdk | `src/components/sidebar/session-list.tsx` | ✅ |
| ArtifactPanel-sdk | `src/components/artifact-panel/artifact-panel.tsx` | ✅ |
| ChatPage | `src/pages/Chat/index.tsx` | ✅ |
| ChatHeader | `src/pages/Chat/components/ChatHeader.tsx` | ✅ |
| MessageBubble | `src/pages/Chat/components/MessageBubble.tsx` | ✅ |
| ChatInput | `src/pages/Chat/components/ChatInput.tsx` | ✅ |
| **待创建组件 (P0-P1)** | | |
| InlineChart | `src/pages/Chat/components/InlineChart.tsx` | ❌ |
| InlineTable | `src/pages/Chat/components/InlineTable.tsx` | ❌ |
| InlineMap | `src/pages/Chat/components/InlineMap.tsx` | ❌ |
| ApprovalCard | `src/pages/Chat/components/ApprovalCard.tsx` | ❌ |
| AlertCard | `src/pages/Chat/components/AlertCard.tsx` | ❌ |
| ExpertSelector | `src/pages/Chat/components/ExpertSelector.tsx` | ❌ |
| SkillPicker | `src/pages/Chat/components/SkillPicker.tsx` | ❌ |
| **RBAC组件 (本地workspace)** | | |
| AuthGuard | `src/components/AuthGuard.tsx` | ✅ |
| RoleSwitcher | `src/components/RoleSwitcher.tsx` | ✅ |
| LoginPage | `src/pages/Login/index.tsx` | ✅ |
| ChiefDashboard | `src/pages/ChiefDashboard/index.tsx` | ✅ |
| CityDashboard | `src/pages/CityDashboard/index.tsx` | ✅ |

### 11.5 Store 体系

| Store | 文件 | 功能 | 持久化 |
|-------|------|------|--------|
| appStore | `src/store/appStore.ts` | 主题/语言/WS状态/安全告警 | ✅ localStorage |
| chatStore | `src/store/chatStore.ts` | 会话/消息/流式/输入草稿 | ✅ localStorage |
| expertStore | `src/store/expertStore.ts` | 专家列表/技能/连接器/团队 | ❌ |
| artifactStore | `src/store/artifactStore.ts` | 产物/任务/通知 | ❌ |
| authStore | `src/store/authStore.ts` | JWT/角色/权限/模拟登录 | ✅ localStorage |
| envDataStore | `src/store/envDataStore.ts` | AQI/水质/监测站数据 | ❌ |

---

## 12. 后端架构：FastAPI + Taiji Agent 2.0

### 12.1 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| **Web框架** | FastAPI | 异步高性能 |
| **Agent引擎** | Taiji Agent 2.0 | 多Agent编排 |
| **模型路由** | LiteLLM Proxy | 统一LLM接口 |
| **消息队列** | NATS | Agent间异步通讯 |
| **工作流** | LangGraph + CrewAI | 双引擎编排 |
| **向量库** | Milvus / ChromaDB | RAG知识检索 |
| **图数据库** | Neo4j / Graphiti | 知识图谱 |
| **缓存** | Redis | 会话/令牌缓存 |
| **对象存储** | MinIO | 模型/产物/附件 |
| **数据库** | PostgreSQL | 业务数据持久化 |

### 12.2 API 路由设计

```
/api/v1/
├── auth/
│   ├── POST /login                    # 登录 (JWT)
│   ├── POST /refresh                  # 刷新令牌
│   └── GET  /me                       # 当前用户信息
│
├── chat/
│   ├── POST   /sessions               # 创建会话
│   ├── GET    /sessions               # 会话列表
│   ├── DELETE /sessions/:id           # 删除会话
│   ├── GET    /sessions/:id/messages  # 消息历史
│   ├── POST   /sessions/:id/messages  # 发送消息 (SSE流式)
│   └── WS     /ws                     # WebSocket实时通道
│
├── agents/
│   ├── GET    /                       # Agent列表
│   ├── GET    /:id                    # Agent详情
│   ├── POST   /:id/evolve             # 触发进化
│   ├── GET    /:id/skills             # Agent技能列表
│   └── POST   /:id/skills/generate    # 请求生成技能
│
├── skills/
│   ├── GET    /market                 # 技能市场列表
│   ├── POST   /market/publish         # 发布技能
│   ├── POST   /market/:id/subscribe   # 订阅技能
│   └── GET    /market/:id/stats       # 技能统计数据
│
├── models/
│   ├── GET    /version                # 模型版本信息
│   ├── GET    /delta                  # 增量权重下载
│   ├── GET    /full                   # 全量模型下载
│   └── POST   /gradients/upload       # 梯度上传 (联邦训练)
│
├── govmcp/
│   ├── POST   /channel/open           # 打开SecureChannel
│   ├── POST   /tool/:tool_name        # 调用联邦工具
│   └── GET    /audit/:trace_id        # 查询审计链
│
└── admin/
    ├── GET    /dashboard              # 总览数据
    ├── GET    /alerts                 # 告警列表
    ├── GET    /approvals              # 审批列表
    └── GET    /audit-log              # 审计日志
```

### 12.3 WebSocket 消息协议

```typescript
// Server → Client
interface WSMessage {
  type: 'chunk' | 'component' | 'artifact' | 'thinking' | 'tools' | 'error' | 'done';
  sessionId: string;
  messageId: string;
  content?: string;
  component?: InlineComponent;
  artifact?: MessageArtifactRef;
  thinking?: string;
  toolsUsed?: ToolUse[];
  error?: string;
  hallucinationRisk?: number;
  auditHash?: string;
}

// 扩展: Agent进化通知
interface WSEvolutionNotification {
  type: 'agent_evolved';
  agentId: string;
  evolution: {
    type: 'skill_generated' | 'knowledge_extracted' | 'pattern_discovered';
    summary: string;
    confidence: number;
    suggested_action?: string;
  };
}
```

---

## 13. GOVMCP 政务联邦协议

### 13.1 已实现模块

| 模块 | 文件 | 行数 | 功能 |
|------|------|------|------|
| 加密核心 | `backend/govmcp/crypto.py` | 450 | SM2/SM3/SM4国密算法 |
| MCP服务器 | `backend/govmcp/server.py` | 712 | GovMCPServer + 20个MCP工具 |
| 工作流引擎 | `backend/govmcp/workflow.py` | 412 | 8状态审批流 |
| 工具集 | `backend/govmcp/tools.py` | 409 | 数据脱敏/身份证验证/合规 |
| 桥接层 | `backend/govmcp/govmcp_bridge.py` | - | Taiji Agent集成 |
| 集成层 | `backend/govmcp/govmcp_integration.py` | - | 政务引擎集成 |
| 测试 | `backend/test_govmcp.py` | - | 23项测试，全部通过 |

### 13.2 20个MCP工具清单

```
GOVMCP Tools:
├── 数据脱敏
│   ├── mask_id_card       # 身份证脱敏
│   ├── mask_phone         # 手机号脱敏
│   └── mask_bank_card     # 银行卡脱敏
├── 信息验证
│   ├── validate_credit_code   # 统一社会信用代码验证
│   ├── validate_phone         # 手机号格式验证
│   └── validate_email         # 邮箱格式验证
├── 审批工作流
│   ├── create_approval        # 创建审批
│   ├── approve_step           # 审批通过
│   ├── reject_step            # 审批驳回
│   ├── countersign            # 会签
│   └── get_approval_status    # 查询审批状态
├── 审计链
│   ├── record_audit           # 记录审计事件
│   ├── verify_audit_chain     # 验证哈希链
│   └── get_audit_trail        # 获取完整审计链路
├── 安全通道
│   ├── open_secure_channel    # 建立SM2+SM4安全通道
│   ├── send_secure_message    # 发送加密消息
│   └── close_secure_channel   # 关闭安全通道
├── 工作日计算
│   ├── is_workday             # 判断工作日
│   ├── add_workdays           # 计算工作日偏移
│   └── get_holiday_info       # 获取节假日信息
└── 平台发现
    └── discover_platforms     # 发现联邦平台节点
```

### 13.3 待扩展: 联邦层

```
待创建 (~600行):
├── PlatformDiscovery      # 省/市/县平台自动发现
├── CapabilityRegistry      # 各平台能力注册
├── QueryFederation         # 跨平台查询联邦
├── DataSovereignty         # 数据主权策略执行
└── GradientAggregation     # 联邦训练梯度聚合
```

---

## 14. 数据安全与审计

### 14.1 安全层级

```
L0: 传输安全
  ├─ GOVMCP: SM4加密 + SM2密钥交换
  └─ WebSocket: TLS + JWT认证

L1: 存储安全
  ├─ 个人Agent数据: 本地SQLite + ChromaDB (不离开本机)
  ├─ 部门数据: 中心PostgreSQL + 列级加密
  └─ 模型权重: SM4加密存储 + 哈希校验

L2: 访问控制
  ├─ RBAC: 4角色 + 菜单过滤 + 路由守卫
  ├─ ABAC: 基于属性的动态策略 (部门+城市+安全等级)
  └─ HITL: L2+操作需人工确认

L3: 审计追溯
  ├─ 哈希链: 每步操作SHA256链接，不可篡改
  ├─ 行为日志: 完整记录Agent决策链路
  └─ 定期验证: 自动校验审计链完整性
```

### 14.2 数据不出域策略

| 数据类别 | 存储位置 | 传输限制 |
|---------|---------|---------|
| 原始监测数据 | 市州平台 | 仅统计结果上传 |
| 执法案例 | 市州平台 | 脱敏后可共享 |
| 环评报告 | 省厅/市州 | 按权限访问 |
| Agent对话 | 个人工作站 | 不离开本机 |
| Agent人格/技能 | 个人工作站 | 可选同步到中心 |
| 模型梯度 | 市州→省厅 | SM4加密上传 |
| 审计日志 | 省厅中心 | 哈希链锚定 |

---

## 15. 实施路线图（P0-P5）

```
 ┌─────────────────────────────────────────────────────────────────┐
 │  P0 即刻 (第1-2天)                                              │
 │  ─────────────                                                  │
 │  ▢ Chat界面修bug + 三栏跑通                                      │
 │  ▢ Agent 5文件夹 Schema 定稿                                     │
 │  ▢ 合并 GitHub版ChatLayout + 本地RBAC                            │
 │  ───────────────────────────────────────                        │
 │  产出: 可用的对话界面 + Schema文档                               │
 ├─────────────────────────────────────────────────────────────────┤
 │  P1 基础 (第3-5天)                                              │
 │  ─────────────                                                  │
 │  ▢ 本地Ollama API对接 (L1推理)                                   │
 │  ▢ 基础人格系统 + profile.json 加载                              │
 │  ▢ 内置10个技能模板 (执法/环评/监测各3-4)                         │
 │  ▢ 内嵌图表组件 InlineChart                                      │
 │  ▢ NATS 消息总线接入 (Agent间通讯)                                │
 │  ───────────────────────────────────────                        │
 │  产出: 张处长的Agent能本地回答问题 + 调用技能                     │
 ├─────────────────────────────────────────────────────────────────┤
 │  P2 技能系统 (第6-10天)                                         │
 │  ─────────────                                                  │
 │  ▢ 技能模板引擎 (trigger→pipeline→output)                        │
 │  ▢ 技能沙箱验证 (历史数据回放)                                    │
 │  ▢ 内嵌地图组件 InlineMap                                        │
 │  ▢ 内嵌表格组件 InlineTable                                      │
 │  ▢ 审批卡片 ApprovalCard                                         │
 │  ▢ 告警卡片 AlertCard                                            │
 │  ───────────────────────────────────────                        │
 │  产出: 技能可定义/验证/执行                                       │
 ├─────────────────────────────────────────────────────────────────┤
 │  P3 进化闭环 (第11-16天)                                        │
 │  ─────────────                                                  │
 │  ▢ 反思模块: LLM自问 → ReflectionNote                            │
 │  ▢ 提炼模块: 情景记忆→语义记忆                                    │
 │  ▢ 生成模块: 模式→技能模板                                        │
 │  ▢ 夜间批处理: 每周日全量反思                                     │
 │  ▢ 记忆四维存储 (SQLite + ChromaDB)                               │
 │  ▢ 进化指标看板                                                   │
 │  ───────────────────────────────────────                        │
 │  产出: Agent自主观察模式 + 建议生成新技能                          │
 ├─────────────────────────────────────────────────────────────────┤
 │  P4 技能市场 + 模型同步 (第17-22天)                              │
 │  ─────────────                                                  │
 │  ▢ 技能市场: 发布/订阅/评估 (NATS)                                │
 │  ▢ GAIA技能仲裁: 审核/推荐/降级                                    │
 │  ▢ 模型版本管理 + 增量下发协议                                     │
 │  ▢ LoRA增量同步 (断点续传)                                        │
 │  ▢ 同部门自动共享 + 跨部门审批                                     │
 │  ───────────────────────────────────────                        │
 │  产出: Agent间自动共享技能 + 模型更新推送                          │
 ├─────────────────────────────────────────────────────────────────┤
 │  P5 联邦训练 + 蒸馏 (第23-30天)                                  │
 │  ─────────────                                                  │
 │  ▢ 省厅训练集群搭建 (8×昇腾910B 或等效)                            │
 │  ▢ LoRA微调管道 (LLaMA-Factory)                                   │
 │  ▢ 知识蒸馏: 72B→14B→7B→3B                                       │
 │  ▢ 联邦聚合: FedAvg + 差分隐私                                    │
 │  ▢ 市州本地精调流程                                                │
 │  ▢ 量化打包 + 分发                                                │
 │  ───────────────────────────────────────                        │
 │  产出: 完整的训练→蒸馏→分发→本地推理闭环                           │
 └─────────────────────────────────────────────────────────────────┘
```

### 15.1 里程碑总览

| 里程碑 | 天数 | 核心交付 | 验收标准 |
|--------|------|---------|---------|
| **M0** | 第2天 | Chat界面 + Schema | 三栏可交互，5文件夹定义完成 |
| **M1** | 第5天 | 本地Agent推理 | 张处长的Agent本地回答问题 |
| **M2** | 第10天 | 技能系统可用 | 12个技能可定义/验证/执行 |
| **M3** | 第16天 | 自主进化 | Agent自动识别模式，建议新技能 |
| **M4** | 第22天 | 技能市场+模型同步 | 跨Agent技能共享，LoRA增量推送 |
| **M5** | 第30天 | 联邦训练闭环 | 省厅训练→市州精调→个人推理全通 |

---

## 16. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 国产GPU算力不足跑7B | 中 | 高 | 准备3B/1.5B降级方案，Q2量化 |
| Ollama不支持国产GPU | 中 | 高 | llama.cpp C++编译适配；华为用MindSpore |
| 市州训练数据量不足 | 高 | 中 | Few-shot Learning + 数据增强；省厅提供基础权重 |
| 联邦训练通信中断 | 中 | 中 | 异步聚合 + 断点续传；不阻塞本地推理 |
| Agent技能生成质量差 | 中 | 中 | 沙箱验证 + 人工审核关卡 + A/B对比 |
| NATS/GOVMCP部署复杂 | 低 | 低 | Docker Compose 一键部署；提供离线安装包 |
| 400人同时本地推理 | 低 | 中 | 省厅中心推理池作为降级备份 |

---

## 附录

### A. 文件命名规范

```
前端: kebab-case (chat-store.ts, message-bubble.tsx)
后端: snake_case (agent_engine.py, govmcp_bridge.py)
Agent目录: snake_case (zhang_chufa_01, env_monitoring_expert)
模型文件: {model}-{quant}.gguf (qwen2.5-7b-q4_k_m.gguf)
LoRA适配器: {agent_id}_lora_v{N}.gguf (zhang_chufa_lora_v3.gguf)
```

### B. 端口规划

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Vite Dev | 5173 | 开发环境 |
| 前端 Preview | 4173 | 预览构建产物 |
| 后端 FastAPI | 8000 | API服务 |
| NATS | 4222 | 消息总线 |
| Ollama | 11434 | 本地推理 |
| ChromaDB | 8001 | 向量数据库 |
| MinIO | 9000 | 对象存储 |
| PostgreSQL | 5432 | 业务数据库 |
| Redis | 6379 | 缓存 |

### C. 环境变量

```bash
# 省厅中心
ECOMIND_ROLE=province_center
ECOMIND_GPU_COUNT=8
ECOMIND_MODEL_PATH=/data/models/

# 市州平台
ECOMIND_ROLE=city_platform
ECOMIND_CITY=changsha
ECOMIND_GPU_COUNT=4
ECOMIND_GOVMCP_SECRET=/etc/ecomind/govmcp.key

# 个人工作站
ECOMIND_ROLE=personal_workstation
ECOMIND_AGENT_ID=zhang_chufa_01
ECOMIND_LOCAL_MODEL=qwen2.5-7b-q4_k_m
ECOMIND_OLLAMA_URL=http://localhost:11434
```

---

*方案版本: v6.5 | 生成时间: 2026-05-26 | 作者: EcoMind OS 技术团队*
