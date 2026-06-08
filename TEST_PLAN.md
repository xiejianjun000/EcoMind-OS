# EcoMind OS — 生产级部署测试方案

> 版本：1.0 | 标准：Claude Code Production-Grade Testing Methodology
> 最后更新：2026-05-27

---

## 一、测试策略总览

```
┌─────────────────────────────────────────────────────────┐
│                  EcoMind OS 测试金字塔                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    ╱  E2E  ╲                             │
│                   ╱  (10%)  ╲         Playwright         │
│                  ╱───────────╲                           │
│                 ╱ Integration ╲      API + Contract      │
│                ╱    (25%)     ╲                          │
│               ╱───────────────╲                          │
│              ╱   Unit Tests   ╲    Pytest + Vitest       │
│             ╱     (40%)       ╲                         │
│            ╱───────────────────╲                         │
│           ╱   Static Analysis  ╲   ESLint + mypy + TS   │
│          ╱      (25%)          ╲                        │
│         ╱───────────────────────╲                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 测试层级矩阵

| 层级 | 工具 | 目标 | 覆盖率要求 | CI 阶段 |
|------|------|------|-----------|---------|
| L0 静态分析 | ESLint / mypy / tsc | 类型安全 + 代码规范 | 100% 文件 | pre-commit |
| L1 单元测试 | Pytest + Vitest | 函数/组件隔离 | ≥ 80% | push |
| L2 集成测试 | Pytest (async) | 模块间交互 | ≥ 70% | push |
| L3 契约测试 | Schemathesis / OpenAPI | API Schema 合规 | 100% 端点 | PR |
| L4 E2E 测试 | Playwright | 用户完整流程 | 核心路径 | PR |
| L5 性能测试 | 自建引擎 + k6 | 吞吐/延迟/SLA | p95<500ms | release |
| L6 安全测试 | OWASP ZAP + 自建 | 认证/注入/国密 | 0 critical | release |
| L7 混沌工程 | 自建故障注入 | 韧性/降级/恢复 | MTTR<30s | weekly |
| L8 可访问性 | axe-core | WCAG 2.1 AA | ≥ 90 分 | PR |
| L9 兼容性 | BrowserStack | 浏览器/设备 | 主流 4 款 | release |

---

## 二、测试环境矩阵

| 环境 | 用途 | 触发条件 | 数据 |
|------|------|---------|------|
| `dev` | 本地开发 | pre-commit hook | Mock |
| `ci` | 持续集成 | git push / PR | Fixtures |
| `staging` | 预发布验证 | PR → main merge | Anonymized |
| `production` | 线上监控 | 定时 / 手动 | Synthetic |

---

## 三、SLA 指标

| 指标 | Smoke | Stress | Spike | 目标 |
|------|-------|--------|-------|------|
| 成功率 | ≥ 99.9% | ≥ 99.5% | ≥ 99% | **100%** |
| P50 延迟 | < 50ms | < 200ms | < 500ms | **< 100ms** |
| P95 延迟 | < 200ms | < 500ms | < 2000ms | **< 500ms** |
| P99 延迟 | < 500ms | < 1000ms | < 5000ms | **< 1000ms** |
| 吞吐量 | > 200/s | > 150/s | > 100/s | **> 200/s** |
| 错误预算 | 0.1% | 0.5% | 1% | **0%** |

---

## 四、测试执行流程

```
Developer Push
  │
  ├─► pre-commit: ESLint + mypy + tsc + prettier
  │
  ├─► CI (push): Unit Tests (Pytest + Vitest) ─── < 5 min
  │     │
  │     ├─ ✅ PASS → continue
  │     └─ ❌ FAIL → block merge
  │
  ├─► CI (PR): Integration + Contract + E2E ─── < 15 min
  │     │
  │     ├─ ✅ PASS → mergeable
  │     └─ ❌ FAIL → request changes
  │
  └─► Release Pipeline:
        │
        ├─► Performance Test (k6) ─── < 10 min
        ├─► Security Scan (ZAP)  ─── < 15 min
        ├─► Accessibility Check ─── < 5 min
        │
        └─► Deploy Staging → Smoke Test → Deploy Prod
```

---

## 五、测试用例清单

### 5.1 后端单元测试（目标 ≥ 40 用例）

| 模块 | 用例数 | 覆盖重点 |
|------|--------|---------|
| enforcement_service | 8 | CRUD + 状态机流转 + 非法操作 |
| approval_service | 8 | 三级审批 + 越级拒绝 + 并发冲突 |
| compliance_service | 6 | 规则匹配 + 评分引擎 + 批量检查 |
| report_service | 4 | 模板渲染 + 参数校验 + 生成状态 |
| safety_chain | 6 | 6层规则 + 评分引擎 + 边界条件 |
| knowledge_graph | 4 | 节点查询 + 邻居展开 + 搜索 |
| marketplace | 4 | 技能列表 + 分类筛选 + 热门排序 |
| auth/rbac | 4 | 角色权限 + token 验证 + 过期 |

### 5.2 前端单元测试（目标 ≥ 25 用例）

| 组件 | 用例数 | 覆盖重点 |
|------|--------|---------|
| ChatPage | 5 | 消息渲染 + 流式更新 + 专家切换 |
| LoginPage | 3 | 表单验证 + 角色选择 + 跳转 |
| Enforcement | 4 | 列表渲染 + 阶段筛选 + 详情面板 |
| Approval | 3 | 审批操作 + 状态流转 |
| Compliance | 3 | 安全检查 + 雷达图渲染 |
| Store | 4 | chatStore 消息 + authStore 角色 |
| API services | 3 | safeFetch 降级 + 错误处理 |

### 5.3 E2E 核心流程（10 条路径）

```
Path 1: 登录 → Chat → 发送消息 → 流式响应 → 导出对话
Path 2: 登录 → 执法办案 → 创建案件 → 线索→受理→立案流转
Path 3: 登录 → 审批中心 → 创建审批 → L1→L2→L3 三级审批
Path 4: 登录 → 合规检查 → 运行检查 → 查看 SafetyChain 状态
Path 5: 登录 → 环境监测 → 查看 14 市州 AQI → 城市详情
Path 6: 登录 → 知识图谱 → 搜索节点 → 查看详情 → 导出 Mermaid
Path 7: 登录 → 技能市场 → 浏览 → 安装技能
Path 8: 登录 → 对话审计 → 搜索会话 → 查看详情 → 删除
Path 9: 暗色主题 → 英文切换 → 角色切换 → 回主界面
Path 10: 离线检测 → 网络恢复 → API 降级 → Mock 回退
```

---

## 六、安全测试专项

| 类别 | 测试项 | 工具 |
|------|--------|------|
| 认证绕过 | 无 token 访问受保护路由 | 自建 |
| 权限提升 | 低权限角色访问高权限端点 | 自建 |
| Prompt 注入 | 恶意内容绕过 SafetyChain | 自建 |
| SQL 注入 | 恶意 SQL 参数 | Schemathesis |
| XSS | 反射型/存储型 | OWASP ZAP |
| 国密合规 | SM2/SM3/SM4 算法验证 | 自建 |
| 敏感数据 | 响应中无明文密钥/PII | 自建 |

---

## 七、CI/CD Pipeline（GitHub Actions）

```yaml
stages:
  - static-analysis    # 2 min  — lint + type-check
  - unit-tests         # 5 min  — pytest + vitest
  - integration-tests  # 8 min  — API integration
  - contract-tests     # 3 min  — OpenAPI validation
  - e2e-tests          # 10 min — Playwright
  - performance        # 10 min — k6 load test
  - security-scan      # 15 min — OWASP ZAP
  - deploy-staging     # manual — deploy + smoke test
```

---

## 八、混沌工程

| 实验 | 注入方式 | 观察指标 |
|------|---------|---------|
| 后端进程 Kill | SIGKILL | 重启时间 / 请求丢失 |
| 网络延迟注入 | tc netem 200ms | 超时处理 / 降级策略 |
| 数据库连接断开 | iptables DROP | 连接池恢复 / 熔断 |
| CPU 满载 | stress-ng | 请求排队 / 优雅降级 |
| 内存泄漏模拟 | 持续分配 | OOM 处理 / GC 行为 |
| WebSocket 断连 | 随机关闭 | 自动重连 / 消息补发 |

---

## 九、质量门禁

| 门禁 | 条件 | 阻断级别 |
|------|------|---------|
| 类型检查 | tsc/mypy 0 error | BLOCK |
| Lint | ESLint 0 error | BLOCK |
| 单元测试 | 全部通过 + ≥80% 覆盖 | BLOCK |
| 集成测试 | 全部通过 | BLOCK |
| 契约测试 | 100% 端点匹配 | BLOCK |
| E2E | 核心路径通过 | BLOCK |
| 性能 | p95 < 500ms | WARN |
| 安全 | 0 critical/high | BLOCK |

---

> 本文档作为 EcoMind OS 测试体系的唯一真实来源。
> 所有测试代码必须引用本方案的层级编号（L0-L9）。
