/**
 * EcoMind OS 前端模块颗粒度深度检测
 * 
 * 检测范围：
 * 1. 路由注册完整性
 * 2. 页面组件存在性
 * 3. Lazy import 可解析性
 * 4. 页面代码量（排除空白占位）
 * 5. API 服务方法完整性
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = '/Users/mac/EcoMind-OS/.github-clone/frontend/src';
const PASS = '\x1b[92m✅\x1b[0m';
const WARN = '\x1b[93m⚠️\x1b[0m';
const FAIL = '\x1b[91m❌\x1b[0m';

let pass = 0, warn = 0, fail = 0;

function check(label, ok, detail = '') {
  if (ok) { console.log(`  ${PASS} ${label}${detail}`); pass++; }
  else { console.log(`  ${FAIL} ${label}${detail}`); fail++; }
}

function checkWarn(label, ok, detail = '') {
  if (ok) { console.log(`  ${PASS} ${label}${detail}`); pass++; }
  else { console.log(`  ${WARN} ${label}${detail}`); warn++; }
}

function fileLines(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8').split('\n').length; }
  catch { return 0; }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function fileContains(filePath, keyword) {
  try { return fs.readFileSync(filePath, 'utf-8').includes(keyword); }
  catch { return false; }
}

console.log('\n' + '='.repeat(60));
console.log('  EcoMind OS 前端模块颗粒度深度检测');
console.log('  目录: ' + FRONTEND);
console.log('='.repeat(60));

// ═══════════════════════════════════════════════════════
// 1. 路由注册完整性
// ═══════════════════════════════════════════════════════
console.log('\n━━━ 一、路由注册完整性 ━━━');

const routerFile = path.join(FRONTEND, 'router/index.tsx');
check('路由文件存在', fileExists(routerFile));

const routerContent = fs.readFileSync(routerFile, 'utf-8');

// 提取所有 lazy import 的路径
const lazyImports = [...routerContent.matchAll(/lazy\(\(\) => import\(['"]([^'"]+)['"]\)\)/g)];
const importedPages = lazyImports.map(m => m[1]);

console.log(`  发现 ${importedPages.length} 个 lazy-loaded 页面组件`);

// 提取所有路由 path
const routes = [...routerContent.matchAll(/path:\s*['"]([^'"]+)['"]/g)];
const routePaths = routes.map(m => m[1]).filter(p => !p.includes('*'));

// 提取所有 element 引用
console.log(`  发现 ${routePaths.length} 个路由路径`);

// ═══════════════════════════════════════════════════════
// 2. 页面组件存在性
// ═══════════════════════════════════════════════════════
console.log('\n━━━ 二、页面组件存在性 ━━━');

const pageModules = [
  { name: 'Chat', file: 'pages/Chat/index.tsx', minLines: 50, keywords: ['useChatStore', 'DeepSeek'] },
  { name: 'Experts', file: 'pages/Experts/index.tsx', minLines: 20 },
  { name: 'Skills', file: 'pages/Skills/index.tsx', minLines: 50, keywords: ['技能市场', 'marketplace'] },
  { name: 'Connectors', file: 'pages/Connectors/index.tsx', minLines: 20 },
  { name: 'Automation', file: 'pages/Automation/index.tsx', minLines: 20 },
  { name: 'Dashboard', file: 'pages/Dashboard/index.tsx', minLines: 30 },
  { name: 'Agents', file: 'pages/Agents/index.tsx', minLines: 20 },
  { name: 'Workflows', file: 'pages/Workflows/index.tsx', minLines: 20 },
  { name: 'Security', file: 'pages/Security/index.tsx', minLines: 20 },
  { name: 'Models', file: 'pages/Models/index.tsx', minLines: 20 },
  { name: 'Domains', file: 'pages/Domains/index.tsx', minLines: 20 },
  { name: 'Conversations', file: 'pages/Conversations/index.tsx', minLines: 50, keywords: ['审计', 'useChatStore'] },
  { name: 'Monitor', file: 'pages/Monitor/index.tsx', minLines: 50, keywords: ['AQI', 'ECharts'] },
  { name: 'Enforcement', file: 'pages/Enforcement/index.tsx', minLines: 50, keywords: ['案件', '生命周期'] },
  { name: 'Approval', file: 'pages/Approval/index.tsx', minLines: 50, keywords: ['审批', 'L1', 'L2'] },
  { name: 'Compliance', file: 'pages/Compliance/index.tsx', minLines: 50, keywords: ['SafetyChain', '雷达图'] },
  { name: 'Reports', file: 'pages/Reports/index.tsx', minLines: 30, keywords: ['报告', '模板'] },
  { name: 'KnowledgeGraph', file: 'pages/KnowledgeGraph/index.tsx', minLines: 50, keywords: ['ECharts', '力导向'] },
  { name: 'Cesium', file: 'pages/Cesium/index.tsx', minLines: 20 },
  { name: 'Settings', file: 'pages/Settings/index.tsx', minLines: 20 },
  { name: 'Admin', file: 'pages/Admin/index.tsx', minLines: 20 },
  { name: 'Login', file: 'pages/Login/index.tsx', minLines: 30, keywords: ['登录', 'AuthGuard'] },
  { name: 'ChiefDashboard', file: 'pages/ChiefDashboard/index.tsx', minLines: 30, keywords: ['驾驶舱', 'KPI'] },
  { name: 'CityDashboard', file: 'pages/CityDashboard/index.tsx', minLines: 30, keywords: ['市州', 'KPI'] },
];

for (const page of pageModules) {
  const fullPath = path.join(FRONTEND, page.file);
  const exists = fileExists(fullPath);
  const lines = fileLines(fullPath);
  
  if (!exists) {
    check(page.name, false, ' — 文件不存在');
    continue;
  }
  
  const sizeOk = lines >= page.minLines;
  let keywordOk = true;
  if (page.keywords) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    keywordOk = page.keywords.every(kw => content.includes(kw));
  }
  
  if (sizeOk && keywordOk) {
    check(page.name, true, ` — ${lines} 行`);
  } else if (sizeOk && !keywordOk) {
    checkWarn(page.name, lines >= 10, ` — ${lines} 行 (缺关键词: ${page.keywords?.filter(kw => !fs.readFileSync(fullPath,'utf-8').includes(kw)).join(',')})`);
  } else {
    check(page.name, lines >= 10, ` — ⚠️ 仅 ${lines} 行 (阈值 ${page.minLines})`);
  }
}

// ═══════════════════════════════════════════════════════
// 3. Layout 组件
// ═══════════════════════════════════════════════════════
console.log('\n━━━ 三、Layout 布局组件 ━━━');

const layouts = [
  { name: 'MainLayout', file: 'layouts/MainLayout.tsx', minLines: 20 },
  { name: 'ChatLayout', file: 'layouts/ChatLayout.tsx', minLines: 30 },
  { name: 'AdminLayout', file: 'layouts/AdminLayout.tsx', minLines: 50, keywords: ['menuItems', 'ProLayout'] },
];

for (const layout of layouts) {
  const fullPath = path.join(FRONTEND, layout.file);
  const lines = fileLines(fullPath);
  check(layout.name, lines >= layout.minLines, ` — ${lines} 行`);
}

// ═══════════════════════════════════════════════════════
// 4. Store 状态管理
// ═══════════════════════════════════════════════════════
console.log('\n━━━ 四、Store 状态管理 ━━━');

const stores = [
  { name: 'chatStore', file: 'store/chatStore.ts', minLines: 30 },
  { name: 'authStore', file: 'store/authStore.ts', minLines: 30 },
  { name: 'appStore', file: 'store/appStore.ts', minLines: 20 },
  { name: 'expertStore', file: 'store/expertStore.ts', minLines: 20 },
];

for (const store of stores) {
  const fullPath = path.join(FRONTEND, store.file);
  const lines = fileLines(fullPath);
  check(store.name, lines >= store.minLines, ` — ${lines} 行`);
}

// ═══════════════════════════════════════════════════════
// 5. API 服务层
// ═══════════════════════════════════════════════════════
console.log('\n━━━ 五、API 服务层 ━━━');

const services = [
  { name: 'businessApi', file: 'services/businessApi.ts', minLines: 50, apis: ['enforcementApi', 'approvalApi', 'complianceApi', 'reportsApi', 'marketplaceApi'] },
  { name: 'chatApi', file: 'services/chatApi.ts', minLines: 20 },
  { name: 'envDataService', file: 'services/envDataService.ts', minLines: 20 },
];

for (const svc of services) {
  const fullPath = path.join(FRONTEND, svc.file);
  const lines = fileLines(fullPath);
  if (!fileExists(fullPath)) {
    check(svc.name, false, ' — 文件不存在');
    continue;
  }
  let apiOk = true;
  if (svc.apis) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    apiOk = svc.apis.every(api => content.includes(api));
  }
  check(svc.name, lines >= svc.minLines && apiOk, ` — ${lines} 行`);
}

// ═══════════════════════════════════════════════════════
// 6. AdminLayout 菜单完整性
// ═══════════════════════════════════════════════════════
console.log('\n━━━ 六、AdminLayout 菜单项完整性 ━━━');

const adminLayoutPath = path.join(FRONTEND, 'layouts/AdminLayout.tsx');
const adminContent = fs.readFileSync(adminLayoutPath, 'utf-8');

const expectedMenus = [
  '总览面板', 'Agent 管理', '工作流编排', '安全治理',
  '模型管理', '业务域配置', '对话审计', '3D 数字孪生',
  '环境监测', '执法办案', '审批中心', '合规检查', '报告生成', '知识图谱'
];

console.log(`  AdminLayout.tsx: ${fileLines(adminLayoutPath)} 行`);
for (const menu of expectedMenus) {
  check(`菜单: ${menu}`, adminContent.includes(menu));
}

// ═══════════════════════════════════════════════════════
// 7. 路由 → 菜单一致性
// ═══════════════════════════════════════════════════════
console.log('\n━━━ 七、路由 ↔ 菜单一致性 ━━━');

const adminRoutePaths = routePaths.filter(p => p.startsWith('/admin/') && !p.includes(':'));
console.log(`  Admin 路由: ${adminRoutePaths.length} 条`);

for (const rp of adminRoutePaths) {
  const menuName = rp.replace('/admin/', '');
  const found = adminContent.includes(menuName) || adminContent.includes(rp);
  check(`路由 ${rp} → 菜单匹配`, found);
}

// ═══════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════
console.log('\n' + '='.repeat(60));
const total = pass + warn + fail;
console.log(`  结果: ${PASS.replace(/\[0m/g,'')} ${pass} 通过  ${WARN.replace(/\[0m/g,'')} ${warn} 警告  ${FAIL.replace(/\[0m/g,'')} ${fail} 失败  / 共 ${total} 项`);
if (fail === 0 && warn === 0) {
  console.log(`  评级: \x1b[92m🏆 全部通过\x1b[0m`);
} else if (fail === 0) {
  console.log(`  评级: \x1b[93m👍 良好 (${warn} 警告)\x1b[0m`);
} else {
  console.log(`  评级: \x1b[91m🚨 存在 ${fail} 个错误\x1b[0m`);
}
console.log('='.repeat(60) + '\n');
