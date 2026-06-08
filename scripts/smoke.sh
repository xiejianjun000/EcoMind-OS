#!/usr/bin/env bash
# Smoke tests — EcoMind OS 核心通路验证
# 30 秒内跑完，跑不过 = 项目不可用
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'
pass=0; fail=0; skip=0

check() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ ${desc}${NC}"
    ((pass++)) || true
  else
    echo -e "${RED}❌ ${desc}${NC}"
    ((fail++)) || true
  fi
}

warn() {
  echo -e "${YELLOW}⚠️  ${1}${NC}"
  ((skip++)) || true
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== EcoMind OS Smoke Test ==="
echo ""

CURL="curl -sf --max-time 5"

# ── 后端测试 ──

# 1. API 文档可访问（最可靠的存活信号，不会因 LLM 调用阻塞）
check "后端 /docs 返回 200" \
  $CURL -o /dev/null http://localhost:8000/docs

# 2. 前端 dev server 响应
check "前端页面返回 200" \
  $CURL -o /dev/null http://localhost:5173

# 3. 后端端口监听
check "后端 8000 端口在监听" \
  bash -c "lsof -i :8000 2>/dev/null | grep -q LISTEN"

# ── 配置检查 ──

# 5. 后端 .env 存在
check "后端 .env 配置文件存在" \
  test -f "$PROJECT_ROOT/backend/.env"

# 6. 后端 venv 存在
check "后端虚拟环境已创建" \
  test -f "$PROJECT_ROOT/backend/venv/bin/python"

# ── Python 导入检查 ──

# 7. 关键模块可导入
check "FastAPI 主应用可导入" \
  bash -c "cd '$PROJECT_ROOT/backend' && PYTHONPATH=. venv/bin/python -c 'from api.main import app'"

echo ""
echo "结果: ${GREEN}${pass} 通过${NC}, ${RED}${fail} 失败${NC}, ${YELLOW}${skip} 跳过${NC}"
[ "$fail" -eq 0 ] || exit 1
