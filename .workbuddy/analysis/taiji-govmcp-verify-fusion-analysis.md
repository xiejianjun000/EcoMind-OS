# TAIJI-AGENT / GOVMCP / TAIJI-VERIFY 三项目融合分析

**日期**: 2026-05-22
**分析人**: 齐活林（Qi）· 交付总监
**项目版本**: Taiji-Agent 2.0.0 / Taiji-Verify 2.0.0

---

## 一、项目现状概览

### 1.1 三个"项目"的真实关系

经过完整的代码库分析，**三个项目并非独立平行项目，而是已经存在明确的主从关系和融合进展**：

| 维度 | TAIJI-AGENT | GOVMCP | TAIJI-VERIFY |
|------|-------------|--------|--------------|
| **仓库** | `xiejianjun000/taiji-agent` (独立仓库) | 无独立仓库，是 Agent 的子模块 | `xiejianjun000/taiji-verify` (独立仓库) |
| **规模** | 91MB, 170+ 文件 | 6 文件, ~55KB | 229KB, 80+ 文件 |
| **版本** | 2.0.0 (M4 交付完成) | 内置 v1.0.0 | 2.0.0 (六层架构) |
| **定位** | 主框架 / 融合容器 | 政务合规插件 | 防幻觉验证引擎 |
| **许可证** | MIT | MIT (跟随主仓库) | MIT |
| **Python 版本** | ≥3.11 | (跟随主仓库) | ≥3.9 |

### 1.2 融合进展现状

```
┌─────────────────────────────────────────────────────────────────┐
│                     TAIJI-AGENT 2.0 (主框架)                     │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │  Hermes   │  │  Harness  │  │   WFGY   │  │  GOVMCP       │   │
│  │  Engine   │  │ Runtime  │  │  防幻觉   │  │  (内嵌v1.0)   │   │
│  │ (M2完成)  │  │ (M3完成)  │  │ (原生)    │  │  (M4完成)     │   │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           TAIJI-VERIFY (内嵌副本, 8个核心模块)             │   │
│  │    delta_s | kun_guard | qian_advance | fu_return         │   │
│  │    xun_tune | guan_observe | polaris | symptom_map        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ⚠️ 独立 TAIJI-VERIFY 仓库有更丰富的六层架构（6层 > 内嵌的2层）   │
│     内嵌版本缺少: detection/diagnosis/reasoning/governance/       │
│                   execution 子模块                                │
└─────────────────────────────────────────────────────────────────┘
```

**关键发现**：

1. **GOVMCP 已经完全融合** — 作为 `src/taiji_agent/govmcp/` 内嵌模块，通过 `GovMCPBridge` 桥接标准 MCP 协议，通过 `GovEnhancedHermesEngine` 深度集成到引擎层
2. **TAIJI-VERIFY 存在版本差距** — Agent 内嵌的是精简版（8 个八卦核心模块），独立仓库是完整六层架构版（含 detection/reasoning/diagnosis/governance/execution 五大子模块 + 16 种失败模式）
3. **融合的真正任务** — 不是"如何融合三个项目"，而是**如何将 TAIJI-VERIFY 独立仓库的六层架构完整同步到 TAIJI-AGENT 内嵌模块中**

---

## 二、模块级详细对比

### 2.1 TAIJI-VERIFY：内嵌版 vs 独立版

| 层级 | 内嵌版 (Agent 内) | 独立版 (Verify 仓库) | 差距 |
|------|-------------------|---------------------|------|
| **Layer 1: 核心层** | ✅ 完整 (8个模块) | ✅ 完整 (8个模块) | **无差距** |
| **Layer 2: 检测层** | ❌ 无 | ✅ RuleEngine + HallucinationDetector + SelfConsistencyChecker + SourceTracer + StreamGuard + EcoRules | **需补全** |
| **Layer 3: 推理层** | ❌ 无 | ✅ SevenStepChain + SemanticFirewall + Coupler + Checkpoint | **需补全** |
| **Layer 4: 诊断层** | ❌ 无 | ✅ GlobalFixMap + TroubleshootingAtlas | **需补全** |
| **Layer 5: 治理层** | ❌ 无 | ✅ TwinAtlas + InverseAtlas + 7 GovernanceGates | **需补全** |
| **Layer 6: 执行层** | ❌ 无 | ✅ GoalCompiler + ExecutionTokenBoard + LeakAuditor | **需补全** |
| **失败模式** | ❌ 无 | ✅ 16 种失败模式 (FailureModeDetector) | **需补全** |
| **Embedding** | ❌ 无 | ✅ SimpleBagOfWordsProvider | **需补全** |
| **测试覆盖** | ~10 个测试 | **450 个测试，91% 覆盖率** | **差距巨大** |

### 2.2 GOVMCP 内嵌架构分析

GOVMCP 已经通过三个层集成到 Taiji-Agent：

```
┌─ Layer 1: GovMCPServer (底层) ─────────────────────────────┐
│  crypto.py     → SM2/SM3/SM4 国密加密                      │
│  workflow.py   → 审批工作流 + 会签                          │
│  tools.py      → 公文/政策/地址/身份证/脱敏等政务工具         │
│  plugins.py    → GovMCPPlugin 插件注册                      │
└────────────────────────────────────────────────────────────┘

┌─ Layer 2: GovMCPBridge (MCP 桥接层) ───────────────────────┐
│  govmcp_bridge.py → 将 GovMCP 暴露为标准 MCP Server        │
│  通过 aiohttp HTTP 接口，兼容 MCP 协议 (2024-11-05)        │
└────────────────────────────────────────────────────────────┘

┌─ Layer 3: GovMCPIntegration + GovEnhancedHermesEngine ────┐
│  govmcp_integration.py → 工具缓存、自动注册                │
│  gov_enhanced_engine.py → 继承 HermesAgentEngine            │
│  功能: enable_govmcp() / disable_govmcp()                  │
│  自动审计日志 + MCP 桥接                                   │
└────────────────────────────────────────────────────────────┘
```

### 2.3 TAIJI-AGENT 核心引擎链路

```
用户请求
  │
  ▼
TaijiAgent.run()                    ← agent/engine.py (核心 Loop)
  │
  ├── EventBus (事件总线)            ← event_bus.py
  │     └── TAIJI_VERIFY_RESULT 事件
  │
  ├── LLMProvider                   ← providers/ (Anthropic/OpenAI/Qwen/GLM/Kimi)
  │
  ├── WFGY (旧版验证)               ← wfgy/verifier.py (TaijiVerifier)
  │     └── 符号层规则 + 幻觉检测 + 自一致性
  │
  ├── TaijiVerifyPlugin             ← taiji_verify/plugins.py (内嵌版)
  │     └── 订阅 LLM_RESPONSE 事件，触发 verify
  │
  ├── ToolRegistry                  ← tools/registry.py
  │
  ├── GovEnhancedHermesEngine       ← gov_enhanced_engine.py
  │     └── GovMCPIntegration → GovMCPServer
  │
  ├── HermesAgentEngine             ← hermes_engine.py
  │     └── CrossSessionMemory + EvolutionEngine + SubAgent
  │
  └── SessionMemory                 ← memory/session.py
```

---

## 三、融合方案

### 3.1 融合策略：验证引擎升级同步

由于 GOVMCP 已完全融合，**唯一需要做的是 TAIJI-VERIFY 六层架构同步**。

**策略选择**：**引用式集成（pip 依赖）** 而非代码内嵌

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| ❌ 代码内嵌 | 复制 Verify 六层代码到 Agent | 单仓库部署 | 代码重复，维护噩梦 |
| ✅ **pip 依赖** | Agent 通过 `pip install taiji-verify` 引用 | 零重复，独立演进，版本锁定 | 需要两仓库协调发布 |
| ⚠️ Git Submodule | Git submodule 引用 | 代码在本地 | 版本管理复杂 |

**推荐方案**：pip 依赖 + 适配器模式

### 3.2 具体实施步骤

#### Step 1: 修改 pyproject.toml 添加依赖

```toml
# taiji-agent/pyproject.toml
dependencies = [
    # ... 现有依赖 ...
    "taiji-verify>=2.0.0",  # 新增：六层验证引擎
]
```

#### Step 2: 创建适配器层

将内嵌的 `src/taiji_agent/taiji_verify/` 替换为**适配器**，代理到 `taiji_verify` 独立包：

```
src/taiji_agent/taiji_verify/
├── __init__.py          # 改为从 taiji_verify 重新导出
├── adapter.py           # 新增：适配器，桥接独立包到 EventBus/Plugin
└── plugins.py           # 修改：使用独立包的 TaijiVerifyEngine
```

**adapter.py 核心逻辑**：

```python
"""
Taiji Verify 适配器 - 将独立 taiji_verify 包集成到 Taiji Agent 事件系统
"""
from taiji_verify.engine import TaijiVerifyEngine, Verdict
from taiji_agent.event_bus import EventBus, Event, EventType


class TaijiVerifyAdapter:
    """适配器：独立验证引擎 → Agent 事件系统"""

    def __init__(self, event_bus: EventBus, engine: TaijiVerifyEngine):
        self._bus = event_bus
        self._engine = engine

    async def verify_and_publish(self, input_text: str, ground_truth: str = None):
        """执行验证并发布事件"""
        response = self._engine.verify(
            input_text=input_text,
            ground_truth=ground_truth,
        )
        await self._bus.publish(Event(
            event_type=EventType.TAIJI_VERIFY_RESULT,
            data={
                "verdict": response.verdict.value,
                "delta_s": response.delta_s_result.delta_s if response.delta_s_result else 0,
                "is_passing": response.is_passing,
                "failure_detections": [fd.to_dict() for fd in response.failure_detections],
                "processing_time_ms": response.processing_time_ms,
            }
        ))
        return response
```

#### Step 3: 升级 TaijiVerifyPlugin

修改 `plugins.py` 使用完整的六层引擎替代内嵌的精简版：

```python
class TaijiVerifyPlugin(Plugin):
    async def on_load(self) -> bool:
        # 使用独立包的完整引擎
        from taiji_verify.engine import TaijiVerifyEngine
        from taiji_verify.detection.eco_rules import get_all_rules

        self._engine = TaijiVerifyEngine()
        # 加载生态环境规则
        eco_rules = get_all_rules()
        self._engine.load_rules(eco_rules)
        # ... 订阅事件
```

#### Step 4: 清理旧内嵌代码

| 旧文件（内嵌精简版） | 处理方式 |
|----------------------|----------|
| `taiji_verify/delta_s.py` | 删除，改用独立包 |
| `taiji_verify/kun_guard.py` | 删除，改用独立包 |
| `taiji_verify/qian_advance.py` | 删除，改用独立包 |
| `taiji_verify/fu_return.py` | 删除，改用独立包 |
| `taiji_verify/xun_tune.py` | 删除，改用独立包 |
| `taiji_verify/guan_observe.py` | 删除，改用独立包 |
| `taiji_verify/polaris.py` | 删除，改用独立包 |
| `taiji_verify/symptom_map.py` | 删除，改用独立包 |
| `taiji_verify/plugins.py` | **保留并重写**（适配器） |
| `taiji_verify/__init__.py` | **保留并重写**（代理导出） |

#### Step 5: 生态环境规则对接

独立 `taiji-verify` 仓库已有 `detection/eco_rules.py`，包含生态环境专属规则：

- `FakeStandardRule` — 虚假标准检测
- `TimeTravelRule` — 时间穿越检测
- `SelfContradictionRule` — 自相矛盾检测
- `WrongLegalStatusRule` — 错误法律状态检测
- `FakeHistoryRule` — 虚构历史检测

这些规则可直接加载到 TaijiVerifyEngine 中，为生态环境场景提供领域专属验证。

---

## 四、融合后的架构全景图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TAIJI-AGENT 3.0 (融合后)                      │
│                                                                       │
│  ┌─── 核心引擎层 ───────────────────────────────────────────────┐   │
│  │  TaijiAgent (Agent Loop)                                     │   │
│  │  ├── LLM Providers (Anthropic/OpenAI/Qwen/GLM/Kimi)          │   │
│  │  ├── EventBus (事件总线)                                      │   │
│  │  ├── ToolRegistry + Skills Hub                                │   │
│  │  ├── SessionMemory + CrossSessionMemory                       │   │
│  │  └── Plugin System                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─── 验证引擎层 (pip: taiji-verify>=2.0.0) ───────────────────┐   │
│  │  TaijiVerifyEngine (六层融合)                                  │   │
│  │  ├─ L1: ΔS + 坤守 + 乾进 + 复归 + 巽调 + 北辰               │   │
│  │  ├─ L2: 规则引擎 + 幻觉检测 + 溯源 + 生态规则 ★              │   │
│  │  ├─ L3: 七步链 + 语义防火墙 + 耦合器 + 检查点               │   │
│  │  ├─ L4: 全局修复图 + 故障排除图谱                            │   │
│  │  ├─ L5: 双图 + 7治理门                                      │   │
│  │  └─ L6: 目标编译器 + 泄漏审计                                │   │
│  │                                                               │   │
│  │  TaijiVerifyAdapter ← 桥接到 EventBus                        │   │
│  │  TaijiVerifyPlugin ← 订阅 LLM_RESPONSE 事件                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─── 政务合规层 (内嵌模块) ──────────────────────────────────┐   │
│  │  GovMCPServer                                                │   │
│  │  ├── crypto.py → SM2/SM3/SM4 国密 + 审计链                 │   │
│  │  ├── workflow.py → 审批工作流 + 会签                        │   │
│  │  ├── tools.py → 公文/政策/地址/身份证/脱敏                   │   │
│  │  ├── GovMCPBridge → MCP 协议桥接                            │   │
│  │  └── GovEnhancedHermesEngine → 深度引擎集成                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─── 扩展能力层 ─────────────────────────────────────────────┐   │
│  │  ├── HermesAgentEngine → 跨会话记忆 + 三层进化              │   │
│  │  ├── MultiAgentCoordinator → 多智能体协调                   │   │
│  │  ├── TokenJuice → Token 压缩 (CJK/HTML/URL/去重)           │   │
│  │  ├── Guardrails → 输入/输出安全护栏                         │   │
│  │  ├── HITL → 人工审批 + 置信度门控                           │   │
│  │  ├── Observability → LangSmith/OpenTelemetry 追踪           │   │
│  │  ├── Desktop → PyQt6 GUI + 吉祥物 + 语音                    │   │
│  │  └── Visual → Mermaid/ASCII/HTML 工作流导出                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 五、风险与注意事项

### 5.1 版本兼容性

| 风险 | 说明 | 缓解措施 |
|------|------|----------|
| Python 版本差异 | Agent 要求 ≥3.11，Verify 要求 ≥3.9 | 以 3.11 为基准，兼容 |
| 导入路径冲突 | 内嵌 `taiji_agent.taiji_verify` vs 独立 `taiji_verify` | 删除内嵌版，统一用独立包 |
| numpy 依赖 | Verify 依赖 numpy，Agent 可选依赖 | 将 numpy 加入 Agent 核心依赖 |
| WFGY 与 Verify 重叠 | Agent 内的 `wfgy/` 和 `taiji_verify/` 功能重叠 | WFGY 保留为轻量快速验证，Verify 用于完整六层验证 |

### 5.2 功能去重

| 功能 | WFGY (wfgy/) | TAIJI-VERIFY (独立包) | 建议 |
|------|---------------|----------------------|------|
| 符号层规则验证 | TaijiVerifier | RuleEngine (L2) | Verify 统一，WFGY 标记 deprecated |
| 幻觉检测 | HallucinationDetector | HallucinationDetector (L2) | Verify 统一 |
| 自一致性检查 | SelfConsistencyChecker | SelfConsistencyChecker (L2) | Verify 统一 |
| 知识溯源 | SourceTracer | SourceTracer (L2) | Verify 统一 |
| ΔS 计算 | ❌ 无 | DeltaSCalculator (L1) | 仅 Verify |
| 七步推理链 | ❌ 无 | SevenStepChain (L3) | 仅 Verify |
| 治理门 | ❌ 无 | GovernanceGates (L5) | 仅 Verify |

### 5.3 测试覆盖提升

| 指标 | 融合前 | 融合后目标 |
|------|--------|-----------|
| TAIJI-VERIFY 测试数 | ~10 (内嵌) | **450** (独立包) |
| 验证层覆盖率 | 未知 | **91%** |
| GovMCP 测试数 | 104 | 104 (不变) |
| 端到端集成测试 | 有 | 需新增 Verify 六层 E2E 测试 |

---

## 六、融合工作清单（按优先级排序）

### P0 — 必做（核心同步）

| # | 任务 | 工作量 | 说明 |
|---|------|--------|------|
| 1 | pyproject.toml 添加 `taiji-verify>=2.0.0` 依赖 | 5 min | 一行配置 |
| 2 | 删除 `src/taiji_agent/taiji_verify/` 中 8 个内嵌核心模块 | 15 min | delta_s/kun_guard/qian_advance/fu_return/xun_tune/guan_observe/polaris/symptom_map |
| 3 | 重写 `taiji_verify/__init__.py` 为代理导出 | 10 min | `from taiji_verify import *` 重导出 |
| 4 | 创建 `taiji_verify/adapter.py` | 30 min | 适配器桥接 EventBus |
| 5 | 重写 `taiji_verify/plugins.py` | 20 min | 使用独立包 TaijiVerifyEngine |
| 6 | 更新 `agent/engine.py` 导入路径 | 15 min | 确保所有引用正确 |

### P1 — 应做（质量保障）

| # | 任务 | 工作量 | 说明 |
|---|------|--------|------|
| 7 | 加载 eco_rules 生态环境规则到引擎 | 15 min | 领域专属验证 |
| 8 | WFGY 模块标记 deprecated | 10 min | 注释 + 文档说明 |
| 9 | 新增 Verify 六层集成测试 | 1h | 端到端验证链路测试 |
| 10 | 更新 README.md 融合说明 | 20 min | 文档同步 |

### P2 — 可选（锦上添花）

| # | 任务 | 工作量 | 说明 |
|---|------|--------|------|
| 11 | GovMCP 审计日志接入 Verify 泄漏审计 | 30 min | L6 LeakAuditor 集成 |
| 12 | 配置化验证阈值 (per-environment) | 20 min | 开发/测试/生产不同阈值 |
| 13 | 验证结果可视化 (Mermaid 图) | 45 min | 六层验证结果导出 |

---

## 七、结论

**融合的本质**：不是"合并三个项目"，而是**升级 TAIJI-AGENT 中内嵌的精简版 TAIJI-VERIFY 到独立仓库的完整六层架构版**。

**工作量评估**：P0 任务约 **2 小时**即可完成核心同步，P1 任务约 **2 小时**完成质量保障，总计 **4 小时**可达到生产就绪的融合状态。

**关键决策**：采用 **pip 依赖 + 适配器模式**，而非代码内嵌复制。这确保两个仓库可以独立演进，Taiji-Verify 的六层架构改进会自动惠及 Taiji-Agent。
