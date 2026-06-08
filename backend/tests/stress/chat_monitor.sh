#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Chat 对话模块 — 全链路监控测试
# 验证: SSE流式 / 7专家系统 / 消息格式 / 错误处理 / 导出
# ═══════════════════════════════════════════════════════════════

BASE="http://localhost:5173"
API_BASE="http://localhost:8000"
PASS=0; FAIL=0; WARN=0
G='\033[92m'; R='\033[91m'; Y='\033[93m'; B='\033[94m'; N='\033[0m'

ok()   { echo -e "  ${G}✅${N} $1"; PASS=$((PASS+1)); }
bad()  { echo -e "  ${R}❌${N} $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${Y}⚠️${N}  $1"; WARN=$((WARN+1)); }

echo ""
echo "============================================================"
echo "  Chat 对话模块 — 全链路监控测试"
echo "  时间: $(date '+%H:%M:%S')"
echo "============================================================"

# ═══════════════════════════════════════════════════════════
# 1. 基础连通性
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 1. 基础连通性 ━━━"

# 前端 Chat 页面
resp=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/chat")
[ "$resp" == "200" ] && ok "Chat页面 200" || bad "Chat页面 $resp"

# DeepSeek API 代理
resp=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/deepseek/v1/models" -H "Authorization: Bearer test" 2>/dev/null)
[ "$resp" == "200" ] || [ "$resp" == "401" ] && ok "DeepSeek代理可达 ($resp)" || bad "DeepSeek代理不可达 ($resp)"

# 后端健康检查
resp=$(curl -s "$API_BASE/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
[ "$resp" == "ok" ] && ok "后端健康: $resp" || bad "后端健康检查失败"

# ═══════════════════════════════════════════════════════════
# 2. 7 专家系统提示词检查
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 2. 专家系统提示词 ━━━"

EXPERTS=(
  "environment:环境监测"
  "enforcement:环境执法"
  "approval:环评审批"
  "compliance:合规检查"
  "monitoring:污染源监控"
  "emergency:环境应急"
  "policy:政策法规"
)

for expert in "${EXPERTS[@]}"; do
  key="${expert%%:*}"
  name="${expert##*:}"
  # 检查前端 expertStore 是否定义了该专家
  found=$(curl -s "$BASE/src/store/expertStore.ts" 2>/dev/null | grep -c "$key" || echo 0)
  if [ "$found" -gt 0 ]; then
    ok "专家: $name ($key) — store已定义"
  else
    warn "专家: $name ($key) — store中未找到"
  fi
done

# ═══════════════════════════════════════════════════════════
# 3. Chat Store 消息管理
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 3. Chat Store 消息管理 ━━━"

# 检查 chatStore 核心功能
STORE=$(curl -s "$BASE/src/store/chatStore.ts" 2>/dev/null)
echo "$STORE" | grep -q "sessions" && ok "sessions 状态管理" || bad "sessions 缺失"
echo "$STORE" | grep -q "messages" && ok "messages 状态管理" || bad "messages 缺失"
echo "$STORE" | grep -q "addMessage" && ok "addMessage 方法" || warn "addMessage 缺失"
echo "$STORE" | grep -q "deleteSession" && ok "deleteSession 方法" || warn "deleteSession 缺失"
echo "$STORE" | grep -q "persist" && ok "localStorage 持久化" || warn "persist 未配置"

# ═══════════════════════════════════════════════════════════
# 4. SSE 流式能力验证
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 4. SSE 流式能力 ━━━"

# 检查 chatApi 中的 SSE 实现
CHATAPI=$(curl -s "$BASE/src/services/chatApi.ts" 2>/dev/null)
echo "$CHATAPI" | grep -q "EventSource\|ReadableStream\|text/event-stream\|SSE\|stream" && \
  ok "SSE流式实现存在" || warn "未检测到SSE实现"

echo "$CHATAPI" | grep -q "fetch.*stream\|getReader\|ReadableStream" && \
  ok "ReadableStream 读取" || warn "ReadableStream 未使用"

echo "$CHATAPI" | grep -q "flushSync\|requestAnimationFrame\|batch" && \
  ok "flushSync 批量渲染" || warn "flushSync 未检测到"

# ═══════════════════════════════════════════════════════════
# 5. 导出/分享功能
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 5. 导出与分享 ━━━"

# 检查 Chat 页面是否有导出功能
CHATPAGE=$(curl -s "$BASE/src/pages/Chat/index.tsx" 2>/dev/null)
echo "$CHATPAGE" | grep -qi "export\|导出\|ExportMenu" && ok "导出功能" || warn "导出功能未检测到"
echo "$CHATPAGE" | grep -qi "share\|分享\|ShareDialog" && ok "分享功能" || warn "分享功能未检测到"
echo "$CHATPAGE" | grep -qi "markdown\|copy\|复制" && ok "Markdown/复制" || warn "复制功能未检测到"

# ═══════════════════════════════════════════════════════════
# 6. 消息搜索
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 6. 消息全文搜索 ━━━"

echo "$CHATPAGE" | grep -qi "search\|搜索\|SearchBar" && ok "搜索功能" || warn "搜索功能未检测到"
echo "$CHATPAGE" | grep -qi "Ctrl.*K\|hotkey\|快捷键" && ok "Ctrl+K 快捷键" || warn "快捷键未检测到"
echo "$CHATPAGE" | grep -qi "highlight\|高亮\|mark" && ok "关键词高亮" || warn "高亮未检测到"

# ═══════════════════════════════════════════════════════════
# 7. 语音输入/输出
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 7. 语音输入/输出 ━━━"

echo "$CHATPAGE" | grep -qi "SpeechRecognition\|webkitSpeechRecognition\|语音\|录音" && ok "语音输入" || warn "语音输入未检测到"
echo "$CHATPAGE" | grep -qi "SpeechSynthesis\|speechSynthesis\|朗读\|TTS\|Volume2" && ok "TTS朗读" || warn "TTS未检测到"

# ═══════════════════════════════════════════════════════════
# 8. 技能/工具/连接器面板
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 8. 技能/工具/连接器面板 ━━━"

for panel in "Skills:技能" "Connectors:连接器" "Experts:专家" "Automation:自动化"; do
  key="${panel%%:*}"
  name="${panel##*:}"
  route_resp=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/${key,,}" 2>/dev/null)
  [ "$route_resp" == "200" ] && ok "${name}面板路由 200" || bad "${name}面板路由 $route_resp"
done

# ═══════════════════════════════════════════════════════════
# 9. 对话审计页面
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 9. 对话审计页面 ━━━"

AUDIT=$(curl -s "$BASE/src/pages/Conversations/index.tsx" 2>/dev/null)
echo "$AUDIT" | grep -q "useChatStore" && ok "审计页: useChatStore集成" || bad "审计页: useChatStore缺失"
echo "$AUDIT" | grep -qi "search\|搜索\|filter" && ok "审计页: 搜索筛选" || warn "审计页: 搜索缺失"
echo "$AUDIT" | grep -qi "delete\|删除\|batch" && ok "审计页: 批量删除" || warn "审计页: 删除缺失"
echo "$AUDIT" | grep -qi "dialog\|modal\|Modal\|Dialog" && ok "审计页: 确认弹窗" || warn "审计页: 弹窗缺失"

# ═══════════════════════════════════════════════════════════
# 10. ModelConfig 环境变量管理
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 10. ModelConfig 配置管理 ━━━"

MODELCONFIG=$(curl -s "$BASE/src/services/chatApi.ts" 2>/dev/null)
echo "$MODELCONFIG" | grep -q "localStorage\|modelConfig\|API.*KEY\|apiKey" && \
  ok "modelConfig localStorage管理" || warn "modelConfig 未检测到"

# Check .env support
if [ -f /Users/mac/EcoMind-OS/.github-clone/frontend/.env ]; then
  grep -q "DEEPSEEK\|API_KEY" /Users/mac/EcoMind-OS/.github-clone/frontend/.env 2>/dev/null && \
    ok ".env API Key 配置" || warn ".env 无 API Key"
else
  warn ".env 文件不存在"
fi

# ═══════════════════════════════════════════════════════════
# 11. 网络检测 & 错误重试
# ═══════════════════════════════════════════════════════════
echo ""
echo "━━━ 11. 错误处理与重试 ━━━"

echo "$CHATAPI" | grep -qi "retry\|重试\|retries" && ok "错误重试机制" || warn "重试机制未检测到"
echo "$CHATAPI" | grep -qi "timeout\|超时\|AbortController" && ok "超时控制" || warn "超时控制未检测到"
echo "$CHATAPI" | grep -qi "navigator.onLine\|online\|offline\|网络" && ok "网络状态检测" || warn "网络检测未检测到"

# ═══════════════════════════════════════════════════════════
# 汇总
# ═══════════════════════════════════════════════════════════
echo ""
echo "============================================================"
TOTAL=$((PASS + FAIL + WARN))
echo "  结果: ${G}${PASS} 通过${N} / ${Y}${WARN} 警告${N} / ${R}${FAIL} 失败${N} / 共 ${TOTAL} 项"
if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  echo "  评级: ${G}🏆 Chat 模块全部达标${N}"
elif [ "$FAIL" -eq 0 ]; then
  echo "  评级: ${Y}👍 Chat 模块基本达标 (${WARN} 项待确认)${N}"
else
  echo "  评级: ${R}🚨 Chat 模块存在 ${FAIL} 项问题${N}"
fi
echo "============================================================"
echo ""
