#!/usr/bin/env bash
# EcoMind Git 自动运维脚本
# 一键同步/推送/打标签/清理分支
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

usage() {
  echo "EcoMind Git 自动运维"
  echo ""
  echo "用法:"
  echo "  bash scripts/git-auto.sh push       一键推送 (add→commit→push→tag)"
  echo "  bash scripts/git-auto.sh sync       从远程拉取最新"
  echo "  bash scripts/git-auto.sh cleanup    清理本地已合并分支"
  echo "  bash scripts/git-auto.sh release    打版本标签并推送"
  echo "  bash scripts/git-auto.sh status     查看仓库状态"
  exit 0
}

cmd_push() {
  echo -e "${GREEN}▶ 一键推送${NC}"

  # 1. 检查是否有未提交改动
  if git diff --quiet && git diff --cached --quiet; then
    echo "  ✅ 工作区干净，无需提交"
  else
    echo "  📦 暂存所有改动..."
    git add -A

    # 生成 commit message
    local msg="auto: $(date '+%Y-%m-%d %H:%M')"
    local stats=$(git diff --cached --stat | tail -1)
    if [ -n "$stats" ]; then
      msg="auto: ${stats}" | head -c 72
    fi

    echo "  ✅ 提交: $msg"
    git commit -m "$msg"
  fi

  # 2. 推送
  local branch=$(git branch --show-current)
  echo "  🚀 推送到 origin/$branch..."
  git push origin "$branch"

  # 3. 标签
  local tag="v$(date '+%Y%m%d-%H%M')"
  echo "  🏷️  标签: $tag"
  git tag "$tag"
  git push origin "$tag"

  echo -e "${GREEN}✅ 推送完成: $branch @ $tag${NC}"
}

cmd_sync() {
  echo -e "${GREEN}▶ 同步远程${NC}"
  local branch=$(git branch --show-current)

  # 暂存本地改动
  if ! git diff --quiet; then
    echo "  💾 暂存本地改动..."
    git stash push -m "auto-stash-$(date '+%s')"
  fi

  echo "  ⬇️  拉取 origin/$branch..."
  git pull --rebase origin "$branch"

  if git stash list | grep -q "auto-stash"; then
    echo "  📤 恢复本地改动..."
    git stash pop 2>/dev/null || echo "  ⚠️  stash pop 冲突，请手动处理"
  fi

  echo -e "${GREEN}✅ 同步完成${NC}"
}

cmd_cleanup() {
  echo -e "${GREEN}▶ 清理已合并分支${NC}"
  local merged=$(git branch --merged | grep -v "main\|develop\|\*" || true)
  if [ -z "$merged" ]; then
    echo "  ✅ 无已合并分支"
    return
  fi
  echo "  已合并分支:"
  echo "$merged" | sed 's/^/    /'
  read -p "  删除这些分支? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$merged" | xargs git branch -d
    echo -e "${GREEN}✅ 已删除${NC}"
  else
    echo "  跳过"
  fi
}

cmd_release() {
  echo -e "${GREEN}▶ 发布新版本${NC}"
  local version="${1:-}"
  if [ -z "$version" ]; then
    version="v$(date '+%Y%m%d-%H%M')"
    echo "  使用时间戳版本: $version"
  fi

  # 运行测试
  echo "  🧪 烟雾测试..."
  if bash "$SCRIPT_DIR/smoke.sh" > /dev/null 2>&1; then
    echo "  ✅ 烟雾测试通过"
  else
    echo -e "${RED}  ❌ 烟雾测试失败，中止发布${NC}"
    exit 1
  fi

  git tag -a "$version" -m "Release $version"
  git push origin "$version"
  echo -e "${GREEN}✅ 发布完成: $version${NC}"
}

cmd_status() {
  echo -e "${GREEN}▶ 仓库状态${NC}"
  echo ""
  echo "  分支:       $(git branch --show-current)"
  echo "  HEAD:       $(git log --oneline -1)"
  echo ""
  echo "  本地 ahead:  $(git log origin/$(git branch --show-current)..HEAD --oneline 2>/dev/null | wc -l) commits"
  echo "  远程 ahead:  $(git log HEAD..origin/$(git branch --show-current) --oneline 2>/dev/null | wc -l) commits"
  echo ""
  echo "  未提交:      $(git status --short | wc -l) files"
  echo "  标签:        $(git tag --sort=-creatordate | head -3 | tr '\n' ' ')"
  echo "  分支:        $(git branch --list | wc -l) local"
}


# ── Main ──
case "${1:-}" in
  push)     cmd_push ;;
  sync)     cmd_sync ;;
  cleanup)  cmd_cleanup ;;
  release)  cmd_release "${2:-}" ;;
  status)   cmd_status ;;
  *)        usage ;;
esac
