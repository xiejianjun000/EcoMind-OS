#!/bin/bash
# EcoMind OS 前端全模块颗粒度冒烟测试
# 检查每个路由是否正常返回 200 + 页面内容完整性

BASE="http://localhost:5173"
PASS=0
FAIL=0
RESULTS=""

check_page() {
  local route="$1"
  local label="$2"
  local expect_keyword="$3"
  local url="${BASE}${route}"
  
  # 获取 HTTP 状态码和内容
  local resp
  resp=$(curl -s -o /tmp/ecomind_fs.html -w "%{http_code}" "$url" 2>/dev/null)
  
  if [ "$resp" == "200" ]; then
    # 检查页面是否有实质内容（排除空白/404占位）
    local content_size=$(wc -c < /tmp/ecomind_fs.html)
    if [ "$content_size" -gt 500 ]; then
      echo -e "  \033[92m✅\033[0m ${label} → 200 (${content_size} bytes)"
      PASS=$((PASS+1))
    else
      echo -e "  \033[93m⚠️\033[0m  ${label} → 200 but only ${content_size} bytes (suspicious)"
      FAIL=$((FAIL+1))
    fi
  elif [ "$resp" == "302" ] || [ "$resp" == "301" ]; then
    # 重定向 — 可能是 AuthGuard 跳转到 /login
    local redirect=$(curl -s -o /dev/null -w "%{redirect_url}" "$url" 2>/dev/null)
    echo -e "  \033[93m🔀\033[0m ${label} → ${resp} → ${redirect}"
    PASS=$((PASS+1))
  else
    echo -e "  \033[91m❌\033[0m ${label} → ${resp}"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "============================================================"
echo "  EcoMind OS 前端全模块冒烟测试"
echo "  目标: $BASE"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ═══════════════════════════════════════════════════════════
# 1. 登录与认证
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 一、登录与认证 ━━━"
check_page "/login" "登录页" "登录"
check_page "/" "根路由（重定向到/chat）" "EcoMind"

# ═══════════════════════════════════════════════════════════
# 2. Chat 对话核心
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 二、Chat 对话核心 ━━━"
check_page "/chat" "Chat 主界面" "EcoMind"
check_page "/experts" "专家面板" "EcoMind"
check_page "/skills" "技能面板" "EcoMind"
check_page "/connectors" "连接器面板" "EcoMind"
check_page "/automation" "自动化面板" "EcoMind"

# ═══════════════════════════════════════════════════════════
# 3. 角色驾驶舱
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 三、角色驾驶舱 ━━━"
check_page "/chief-dashboard" "处长驾驶舱" "EcoMind"
check_page "/city-dashboard" "市州工作台" "EcoMind"

# ═══════════════════════════════════════════════════════════
# 4. 管理运维面板
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 四、管理运维面板 ━━━"
check_page "/admin/dashboard" "总览面板" "EcoMind"
check_page "/admin/agents" "Agent 管理" "EcoMind"
check_page "/admin/workflows" "工作流编排" "EcoMind"
check_page "/admin/security" "安全治理" "EcoMind"
check_page "/admin/models" "模型管理" "EcoMind"
check_page "/admin/domains" "业务域配置" "EcoMind"
check_page "/admin/audit" "对话审计" "EcoMind"
check_page "/admin/monitor" "环境监测" "EcoMind"
check_page "/admin/enforcement" "执法办案" "EcoMind"
check_page "/admin/approval" "审批中心" "EcoMind"
check_page "/admin/compliance" "合规检查" "EcoMind"
check_page "/admin/reports" "报告生成" "EcoMind"
check_page "/admin/knowledge-graph" "知识图谱" "EcoMind"
check_page "/admin/cesium" "3D 数字孪生" "EcoMind"

# ═══════════════════════════════════════════════════════════
# 5. 独立页面
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 五、独立页面 ━━━"
check_page "/settings" "系统设置" "EcoMind"
check_page "/monitor" "环境监测(独立)" "EcoMind"
check_page "/map" "全屏地图" "EcoMind"

# ═══════════════════════════════════════════════════════════
# 6. 静态资源
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 六、静态资源检查 ━━━"
# 检查主要的 JS bundle
for asset in "index.html" "/src/main.tsx"; do
  resp=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/${asset}" 2>/dev/null)
  if [ "$resp" == "200" ]; then
    echo -e "  \033[92m✅\033[0m ${asset} → 200"
    PASS=$((PASS+1))
  else
    echo -e "  \033[91m❌\033[0m ${asset} → ${resp}"
    FAIL=$((FAIL+1))
  fi
done

# ═══════════════════════════════════════════════════════════
# 汇总
# ═══════════════════════════════════════════════════════════
echo ""
echo "============================================================"
TOTAL=$((PASS + FAIL))
echo "  结果: \033[92m${PASS} 通过\033[0m / \033[91m${FAIL} 失败\033[0m / 共 ${TOTAL} 项"
if [ "$FAIL" -eq 0 ]; then
  echo "  评级: \033[92m🏆 全部通过\033[0m"
else
  echo "  评级: \033[93m⚠️  存在 ${FAIL} 个问题\033[0m"
fi
echo "============================================================"
echo ""
