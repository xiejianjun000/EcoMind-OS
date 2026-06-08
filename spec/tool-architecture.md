# EcoMind OS — 工具与技能架构设计

> 适配自 Claude Code Agentic Architecture
> 状态：设计阶段 | 作者：EcoMind Architect | 日期：2026-05-28

---

## 一、架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                        User Input                                 │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    AGENT CORE (System Prompt)                     │
│  SOUL-EcoMind.md 人格 + 三条铁律 + 六阶段工作流                    │
│  "你是谁 + 你能做什么 + 你不能做什么 + 怎么做"                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                  AGENTIC LOOP (思考-行动-观察 循环)                │
│                                                                   │
│   ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐     │
│   │ THINK   │───▶│  PLAN   │───▶│   ACT    │───▶│ OBSERVE  │     │
│   │ 分析意图 │    │ 选择工具 │    │ 执行工具  │    │ 观察结果  │     │
│   └─────────┘    └─────────┘    └──────────┘    └────┬─────┘     │
│        ▲                                             │           │
│        └─────────────────────────────────────────────┘           │
│                       (循环直到任务完成)                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                      TOOL REGISTRY                               │
│  12个工具，JSON Schema 定义，按 L1/L2/L3 分级                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │env   │ │reg   │ │report│ │case  │ │map   │ │alert │  ...     │
│  │query │ │search│ │gen   │ │search│ │viz   │ │check │         │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘         │
└─────┼────────┼────────┼────────┼────────┼────────┼──────────────┘
      │        │        │        │        │        │
┌─────▼────────▼────────▼────────▼────────▼────────▼──────────────┐
│                    TOOL EXECUTOR (后端执行层)                     │
│  /api/tools/execute  →  router  →  handler  →  return result     │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐          │
│  │HTTP API │ │Python Lib│ │DB Query   │ │File System │          │
│  │Proxy    │ │(pandas)  │ │(法规/案例)│ │(报告/WORD) │          │
│  └─────────┘ └──────────┘ └───────────┘ └────────────┘          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                       GUARDRAILS (边界硬约束)                     │
│  L1: 公开数据只读 | L2: 业务数据可读写 | L3: 必须人工确认         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Permission   │  │ Rate Limit   │  │ Audit Log    │            │
│  │ Checker      │  │ (QPS/H)      │  │ (全量记录)    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、12 工具完整定义（适配自 Claude Code Tools）

### 工具 1：env_query — 环境数据查询

```json
{
  "name": "env_query",
  "description": "查询湖南省14市州实时环境监测数据（AQI、水质、气象）。返回结构化JSON。",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "城市名称，如 '长沙市'、'冷水江市'" },
      "data_type": { "type": "string", "enum": ["aqi", "water", "weather", "all"], "description": "数据类型" },
      "time_range": { "type": "string", "enum": ["latest", "24h", "7d", "30d"], "description": "时间范围" }
    },
    "required": ["city"]
  },
  "safety_level": "L1",
  "color": "blue",
  "expert_ids": ["ecomind", "env-monitoring", "emergency", "water", "carbon"]
}
```

**映射自 Claude Code：** `Bash` + `WebFetch` + `Read`
**后端实现：** `GET /api/environment/city/{name}` 已存在，直接对接

---

### 工具 2：regulation_search — 法规检索

```json
{
  "name": "regulation_search",
  "description": "搜索生态环境法规标准库，返回匹配的法规条款全文。支持关键词、法规名、条款号检索。",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "检索关键词或法规名称" },
      "law_name": { "type": "string", "description": "精确法规名，如 '大气污染防治法'" },
      "article_number": { "type": "string", "description": "条款编号，如 '第30条'" },
      "domain": { "type": "string", "enum": ["air", "water", "soil", "noise", "solid_waste", "eia", "carbon", "all"] },
      "max_results": { "type": "integer", "default": 5 }
    },
    "required": ["query"]
  },
  "safety_level": "L1",
  "color": "purple",
  "expert_ids": ["ecomind", "enforcement", "eia", "permit", "inspection"]
}
```

**映射自 Claude Code：** `Grep`
**后端实现：** `POST /api/tools/regulation/search` → 法规库全文检索

---

### 工具 3：report_generate — 报告生成

```json
{
  "name": "report_generate",
  "description": "基于模板和数据自动生成环境监测报告、执法文书、环评意见书。输出 DOCX/PDF/Markdown。",
  "parameters": {
    "type": "object",
    "properties": {
      "template": { "type": "string", "enum": ["monitoring_daily", "monitoring_weekly", "enforcement_decision", "eia_review", "emergency_plan", "inspection_report"] },
      "city": { "type": "string", "description": "目标城市" },
      "data": { "type": "object", "description": "报告所需数据（可选，不提供则自动获取）" },
      "format": { "type": "string", "enum": ["markdown", "docx", "pdf"], "default": "markdown" }
    },
    "required": ["template"]
  },
  "safety_level": "L2",
  "color": "green",
  "expert_ids": ["ecomind", "env-monitoring", "enforcement", "eia", "inspection"]
}
```

**映射自 Claude Code：** `Write`
**后端实现：** `POST /api/tools/report/generate` → 模板引擎 + 数据填充

---

### 工具 4：case_search — 案例检索

```json
{
  "name": "case_search",
  "description": "搜索历史执法案例、环评案例、修复案例，返回相似案例及处理结果。",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "案例关键词或描述" },
      "case_type": { "type": "string", "enum": ["enforcement", "eia", "restoration", "inspection", "all"] },
      "city": { "type": "string", "description": "限定城市" },
      "max_results": { "type": "integer", "default": 5 }
    },
    "required": ["query"]
  },
  "safety_level": "L1",
  "color": "purple",
  "expert_ids": ["enforcement", "eia", "inspection", "restoration"]
}
```

**映射自 Claude Code：** `Grep`
**后端实现：** `POST /api/tools/case/search` → 案例库语义检索

---

### 工具 5：map_visualize — 地图可视化

```json
{
  "name": "map_visualize",
  "description": "生成环境监测地图可视化：监测站分布、污染热力图、扩散模拟、生态红线叠加。",
  "parameters": {
    "type": "object",
    "properties": {
      "map_type": { "type": "string", "enum": ["station_distribution", "pollution_heatmap", "dispersion_simulation", "redline_overlay", "basin_overview"] },
      "city": { "type": "string" },
      "center": { "type": "object", "properties": { "lat": { "type": "number" }, "lng": { "type": "number" } } },
      "zoom": { "type": "integer", "default": 10 },
      "layers": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["map_type"]
  },
  "safety_level": "L1",
  "color": "blue",
  "expert_ids": ["ecomind", "env-monitoring", "emergency", "water", "biodiversity"]
}
```

**映射自 Claude Code：** `Write`（生成可视化配置 JSON，前端渲染）
**后端实现：** `POST /api/tools/map/generate` → 返回 GeoJSON/图层配置

---

### 工具 6：alert_check — 告警查询

```json
{
  "name": "alert_check",
  "description": "查询当前环境告警状态：AQI超标、水质异常、企业排放异常等。支持按城市、类型筛选。",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string" },
      "alert_type": { "type": "string", "enum": ["aqi", "water", "emission", "all"] },
      "severity": { "type": "string", "enum": ["warning", "critical", "emergency", "all"], "default": "all" },
      "time_range": { "type": "string", "enum": ["active", "24h", "7d"], "default": "active" }
    },
    "required": []
  },
  "safety_level": "L1",
  "color": "yellow",
  "expert_ids": ["ecomind", "env-monitoring", "emergency", "enforcement"]
}
```

**映射自 Claude Code：** `Read`
**后端实现：** `GET /api/tools/alert/status` → 返回活跃告警列表

---

### 工具 7：document_parse — 文档解析

```json
{
  "name": "document_parse",
  "description": "解析上传的文档（PDF/图片/Word），提取结构化信息。支持环评报告、执法文书、监测报告。",
  "parameters": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string", "description": "已上传文件的路径" },
      "parse_mode": { "type": "string", "enum": ["ocr", "text", "table", "auto"], "default": "auto" },
      "extract_fields": { "type": "array", "items": { "type": "string" }, "description": "需提取的字段列表" }
    },
    "required": ["file_path"]
  },
  "safety_level": "L2",
  "color": "green",
  "expert_ids": ["eia", "permit", "enforcement"]
}
```

**映射自 Claude Code：** `Read`
**后端实现：** `POST /api/tools/document/parse` → OCR/PDF解析引擎

---

### 工具 8：compliance_check — 合规校验

```json
{
  "name": "compliance_check",
  "description": "对项目/企业/行为进行法规合规性自动校验，逐条对照标准，返回合规结论与风险项。",
  "parameters": {
    "type": "object",
    "properties": {
      "target_type": { "type": "string", "enum": ["project", "enterprise", "behavior", "emission"] },
      "target_description": { "type": "string", "description": "校验对象描述" },
      "regulation_domain": { "type": "string", "enum": ["air", "water", "soil", "noise", "solid_waste", "eia", "carbon", "all"] },
      "city": { "type": "string", "description": "所在城市（匹配地方标准）" }
    },
    "required": ["target_type", "target_description"]
  },
  "safety_level": "L2",
  "color": "purple",
  "expert_ids": ["eia", "permit", "enforcement", "inspection"]
}
```

**映射自 Claude Code：** `Bash`（执行校验脚本）
**后端实现：** `POST /api/tools/compliance/check` → 规则引擎

---

### 工具 9：data_analyze — 数据分析

```json
{
  "name": "data_analyze",
  "description": "对环境监测数据进行统计分析：趋势分析、异常检测、多站点对比、相关性分析。",
  "parameters": {
    "type": "object",
    "properties": {
      "analysis_type": { "type": "string", "enum": ["trend", "anomaly", "compare", "correlation", "summary"] },
      "cities": { "type": "array", "items": { "type": "string" }, "description": "目标城市列表" },
      "indicators": { "type": "array", "items": { "type": "string" }, "description": "分析指标" },
      "time_range": { "type": "string", "enum": ["24h", "7d", "30d", "90d", "1y"] }
    },
    "required": ["analysis_type"]
  },
  "safety_level": "L1",
  "color": "blue",
  "expert_ids": ["env-monitoring", "water", "carbon", "biodiversity"]
}
```

**映射自 Claude Code：** `Bash`（Python pandas/numpy 脚本）
**后端实现：** `POST /api/tools/data/analyze` → pandas 统计引擎

---

### 工具 10：dispatch_expert — 专家调度

```json
{
  "name": "dispatch_expert",
  "description": "将当前任务分派给最合适的领域专家Agent。被调度的专家以子Agent模式运行，拥有独立的工具权限。",
  "parameters": {
    "type": "object",
    "properties": {
      "expert_id": { "type": "string", "description": "目标专家ID，如 'env-monitoring', 'enforcement'" },
      "task_description": { "type": "string", "description": "分派给专家的任务描述" },
      "context": { "type": "object", "description": "传递给子Agent的上下文数据" },
      "priority": { "type": "string", "enum": ["normal", "high", "emergency"], "default": "normal" }
    },
    "required": ["expert_id", "task_description"]
  },
  "safety_level": "L2",
  "color": "green",
  "expert_ids": ["ecomind", "emergency"]
}
```

**映射自 Claude Code：** `Task`（子Agent生成）
**后端实现：** `POST /api/tools/expert/dispatch` → 创建子Agent会话

---

### 工具 11：knowledge_query — 知识库查询

```json
{
  "name": "knowledge_query",
  "description": "查询知识库：法规标准库、案例库、物种库、排放因子库、污染物清单库。支持语义搜索。",
  "parameters": {
    "type": "object",
    "properties": {
      "database": { "type": "string", "enum": ["regulations", "cases", "species", "emission_factors", "pollutants", "all"] },
      "query": { "type": "string", "description": "自然语言查询" },
      "filters": { "type": "object", "description": "过滤条件" },
      "max_results": { "type": "integer", "default": 5 }
    },
    "required": ["query"]
  },
  "safety_level": "L1",
  "color": "cyan",
  "expert_ids": ["ecomind", "all"]
}
```

**映射自 Claude Code：** `Grep` + `Read`
**后端实现：** `POST /api/tools/knowledge/query` → 已有 knowledgeService 可对接

---

### 工具 12：skill_execute — 技能执行

```json
{
  "name": "skill_execute",
  "description": "执行已注册的技能模块（如遥感解译、扩散模拟、碳排放核算等）。每个技能是一个独立的可执行单元。",
  "parameters": {
    "type": "object",
    "properties": {
      "skill_id": { "type": "string", "description": "技能ID，如 'remote-sensing', 'pollution-sim'" },
      "params": { "type": "object", "description": "技能所需参数" },
      "async": { "type": "boolean", "default": false, "description": "是否异步执行（长时间任务）" }
    },
    "required": ["skill_id"]
  },
  "safety_level": "L2",
  "color": "green",
  "expert_ids": ["all"]
}
```

**映射自 Claude Code：** `Bash`（执行技能脚本）
**后端实现：** `POST /api/tools/skill/execute` → Skill Runner

---

## 三、12 Expert × 12 Tool 权限矩阵

| Expert ↓ / Tool → | env_query | reg_search | report_gen | case_search | map_viz | alert_check | doc_parse | compliance | data_analyze | dispatch | knowledge | skill_exec |
|-------------------|:---------:|:----------:|:----------:|:-----------:|:-------:|:-----------:|:---------:|:----------:|:------------:|:--------:|:---------:|:----------:|
| **ecomind**       | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | ✅ |
| **env-monitoring**| ✅ | — | ✅ | — | ✅ | ✅ | — | — | ✅ | — | — | ✅ |
| **enforcement**   | — | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ | ✅ |
| **eia**           | — | ✅ | ✅ | — | — | — | ✅ | ✅ | — | — | ✅ | ✅ |
| **permit**        | — | ✅ | — | — | — | — | ✅ | ✅ | — | — | ✅ | ✅ |
| **biodiversity**  | ✅ | — | — | — | ✅ | — | — | — | — | — | ✅ | ✅ |
| **carbon**        | — | — | ✅ | — | — | — | — | — | ✅ | — | ✅ | ✅ |
| **emergency**     | ✅ | — | ✅ | — | ✅ | ✅ | — | — | — | ✅ | ✅ | ✅ |
| **restoration**   | — | — | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | ✅ |
| **inspection**    | — | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | ✅ | ✅ |
| **public**        | ✅ | ✅ | — | — | — | — | — | — | — | — | ✅ | — |
| **water**         | ✅ | — | — | — | ✅ | — | — | — | ✅ | — | ✅ | ✅ |

---

## 四、Agentic Loop 详细设计

### 4.1 核心循环伪代码

```python
async def agentic_loop(user_input: str, expert_id: str, history: list) -> str:
    """
    Think → Plan → Act → Observe 循环
    最多迭代 N 轮（默认 10），防止无限循环
    """
    context = {
        "user_input": user_input,
        "expert_id": expert_id,
        "history": history,
        "tool_results": [],
        "iteration": 0,
        "max_iterations": 10,
    }

    while context["iteration"] < context["max_iterations"]:
        context["iteration"] += 1

        # ① THINK: LLM 分析当前状态，决定下一步
        thought = await llm_think(context)

        # ② 如果 LLM 认为任务完成，生成最终回复
        if thought["action"] == "respond":
            return thought["content"]

        # ③ ACT: 执行 LLM 选择的工具
        tool_name = thought["tool_name"]
        tool_params = thought["tool_params"]

        # ④ GUARDRAIL: 权限校验
        if not guardrail_check(expert_id, tool_name, tool_params):
            context["tool_results"].append({
                "tool": tool_name,
                "error": "权限不足或L3级别需人工确认"
            })
            continue

        # ⑤ EXECUTE: 调用工具
        result = await tool_executor.execute(tool_name, tool_params)

        # ⑥ OBSERVE: 记录结果，进入下一轮
        context["tool_results"].append({
            "tool": tool_name,
            "params": tool_params,
            "result": result,
        })

    # 超时回退：生成基于已有结果的最佳回复
    return await llm_fallback_respond(context)
```

### 4.2 LLM Think 的输出格式

```json
{
  "action": "call_tool | respond",
  "reasoning": "为什么选择这个动作（内部思考，不展示给用户）",
  "tool_name": "env_query",
  "tool_params": {
    "city": "长沙市",
    "data_type": "aqi"
  },
  "content": "（如果 action=respond）最终回复文本"
}
```

### 4.3 工具结果注入格式

```json
{
  "tool": "env_query",
  "status": "success | error",
  "data": { ... },
  "summary": "长沙市当前AQI为85，等级良，PM2.5 45μg/m³..."
}
```

---

## 五、Guardrails 边界硬约束

### 5.1 三级权限拦截

```python
GUARDRAIL_RULES = {
    "L1": {
        "description": "公开数据只读",
        "allowed_tools": ["env_query", "regulation_search", "case_search",
                          "map_visualize", "alert_check", "data_analyze",
                          "knowledge_query"],
        "blocked_tools": ["report_generate", "document_parse",
                          "compliance_check", "dispatch_expert", "skill_execute"],
        "rate_limit": "100 req/min",
        "require_audit_log": False,
    },
    "L2": {
        "description": "业务数据可读写，敏感操作需记录",
        "allowed_tools": ["*"],  # 全部工具
        "blocked_tools": [],
        "rate_limit": "30 req/min",
        "require_audit_log": True,
        "require_human_confirm_for": ["dispatch_expert"],  # 专家调度需确认
    },
    "L3": {
        "description": "执法督察，AI辅助，关键操作必须人工确认",
        "allowed_tools": ["*"],
        "blocked_tools": [],
        "rate_limit": "10 req/min",
        "require_audit_log": True,
        "require_human_confirm_for": [
            "report_generate",       # 生成执法文书 → 必确认
            "compliance_check",      # 合规结论 → 必确认
            "dispatch_expert",       # 调度其他专家 → 必确认
            "document_parse",        # 解析敏感文档 → 必确认
        ],
    },
}
```

### 5.2 Human-in-the-Loop 确认流程

```
Agent 请求执行 L3 操作
  → 前端弹出确认对话框
  → 展示：将要执行的操作 + 参数 + 可能影响
  → 用户点击 [确认执行] / [拒绝]
  → 确认后执行 / 拒绝后 Agent 收到 "操作被用户拒绝"
```

### 5.3 审计日志格式

```json
{
  "timestamp": "2026-05-28T14:30:00+08:00",
  "user_id": "user-1",
  "expert_id": "enforcement",
  "safety_level": "L3",
  "tool_name": "report_generate",
  "tool_params": { "template": "enforcement_decision", ... },
  "guardrail_passed": true,
  "human_confirmed": true,
  "result_summary": "生成处罚决定书草稿，文件ID: doc-xxxxx",
  "duration_ms": 2340
}
```

---

## 六、Skill Registry（技能注册中心）

### 6.1 技能生命周期

```
注册 ──▶ 审核 ──▶ 发布 ──▶ 执行 ──▶ 监控 ──▶ 迭代/下架
```

### 6.2 技能定义标准（扩展当前 8 项为可执行）

```typescript
interface ExecutableSkill {
  id: string;                    // 'pollution-sim'
  name: string;                  // '污染扩散模拟'
  description: string;           // 功能描述
  version: string;               // 'v1.2.0'
  category: 'analysis' | 'generation' | 'compliance' | 'visualization' | 'recognition';

  // 执行定义
  handler: string;               // 后端 handler 路径 'skills.pollution_sim.run'
  input_schema: JSONSchema;      // 输入参数 JSON Schema
  output_schema: JSONSchema;     // 输出格式 JSON Schema
  timeout_ms: number;            // 超时时间
  is_async: boolean;             // 是否支持异步

  // 权限
  safety_level: 'L1' | 'L2' | 'L3';
  require_human_confirm: boolean;
  allowed_expert_ids: string[];

  // 市场
  author: string;
  downloads: number;
  rating: number;
  tags: string[];

  // 示例
  examples: Array<{
    input: Record<string, any>;
    expected_output: string;
  }>;
}
```

### 6.3 从 8 个静态标签 → 8 个可执行技能

| 当前（静态标签） | 设计目标（可执行） | 后端实现方案 |
|-----------------|-------------------|-------------|
| `map-3d` 3D地图分析 | → `POST /api/skills/map-3d/run` | Cesium 配置 JSON 生成器 |
| `remote-sensing` 遥感解译 | → `POST /api/skills/remote-sensing/run` | Sentinel API 代理 + NDVI 计算 |
| `pollution-sim` 扩散模拟 | → `POST /api/skills/pollution-sim/run` | Gaussian Plume Model (Python) |
| `compliance-check` 合规校验 | → `POST /api/skills/compliance-check/run` | 规则引擎（法规→条件匹配） |
| `report-gen` 报告生成 | → `POST /api/skills/report-gen/run` | Jinja2 模板引擎 + DOCX |
| `ocr` OCR识别 | → `POST /api/skills/ocr/run` | Tesseract/PaddleOCR |
| `data-viz` 数据可视化 | → `POST /api/skills/data-viz/run` | ECharts option JSON 生成 |
| `spatial-analysis` 时空分析 | → `POST /api/skills/spatial-analysis/run` | Turf.js / GeoPandas |

---

## 七、子Agent调度系统（Task 模式）

### 7.1 设计

当主控 Agent (ecomind) 遇到需要多专家协作的复杂任务时，使用 `dispatch_expert` 工具生成子 Agent：

```
用户: 冷水江市AQI超标，帮我分析原因并出执法建议

ecomind (主控):
  ├─ [dispatch] → env-monitoring (子Agent #1)
  │    └─ [env_query] 获取冷水江实时数据
  │    └─ [data_analyze] 24h趋势分析
  │    └─ 返回：分析报告
  │
  ├─ [dispatch] → enforcement (子Agent #2)
  │    └─ [regulation_search] 检索超标处罚条款
  │    └─ [case_search] 查找类似案例
  │    └─ 返回：执法建议
  │
  └─ ecomind 整合 #1 + #2 → 综合报告
```

### 7.2 子Agent实现

```python
class SubAgent:
    def __init__(self, expert_id: str, task: str, parent_session_id: str):
        self.expert_id = expert_id
        self.task = task
        self.parent_session_id = parent_session_id
        self.tools = get_allowed_tools(expert_id)  # 子Agent有独立的工具权限
        self.context = {}
        self.max_iterations = 5  # 子Agent循环次数限制更小

    async def run(self) -> dict:
        """运行子Agent的完整Agentic Loop"""
        # 独立的 Think → Plan → Act → Observe 循环
        ...
        return {"status": "completed", "result": "...", "tools_used": [...]}
```

---

## 八、前端对话中的工具调用 UI

### 8.1 工具调用可视化

Agent 执行工具时，在聊天气泡中显示中间状态：

```
┌─────────────────────────────────────────┐
│ 🔍 正在查询长沙市实时AQI数据...          │  ← 工具调用中
│ ████████████░░░░░░ 75%                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✅ 已获取长沙市AQI数据 (85, 良)          │  ← 工具调用完成
│ 📊 正在生成趋势分析...                   │  ← 下一个工具
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ [最终回复]                               │  ← Agent 整合回复
│ 长沙市当前AQI为85，等级良...             │
└─────────────────────────────────────────┘
```

### 8.2 前端 Message 类型扩展

```typescript
interface ToolCallMessage {
  id: string;
  type: 'tool_call';
  toolName: string;
  toolLabel: string;          // 中文显示名
  status: 'pending' | 'running' | 'success' | 'error';
  params?: Record<string, any>;
  result?: ToolResult;
  timestamp: string;
}

interface ToolResult {
  summary: string;            // 一句话摘要
  data?: any;
  error?: string;
  duration_ms: number;
}
```

---

## 九、与现有系统的对接路径

| 现有组件 | 对接方式 |
|---------|---------|
| `deepseek.ts` chatStream | 改造为支持 tool_call 的流式解析 |
| `expertStore.ts` | 已有的 capabilities/expertIds 字段直接映射到 Tool Registry |
| `Chat/index.tsx` | MessageBubble 增加 ToolCallMessage 渲染 |
| `backend/api/routers/` | 新增 `tools.py` 路由，注册 12 个 handler |
| `backend/api/environment.py` | env_query 工具直接封装已有端点 |
| `knowledgeService.ts` | knowledge_query 工具对接已有资料库 |
| `modelConfig.ts` | 工具执行不依赖模型选择（后端执行） |

---

## 十、实现路线图

### Phase 2a：工具调用框架（最小可行）

1. 创建 `backend/api/routers/tools.py` — Tool Executor 路由
2. 实现 3 个核心工具：`env_query` + `regulation_search` + `report_generate`
3. 改造 `deepseek.ts` chatStream 支持 tool_call 解析
4. 前端增加 ToolCallMessage 组件
5. Guardrails：L1/L2 基础权限校验

### Phase 2b：完整工具集 + 子Agent

6. 实现剩余 9 个工具
7. 实现 `dispatch_expert` 子Agent调度
8. Skill Registry + 8 个技能后端 handler
9. Human-in-the-Loop 确认 UI

### Phase 2c：Skill Marketplace + 自主Agent

10. Skill 搜索/下载/安装
11. Agentic Loop 完整实现
12. 审计日志 + 监控面板
13. Agent 自主选择方案能力
