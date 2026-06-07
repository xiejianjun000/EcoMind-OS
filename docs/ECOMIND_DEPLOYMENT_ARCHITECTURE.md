# EcoMind 全员 AI 终端部署 + 分层模型训练方案

> 状态：**架构设计完成，待实施**
> 创建时间：2026-05-29
> 前置讨论：基于现有代码库（backend/ + .github-clone/frontend/）的可行性分析

---

## 一、整体架构概览

### 1.1 组织拓扑

```
┌─────────────────────────────────────────────────────┐
│              湖南省生态环境厅                         │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ 厅领导    │    │ 各处室    │    │ 14个市州  │      │
│  │ (leader) │    │ (chief)  │    │ (city)   │      │
│  │  ~10人   │    │ ~100人   │    │ ~500人   │      │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘      │
│       └───────────────┼───────────────┘             │
│                       ▼                             │
│              ┌─────────────────┐                    │
│              │  EcoMind Server  │                   │
│              │  统一后端         │                   │
│              └────────┬────────┘                    │
│         ┌─────────────┼─────────────┐              │
│         ▼             ▼             ▼              │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│    │ 娄底试点 │  │ 长沙... │  │ 其他市州 │          │
│    │ ~50人   │  │ 待推广   │  │ 待推广   │          │
│    └─────────┘  └─────────┘  └─────────┘          │
└─────────────────────────────────────────────────────┘
```

### 1.2 三级推理架构（L1/L2/L3）

| 层级 | 部署位置 | 模型规模 | 硬件需求 | 服务对象 | 用途 |
|---|---|---|---|---|---|
| **L1 省厅云端** | 省厅机房 | DeepSeek-R1-671B / Qwen3-72B | 8×H100 或等价国产卡（昇腾910B） | 全省复杂任务 | 法规深度分析、跨市州对比、应急指挥 |
| **L2 市局服务器** | 各市州局机房 | Qwen3-14B / GLM-4-9B | 1-2×T4 或 L20（可复用现有服务器） | 本市日常查询 | 环境数据解读、执法文书、环评辅助 |
| **L3 个人电脑端侧** | 个人桌面/笔记本 | Qwen2.5-3B / MiniCPM-4B | 纯 CPU 即可（16GB 内存），有 GPU 更佳 | 离线兜底/敏感数据不离机 | 网络中断时可用、简单问答 |

**自动降级策略**：L1 可用 → 用 L1 → L1 超时 → 降 L2 → L2 不可用 → 降 L3 → 全部不可用 → 离线提示

---

## 二、四级权限与数据隔离体系

### 2.1 角色定义（已有代码：authStore.ts）

| 角色 | 代码标识 | 人数级 | 数据范围 | 可用专家 | 典型场景 |
|---|---|---|---|---|---|
| 🏛️ 厅领导 | `leader` | ~10 人 | **全省 14 市全部数据** | 全部 12 个专家 | "全省 AQI 排名？" |
| 👔 处长 | `chief` | ~100 人 | **本处室业务数据** | 本处室关联 2-3 个专家 | "执法局本月立案？" |
| 🏙️ 市州 | `city` | ~500 人 | **仅本市数据**（System Prompt 注入 city） | 全部 12 专家（数据范围受限） | "娄底市今日空气质量？" |
| 🛡️ 管理员 | `admin` | ~15 人 | 系统运维数据 | 无（仅管理功能） | "当前多少终端在线？" |

### 2.2 System Prompt 角色注入（待实现）

在 `deepseek.ts` 的 `buildSystemPrompt()` 中注入：
```
当前用户角色: {role}
所属地市: {city}
所属部门: {department}
数据访问边界: 根据 role 和 city 自动限制
```

---

## 三、分层模型训练方案

### 3.1 省厅大模型选型

| 方案 | 基座模型 | 参数量 | 显存需求 | 推荐度 |
|---|---|---|---|---|
| A. DeepSeek-R1 私有化 | DeepSeek-R1-671B | 671B | 8×H100 (80GB) × 8卡 ≈ 640GB | ⭐⭐⭐⭐⭐ 最强 |
| B. Qwen3-72B 微调 | Qwen3-72B-Instruct | 72B | 4×A100 (80GB) ≈ 320GB | ⭐⭐⭐⭐ 性价比最优 |
| C. GLM-4-9B 轻量起步 | GLM-4-9B-Chat | 9B | 1×A100 (80GB) | ⭐⭐⭐ 算力有限时 |

**推荐路径**：先上 Qwen3-72B（阿里开源，中文生态最好，政府友好），后续升级 DeepSeek-R1。

### 3.2 市州小模型来源：知识蒸馏（不是各市州独立训练）

```
省厅大模型 Teacher（67B/72B）
    ↓  用全省 14 市对话数据做蒸馏
    ↓
市州小模型 Student（7B/14B）
    ├── EcoMind-Loudi-7B（娄底专用，娄底数据 x3 过采样）
    ├── EcoMind-Changsha-7B（长沙专用）
    ├── ...
    └── EcoMind-General-14B（通用，给数据少的市州用）
```

**为什么不由各市州自己训？**
1. 算力不够（7B 全量微调需 1-2 张 A100）
2. 数据不够（单市州日均几百条不够支撑微调）
3. 无 ML 工程师团队
4. 数据安全要求集中管理

### 3.3 各市州模型的差异化

| 维度 | 省厅通用模型 | 娄底专属模型 | 长沙专属模型 |
|---|---|---|---|
| 基座 | Qwen3-72B | 从 72B 蒸馏 7B | 从 72B 蒸馏 7B |
| 训练数据 | 全省 14 市混合 | **娄底数据 ×3 过采样** | **长沙数据 ×2 过采样** |
| System Prompt | 通用环保知识 | 注入娄底特色产业（钢铁/煤炭/建材） | 注入长沙特色（工程机械/园区环评） |
| 本地知识 | 国家+省级法规 | + 娄底地方性法规+本地企业名单 | + 长沙地方文件+湘江治理专项 |
| 部署位置 | 省厅机房 | 娄底市局服务器或省厅云 | 长沙市局服务器 |
| 更新频率 | 每月 | 每季度 | 每月 |

---

## 四、数据飞轮：从对话到训练数据的闭环

### 4.1 核心洞察

> **EcoMind 的每一个终端用户都是"免费的数据标注员"** —— 他们提出真实业务问题、AI 回答、用户用 👍👎 判断好坏。
> 半年内积累出全国最优质的生态环境领域训练数据。

### 4.2 数据增长预估

| 时间 | 日活 | 人均日提问 | 日产训练条目 | 月积累 | 年积累 |
|---|---|---|---|---|---|
| 第 1 月（娄底试点） | 20 | 5 | ~100 | 3,000 | — |
| 第 3 月 | 35 | 8 | ~280 | 8,400 | — |
| 第 6 月（娄底全市） | 50 | 10 | ~500 | 15,000 | — |
| 全省推广后 | 500 | 10 | ~5,000 | 150,000 | **180万+** |

### 4.3 数据采集 Hook 实现（P0，待编码）

在 `deepseek.ts` 的 `onDone` 回调 + 后端 chat API 返回后异步写入：

```python
class TrainingDataCollector:
    async def collect_conversation(self, session_id, user_id, city, role,
                                     messages, tool_calls, satisfaction):
        # 1. PII 脱敏（人名/电话/地址/企业名替换为 [姓名]/[电话]/[地址]/[企业]）
        sanitized = self._sanitize_pii(messages)
        # 2. 质量过滤（太短/纯闲聊/出错的不收）
        if not self._quality_check(sanitized): return
        # 3. 自动打标签
        tags = self._auto_tag(messages, tool_calls)
        # 4. 写入训练数据湖（按城市分目录）
        await self._write_to_datalake(city, role, {
            "instruction": 用户最后的问题,
            "response": AI 最后的回答,
            "tags": tags,
            "metadata": {...}
        })
```

### 4.4 数据流水线

```
数据产生(终端对话/工具调用/用户反馈)
    ↓
数据采集(Collector Hook，自动脱敏)
    ↓
脱敏清洗(PII去除 + 格式标准化 + 去重去噪)
    ↓
标注质检(人工/Auto 质量打分 + 标签补全)
    ↓
入库归档(Git-LFS 版本管理 + 按城市/领域分目录)
    ↓
训练构建(数据集切分 SFT/DPO LoRA/QLoRA)
    ↓
模型评估(BLEU + 专业题库 + 人工对比评测)
    ↓
灰度发布(A/B Test 5%流量 → 全量)
    ↓
效果监控(在线指标: 满意率/准确率/幻觉率/回归检测)
```

---

## 五、省厅训练数据回归管理

### 5.1 新增管理页面清单

| 页面 | 功能 | 优先级 |
|---|---|---|
| `/admin/data/dashboard` | 数据总览大屏：全省 14 市日产数据量/累计总量/质量分布 | P1 |
| `/admin/data/browser` | 数据明细查询：按市州/时间/领域/质量筛选查看原始对话 | P1 |
| `/admin/data/privacy` | 脱敏配置中心：PII 规则管理 | P1 |
| `/admin/models/train` | 训练任务管理：提交/监控进度/下载权重 | P2 |
| `/admin/models/versions` | 模型版本列表：V1/V2/V3 对比/回滚/A-B测试 | P2 |
| `/admin/data/upstream` | 数据回流监控：各市州上报量/延迟/异常告警 | P2 |

### 5.2 数据集版本化（TrainingDatasetVersion）

```python
@dataclass
class TrainingDatasetVersion:
    version_id: str           # "v2025.03-loudi-q1"
    version_name: str         # "2025Q1 娄底市环境监测专题"
    source_cities: list[str]
    date_range: tuple[str,str]
    record_count: int
    quality_score: float      # 质检后平均分
    domains: list[str]
    pii_status: str           # "sanitized" / "raw" / "pending"
    model_trained: str        # 对应训练出的模型
    eval_score: dict          # {"bleu":0.82, "human":4.2/5}
    git_commit: str           # Git-LFS commit hash
    parent_version: str       # 上一个版本（用于 diff）

@dataclass
class ModelRelease:
    release_id: str
    model_name: str           # "ecomind-loudi-7b"
    base_model: str           # "Qwen3-7B"
    dataset_version: str      # 关联的训练数据版本
    training_method: str      # "qlora" / "full_sft" / "dpo"
    eval_benchmark: dict
    deployment_targets: list[str]
    status: str               # "testing" / "production" / "rolled_back"
    rollback_reason: str | None
    released_by/at: str
```

### 5.3 回归检测机制

每次发布新模型前必须通过三关：

1. **固定测试集关**（500 道环保专业题目）
   - 上版准确率 91% → 新版 93% ✅ 通过
   - 上版 91% → 新版 89% ❌ 回退排查

2. **A/B 灰度关**（5% 流量跑新版）
   - 监控：满意度、工具调用成功率、幻觉率
   - 幻觉率上升 > 2% → 自动触发回滚

3. **市州反馈关**
   - 每条回复旁 👍👎 反馈按钮
   - 汇总到省厅："娄底市对新版满意度下降 15%" → 触发该市模型回退

---

## 六、终端管理与调度

### 6.1 WebSocket 推送能力（已有代码，可直接复用）

[websocket/manager.py](backend/api/websocket/manager.py) 已实现 240 行生产级代码：

| 已有能力 | 复用方式 |
|---|---|
| `broadcast_to_topic(topic, data)` | 按主题广播（如 `city:loudi` 推送所有娄底终端） |
| `send_to_client(client_id, data)` | 点对点推送（强制某终端切换模式） |
| `subscribe/unsubscribe` | 客户端订阅不同主题频道 |
| `get_stats()` | 在线终端数/主题分布实时统计 |
| 后台广播队列 | 异步非阻塞推送 |

### 6.2 管理端操作 → 推送映射

| 管理操作 | WebSocket 推送 |
|---|---|
| 向娄底全体发通知 | `broadcast_to_topic("city:loudi", {type:"notice"})` |
| 强制切换应急模式 | `send_to_client(device_id, {type:"mode_switch", mode:"emergency"})` |
| 推送新法规到执法终端 | `broadcast_to_topic("role:chief:dept:enforcement", ...)` |
| 查看在线终端数 | `ws_manager.get_stats()` |

### 6.3 终端身份方案

每个终端 = 一个浏览器标签页（无需安装客户端，降低推广阻力）：
- 身份 = `localStorage.device_token` + 后端 `device_id`
- 首次打开 → 输入工号/手机号 → 后端验证 → 绑定终端 → 以后免登录
- 替代现有 Mock 账号系统（authStore.ts 的 MOCK_ACCOUNTS）

---

## 七、娄底试点路径（三步走）

### 第一步：最小可用版本（1-2 周）

| 动作 | 改动量 | 说明 |
|---|---|---|
| Mock 登录 → 工号+短信验证码 | 改 `authStore.ts` login() | 对接政务短信网关或微信扫码 |
| 批量生成娄底 50 个账号 | MOCK_ACCOUNTS 加 loudi-001~050 | 或 CSV 导入脚本 |
| System Prompt 注入 city=娄底市 | buildSystemPrompt() 加一行 | AI 自动回答娄底数据 |
| 娄底专属入口 URL | `?city=loudi` 参数自动选角色 | |

### 第二步：管理可见性（2-3 周）

| 新增模块 | 功能 | 复用什么 |
|---|---|---|
| 终端在线看板 | 地图+列表+角色筛选 | WebSocketManager.get_stats() |
| 使用统计面板 | 每人每天问了多少问题 | 新建 usage_log 表 |
| 消息广播 | 管理员→选定终端群发通知 | broadcast_to_topic() |

### 第三步：深度集成（1-2 月）

| 新增模块 | 功能 |
|---|---|
| OA/HR 对接 | 从省厅人事系统同步人员名单 |
| 国密 SM2 认证 | 用 govmcp/ 模块（代码已有未接入） |
| 移动端适配 | 响应式 + 微信小程序/PWA |
| 离线缓存 | Service Worker 缓存常用法规和知识库 |

---

## 八、硬件投入预算（给领导汇报用）

| 投入层级 | 硬件 | 服务范围 | 预算量级 |
|---|---|---|---|
| **省厅中心** | 8×H100 或等价国产卡（昇腾910B） | 全省 500+ 用户 | ~200-400 万 |
| **每个市局** | 1-2×T4 或 L20（复用现有服务器） | 本市 30-80 用户 | ~10-20 万/市 |
| **个人电脑** | 不需要额外投入（现有办公电脑即可） | 单人使用 | ¥0 |

**关键结论：GPU 集中在省厅和市局机房，个人电脑只负责打开浏览器。**

---

## 九、现有代码资产盘点（可直接复用的）

### ✅ 完整实现可直接用

| 模块 | 文件 | 行数 |
|---|---|---|
| 四级 RBAC 权限体系 | [authStore.ts](.github-clone/frontend/src/store/authStore.ts) | 179 行 |
| 14 市州列表（含娄底） | authStore.ts CityName 类型 | — |
| 19 个部门智能体 API | [departments.py](backend/api/routers/departments.py) | 98 行 |
| 12 个领域专家定义 | [expertStore.ts](.github-clone/frontend/src/store/expertStore.ts) | 311 行 |
| WebSocket 实时推送 | [manager.py](backend/api/websocket/manager.py) | 303 行 |
| 安全事件/审批/审计 Schema | [security.py schema](backend/api/schemas/security.py) | 127 行 |
| 三级模型路由（opus/sonnet/haiku） | [model_service.py](backend/api/services/model_service.py) | 430 行 |
| 19 个国产模型适配器 | [adapter.py](backend/inference/adapter.py) | 546 行 |
| 聊天记录持久化 | [chatStore.ts](.github-clone/frontend/src/store/chatStore.ts) | zustand persist |
| 反幻觉双重防线 | [deepseek.ts](.github-clone/frontend/src/services/deepseek.ts) | System Prompt + Agentic Loop 注入 |

### ⚠️ 有框架缺实现

| 模块 | 现状 | 缺什么 |
|---|---|---|
| 用户认证 | Mock 账号 | 无真实数据库/LDAP/SSO |
| 终端设备管理 | ConnectedClient 只有 client_id | 无设备指纹/绑定用户/在线追踪 |
| 审计日志 | Schema 定义完整 | 无写入逻辑/查询 API/存储 |
| 使用统计/配额 | 完全没有 | 无调用次数/费用核算/用量报表 |
| 对话数据采集 | **完全没有** | 无 Collector Hook/脱敏/训练数据导出 |
| 模型微调管理 | ModelService 只做路由 | 无训练任务提交/进度/版本管理 |
| 数据回流 | 无 | 无市州→省厅数据上报通道 |

---

## 十、下一步实施优先级

### P0 — 娄底试点前必须完成（~2 周）

1. **对话数据采集 Hook** → `data_collector.py`，chat API 返回后异步写数据湖
2. **PII 脱敏引擎** → presidium 库 + 自定义环保实体识别
3. **用户反馈按钮** → 前端消息旁 👍👎 + `/api/feedback`
4. **真实登录替代 Mock** → authStore.ts 对接工号认证
5. **System Prompt 注入角色/城市** → deepseek.ts buildSystemPrompt()

### P1 — 试点期间（~1 月）

6. 数据管理后台 `/admin/data/*`
7. 训练数据集 JSONL 导出（兼容 LLaMA-Factory）
8. 终端在线看板 + 消息广播
9. 三级模型路由扩展（L1/L2/L3 降级链）

### P2 — 全省推广前（~2 月）

10. 模型版本管理 API（train/versions/deploy/rollback）
11. 知识蒸馏 Pipeline（72B → 各市 7B）
12. A/B 测试框架（流量分配）
13. 数据回流定时任务（每日市州→省厅聚合）
14. OA/HR 对接 + 国密 SM2
