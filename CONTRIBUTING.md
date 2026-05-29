# 五道门禁贡献指南

## 概述

本项目严格遵循**五道门禁**管理机制，确保代码质量、安全性和可维护性。

## 五道门禁流程

### 门禁 1: 代码规范检查 (Gate 1 - Lint)
- **前端**: ESLint + Prettier
- **后端**: Ruff (PEP 8 规范)
- **要求**: 0 警告，0 错误

### 门禁 2: 单元测试 (Gate 2 - Test)
- **前端**: 构建测试通过
- **后端**: pytest 测试通过
- **要求**: 所有测试用例必须通过

### 门禁 3: 类型检查 (Gate 3 - Type Check)
- **前端**: TypeScript 严格模式
- **后端**: 类型注解 (mypy)
- **要求**: 无类型错误

### 门禁 4: 安全扫描 (Gate 4 - Security)
- 依赖漏洞检查 (npm audit / pip-audit)
- 敏感信息扫描
- 安全编码规范检查

### 门禁 5: 代码质量评估 (Gate 5 - Quality)
- 代码复杂度检查
- 重复代码检测
- 代码覆盖率报告

## 开发流程

### 1. 分支策略
- `main`: 主分支，生产环境代码
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复分支

### 2. 提交流程
1. Fork 项目
2. 创建特性分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -m "feat: 描述你的更改"` (遵循 Conventional Commits)
4. 推送到远程: `git push origin feature/your-feature`
5. 创建 Pull Request

### 3. 本地验证
在提交 PR 前，请确保本地通过以下检查：

```bash
# 前端
cd frontend
pnpm lint      # 代码规范
pnpm build     # 构建测试
pnpm format    # 格式化

# 后端
cd backend
ruff check .   # Python 代码检查
```

## 代码规范

### Git 提交信息格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<optional body>

<optional footer>
```

类型:
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

### 代码审查要求

所有 PR 必须经过至少 1 人审查，满足：
- 代码质量达标
- 测试覆盖充分
- 文档更新完善
- 无安全隐患

## 项目结构

```
EcoMind-OS/
├── backend/          # FastAPI 后端
├── frontend/         # React 前端
├── docs/            # 项目文档
├── .github/         # CI/CD 配置
└── README.md        # 项目说明
```

## 联系我们

如有问题，请通过 GitHub Issues 联系。
