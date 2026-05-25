# EcoMind OS GPL-3.0 License 正式审查

> 基于评估报告 Top10 风险 #7（OpenHuman GPL-3.0传染风险）和《创始人手册》Ch5 常见风险（"安全与合规不再可推迟"）

---

## 一、GPL-3.0 核心条款解读

### 1.1 什么是"衍生作品"（Derivative Work）

GPL-3.0 定义衍生作品包括但不限于：

| 情形 | 是否构成衍生作品 | 法律依据 |
|------|:--------------:|---------|
| 直接复制GPL代码并修改 | 是 | 明确的衍生作品 |
| 将GPL代码编译链接到你的程序 | 是（动态链接也存在争议） | GPL-3.0 §0 |
| 使用GPL库的API接口（仅调用，不包含代码） | 存在争议 | FSF认为是衍生，部分法院有不同判决 |
| 参考GPL代码的设计理念重写 | 一般不是 | 需要确保没有"实质性相似" |
| 使用GPL项目的配置文件/数据格式 | 一般不是 | 数据格式通常不受版权保护 |

### 1.2 关键区别：代码 vs 设计

| 维度 | 受GPL保护 | 不受GPL保护 |
|------|:---------:|:----------:|
| 源代码 | 是 | — |
| 编译后的二进制 | 是 | — |
| 架构设计图 | — | 不受版权保护（思想vs表达） |
| API接口定义 | 存在争议 | FSF认为是衍生 |
| 设计理念和概念 | — | 思想不受版权保护 |
| 文档描述的算法 | — | 不受版权保护（专利另议） |

### 1.3 传染性分析

```
OpenHuman (GPL-3.0)
    │
    ├── 直接复制代码 → EcoMind OS 必须开源 (GPL-3.0) ❌ 致命
    │
    ├── 动态链接/导入模块 → 大概率需要开源 ❌ 高风险
    │
    ├── 仅调用API → 存在争议，FSF倾向认为是衍生 ⚠️ 中风险
    │
    ├── 参考设计理念重写 → 一般不需要开源 ✅ 低风险
    │
    └── 完全独立实现 → 不需要开源 ✅ 无风险
```

---

## 二、OpenHuman 依赖分析

### 2.1 当前策略评估

EcoMind OS 当前的策略：**仅参考OpenHuman的设计理念，严禁直接复制任何代码。**

| 设计理念参考 | EcoMind OS实现 | 风险评估 |
|------------|---------------|---------|
| 三层记忆架构（短期/长期/工作） | Hermes-Agent的MemoryProvider | ✅ 低风险（Hermes是MIT协议） |
| 记忆树结构 | 未直接采用，使用PostgreSQL+pgvector | ✅ 无风险 |
| Subconscious潜意识层 | 未采用 | ✅ 无风险 |
| TokenJuice（CJK优化） | 未采用 | ✅ 无风险 |
| Composio集成 | 未采用 | ✅ 无风险 |
| prompt_injection防护 | 自研（基于L1/L2/L3分级） | ✅ 无风险 |

### 2.2 风险点深度分析

#### 风险点1：记忆系统设计相似性

**问题描述**：EcoMind OS的L4认知记忆层与OpenHuman的记忆树在概念上高度相似（都采用多层记忆结构）。

**分析**：
- "多层记忆"是AI领域的通用概念（类似人类短期/长期记忆），不受版权保护
- 关键区别在于**具体实现**：EcoMind OS使用Hermes-Agent的MemoryProvider（MIT协议），不使用OpenHuman的任何代码
- 需确保代码实现中没有与OpenHuman"实质性相似"的部分

**建议**：保持当前策略，但在代码审查时增加"与OpenHuman代码相似度检查"步骤。

#### 风险点2：API兼容性

**问题描述**：如果EcoMind OS提供与OpenHuman兼容的API接口，是否构成衍生作品？

**分析**：
- API接口是否受版权保护在中国法律中存在争议
- FSF（自由软件基金会）的立场是：调用GPL程序的API构成衍生
- 但中国司法实践可能有所不同

**建议**：EcoMind OS **不提供**与OpenHuman兼容的API接口。所有API设计独立完成。

#### 风险点3：未来的功能需求

**问题描述**：如果EcoMind OS未来需要OpenHuman的某个特定功能（如Composio集成、TokenJuice优化），如何合法获取？

**分析**：
- 直接集成OpenHuman代码 → GPL传染，不可接受
- 独立实现相同功能 → 可行但需要确保不复制代码
- 寻找MIT/BSD替代方案 → 最佳路径

**建议**：建立"功能需求 → 许可证检查"流程，任何引入新依赖前必须做License审查。

---

## 三、其他依赖 License 矩阵

### 3.1 核心框架

| 组件 | License | 版本 | 商业使用 | 修改义务 | 分发义务 | 风险 |
|------|---------|------|:--------:|:--------:|:--------:|:----:|
| OpenClaw | MIT | latest | 是 | 无 | 保留版权声明 | 低 |
| Hermes-Agent | MIT | latest | 是 | 无 | 保留版权声明 | 低 |
| OpenHuman | **GPL-3.0** | latest | 是 | **修改须开源** | **衍生作品须GPL** | **高** |
| Marvis | 闭源 | — | 需授权 | 不可修改 | 不可分发 | 中 |

### 3.2 Python生态

| 组件 | License | 风险 |
|------|---------|:----:|
| FastAPI | MIT | 低 |
| PostgreSQL (libpq) | PostgreSQL License (BSD-like) | 低 |
| Redis | BSD-3-Clause | 低 |
| Celery | BSD-3-Clause | 低 |
| LiteLLM | MIT | 低 |
| Pydantic | MIT | 低 |
| LangChain | MIT | 低 |
| LlamaIndex | MIT | 低 |
| pgvector | PostgreSQL License | 低 |

### 3.3 前端生态

| 组件 | License | 风险 |
|------|---------|:----:|
| React | MIT | 低 |
| Cesium.js | Apache-2.0 | 低 |
| Tailwind CSS | MIT | 低 |

### 3.4 基础设施

| 组件 | License | 风险 |
|------|---------|:----:|
| Docker | Apache-2.0 | 低 |
| Nginx | BSD-2-Clause | 低 |
| PostgreSQL | PostgreSQL License | 低 |
| Neo4j Community | GPL-3.0 | **中** |
| Neo4j Enterprise | 商业 | 需付费 |

> 注意：Neo4j Community Edition是GPL-3.0。如果EcoMind OS将Neo4j作为数据库使用（不修改源码，不分发Neo4j本身），通常不构成衍生作品。但如果修改Neo4j源码或将其嵌入产品分发，则需要开源。**建议使用Neo4j Enterprise（商业许可）或使用Apache-2.0的图数据库替代方案（如Apache AGE）。**

---

## 四、防护措施

### 4.1 代码审查清单

每次代码提交/PR前，检查：

- [ ] 本次变更是否引入了任何GPL-3.0代码的复制或修改？
- [ ] 新增的第三方依赖License是否兼容（MIT/BSD/Apache-2.0）？
- [ ] API设计是否与GPL项目独立（不刻意兼容GPL项目API）？
- [ ] 注释中是否包含GPL项目的代码片段？（即使是小片段也有风险）

### 4.2 架构文档要求

为每个核心模块维护以下文档：

```markdown
## 模块：[模块名]

### 设计灵感来源
- [参考的项目/论文/文档]
- 参考了什么设计理念（非代码）
- 与参考项目的关键区别

### 独立开发证明
- 首次实现日期：
- 开发者：
- 代码仓库提交历史链接：
- 设计文档链接：
```

### 4.3 接口隔离策略

```
┌──────────────────────────────┐
│      EcoMind OS (MIT/BSD)     │
│                              │
│  ┌────────┐    ┌──────────┐  │
│  │ 内部模块 │    │ API层    │  │
│  └────────┘    └────┬─────┘  │
│                      │        │
│               ┌──────┴──────┐ │
│               │  接口抽象层  │ │
│               └──────┬──────┘ │
└──────────────────────┼────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
   ┌─────┴─────┐ ┌─────┴────┐ ┌─────┴─────┐
   │ OpenClaw  │ │  Hermes  │ │ Neo4j     │
   │ (MIT)     │ │  (MIT)   │ │ (GPL-3.0) │
   └───────────┘ └──────────┘ └───────────┘
```

**关键原则**：对GPL组件通过**独立接口抽象层**隔离，确保EcoMind OS核心代码不直接依赖GPL实现。

### 4.4 依赖引入流程

```
新依赖请求
  ↓
Step 1: License识别 → 是否GPL/AGPL/SSPL？
  ├── 是 → Step 2: 必要性评估 → 有无MIT/BSD替代？
  │         ├── 有替代 → 使用替代方案
  │         └── 无替代 → Step 3: 风险评估 → 是否修改/分发？
  │                   ├── 仅使用（不修改不分发）→ 可接受，记录风险
  │                   └── 需要修改/分发 → 拒绝或寻求法律意见
  └── 否 → Step 4: 合规审查 → 检查专利条款、商标限制
             └── 通过 → 引入并记录到License矩阵
```

---

## 五、替代方案：如果需要OpenHuman功能

| OpenHuman功能 | EcoMind OS替代方案 | License |
|--------------|-------------------|---------|
| 三层记忆 | Hermes-Agent MemoryProvider | MIT |
| 记忆树 | PostgreSQL + pgvector 自研 | — |
| Subconscious | 自研（后台检索增强） | — |
| TokenJuice | LiteLLM Token计数优化 | MIT |
| Composio集成 | 自研MCP/ACP工具集成 | — |
| prompt_injection防护 | L1/L2/L3安全分级 + 输入过滤 | — |
| 118+工具集成 | MCP协议 + OpenClaw Clawhub | MIT |

**结论**：OpenHuman的所有功能都有MIT兼容的替代方案，EcoMind OS **不需要**直接使用OpenHuman代码。

---

## 六、正式审查建议：需法律顾问确认的问题清单

1. "仅参考GPL项目的设计理念（不复制代码），在EcoMind OS中独立实现类似功能，是否构成GPL衍生作品？"
2. "通过API调用部署在同一服务器上的GPL-3.0组件（如Neo4j Community），是否触发GPL传染？"
3. "Neo4j Community Edition (GPL-3.0) 作为独立数据库服务使用（不修改源码），是否需要EcoMind OS开源？"
4. "将GPL项目的文档/论文描述的算法独立实现，是否有版权风险？"
5. "EcoMind OS如果未来被收购，GPL相关的风险如何处理？"

**建议**：在MVP启动前（预算允许时），聘请熟悉开源License的知识产权律师进行一次正式审查。

---

*GPL-3.0 License审查创建于 2026-05-22 | 基于评估报告Top10风险#7*
