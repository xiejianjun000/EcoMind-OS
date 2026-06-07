# Pack B — 产品截图与录屏操作指南

**版本**：v1.0 | **制作人**：Ada | **日期**：2026-06-01
**读者假设**：操作者熟悉 EcoMind OS 产品功能，但不了解宣传片拍摄需求

---

## 通用截图规范

| 参数 | 要求 |
|------|------|
| **分辨率** | ≥ 1920×1080（推荐 2560×1440 或 4K 降采样） |
| **格式** | PNG（界面截图）/ MOV/MP4（录屏） |
| **DPI** | 至少 144 DPI（Retina 屏幕直接截图即可） |
| **浏览器** | Chrome 最新版，缩放 100%，全屏模式 |
| **系统主题** | 深色模式（Dark Mode），系统外观设为深色 |
| **浏览器扩展** | 截图前隐藏所有浏览器扩展图标 |
| **字体渲染** | 确保思源黑体/Inter 已安装并正确加载 |

### 截图后处理规范

所有截图需添加 `#00C9A7` 发光边框，步骤如下：

1. **Photoshop 方式**：
   - 选中截图图层 → 图层样式 → 外发光
   - 混合模式：滤色 / 颜色：#00C9A7 / 扩展：0% / 大小：8px / 不透明度：60%

2. **CSS 方式**（如果截图在网页中）：
   ```css
   .screenshot-frame {
     box-shadow: 0 0 8px #00C9A7, 0 0 16px rgba(0,201,167,0.3);
     border-radius: 8px;
   }
   ```

3. **Figma 方式**：
   - 选中截图 Frame → Effects → Drop Shadow
   - Color: #00C9A7 / Blur: 8 / Spread: 0 / Opacity: 60%

---

## 一、UI 截图操作指南

### B07 — EcoMind OS 主控制台截图

**展示内容**：
- 左侧 60%：3D 生态地图缩略窗口，显示湖南省地形
- 右侧 40%：Agent 状态面板，四行 Agent 运行状态
- 顶部：导航栏（"EcoMind OS" 品牌名 + Logo 缩略图）

**截图前准备**：
1. 登录 EcoMind OS 主控制台
2. 确保 3D 地图已加载湖南省地形数据（Cesium.js 加载完成）
3. 3D 地图视角：倾斜 30° 俯视湖南省全境，地图微旋转（自动旋转开启）
4. Agent 状态面板：
   - 执法 Agent：状态"运行中"（绿色指示灯 ●）
   - 监测 Agent：状态"运行中"（绿色指示灯 ●）
   - 审批 Agent：状态"运行中"（绿色指示灯 ●）
   - 公众 Agent：状态"运行中"（绿色指示灯 ●）
5. 确保界面无弹窗、无加载中状态、无空白区域
6. 浏览器全屏（F11），隐藏所有工具栏

**截图操作**：
1. 等待 3D 地图旋转至最佳角度（湖南省居中，山脉河流可见）
2. 使用系统截图工具（macOS: Cmd+Shift+4 → 空格 → 点击窗口）截取完整浏览器窗口
3. 或使用 Chrome DevTools → Ctrl+Shift+P → "Capture screenshot"（全页面截图）
4. 检查截图清晰度，确认文字可读

**后处理**：添加 #00C9A7 8px 发光边框（见通用规范）

---

### B08 — 执法 Agent 对话界面截图

**展示内容**：
- 左侧：对话区域（Agent 头像 + 对话气泡），最新一条 Agent 回复正在流式输出
- 右侧：推理链面板（Step 1→Step 2→Step 3 推理步骤 + 节点连线）

**截图前准备**：
1. 打开执法 Agent 对话界面
2. 输入一条执法查询（例："检查长沙某工厂排污许可是否过期"）
3. 等待 Agent 开始推理，观察右侧推理链面板
4. **关键时机**：当推理链显示到 Step 2-3 时截图（确保推理链部分可见）
5. 确保左侧最新回复正在进行流式输出（光标闪烁状态）
6. 推理链步骤应显示：
   - Step 1: 检查排放标准 ✓
   - Step 2: 匹配法规条款 ✓
   - Step 3: 生成执法建议 ⏳（进行中）

**截图操作**：
1. 在流式输出进行中时立即截图（需要光标闪烁状态）
2. 如果无法精确捕捉流式输出瞬间，可截图后用 Photoshop 添加闪烁光标
3. 确保推理链面板完整可见

**后处理**：添加 #00C9A7 8px 发光边框

---

### B09 — 监测 Agent 数据面板截图

**展示内容**：
- 实时数据图表（折线图/面积图，显示监测数据变化趋势）
- 监测站列表（3-5 个站点，显示站点名称、状态、最新数据值）

**截图前准备**：
1. 打开监测 Agent 数据面板
2. 添加 3-5 个监测站数据点（确保有数据在活跃更新）
3. 图表应显示最近 24 小时数据趋势线
4. 至少一个监测站显示"预警"状态（琥珀色 #F59E0B 标记）
5. 确保数据图表动画运行中（数据点在更新）

**截图操作**：
1. 等待图表数据刷新时截图（确保图表线条完整）
2. 截取完整面板界面

**后处理**：添加 #00C9A7 8px 发光边框

---

### B10 — 审批 Agent 界面截图

**展示内容**：
- 审批流程状态图（流程步骤节点，显示当前进行到哪一步）
- 待审批列表（2-3 个待审批项）

**截图前准备**：
1. 打开审批 Agent 界面
2. 添加 2-3 个待审批项目（例："XX公司排污许可续期"、"XX项目环评审批"）
3. 流程状态图显示一个审批进行中的项目（当前步骤高亮 #00C9A7）
4. 确保流程图节点和连线清晰可见

**截图操作**：
1. 截取完整审批界面
2. 确保流程图和列表都可见

**后处理**：添加 #00C9A7 8px 发光边框

---

### B11 — 公众 Agent 界面截图

**展示内容**：
- 公众查询界面（搜索框 + 查询结果）
- 交互式界面元素

**截图前准备**：
1. 打开公众 Agent 界面
2. 输入一条公众查询（例："查询我家附近的空气质量"）
3. 等待返回查询结果
4. 确保结果页面显示完整的空气质量数据

**截图操作**：
1. 截取显示查询结果的完整界面
2. 确保搜索框和结果区域都可见

**后处理**：添加 #00C9A7 8px 发光边框

---

### B12 — EcoAgentEngine 代码编辑器截图

**展示内容**：
- 代码编辑器界面，507 行代码全部可见（或至少显示 400+ 行）
- 行号清晰可见
- 代码语法高亮

**截图前准备**：
1. 在 VS Code 或 EcoMind OS 内置编辑器中打开 EcoAgentEngine 核心代码文件
2. 确保代码文件完整显示（如需要可缩放字体至 12-14px 使更多行可见）
3. 启用 Python 语法高亮
4. 主题设置为深色主题（VS Code Dark+ 或 One Dark Pro）
5. 隐藏侧边栏、面板（终端、输出等），只保留编辑器
6. 确保文件底部行号显示 ≥ 507

**截图操作**：
1. 如果 507 行无法一次全显示，可滚动截图拼接
2. 或使用 VS Code 截图插件（"Polacode" 或 "CodeSnap"）生成精美代码截图
3. 确保行号 "507" 清晰可见——这是全片关键数字

**后处理**：添加 #00C9A7 8px 发光边框

---

### B15 — 压力测试报告截图

**展示内容**：
- 120 轮压力测试的完整报告
- 关键指标：成功率、平均响应时间、P50 延迟等

**截图前准备**：
1. 打开压力测试报告页面
2. 确保报告数据完整（120 轮测试结果已加载）
3. 高亮显示关键指标：
   - 总轮次：120
   - 成功率：100%（5 并发）
   - P50 延迟：11ms
4. 如有图表（趋势线、分布图），确保图表完整显示

**截图操作**：
1. 截取完整报告页面
2. 如需滚动，分段截图后拼接

**后处理**：添加 #00C9A7 8px 发光边框

---

### B16 — 对话真实性测试报告截图

**展示内容**：
- 20/20 PASS 测试结果
- 每条测试的通过/失败状态

**截图前准备**：
1. 打开对话真实性测试报告页面
2. 确保所有 20 条测试结果显示为 PASS（绿色 #00C9A7 标记）
3. 顶部显示汇总：20/20 PASS
4. 如有详情展开，保持折叠状态（仅显示汇总列表）

**截图操作**：
1. 截取完整测试报告
2. 确保数字"20/20"和"PASS"清晰可见

**后处理**：添加 #00C9A7 8px 发光边框

---

## 二、Cesium.js 录屏操作指南

### 通用录屏设置

| 参数 | 要求 |
|------|------|
| **分辨率** | 1920×1080 |
| **帧率** | 30fps（推荐 60fps 后期降速） |
| **格式** | MOV（ProRes）或 MP4（H.264 CRF 18） |
| **录屏工具** | OBS Studio / macOS 屏幕录制 / Chrome DevTools 录制 |
| **浏览器** | Chrome 最新版，硬件加速开启 |
| **GPU** | 确保独立显卡运行 Cesium.js（检查 chrome://gpu） |

### B01 — 湖南省 3D 地形俯冲录屏

**目标**：从卫星视角（海拔 ~500km）急速俯冲至湖南省上空（海拔 ~50km）

**Cesium.js 场景配置**：

```javascript
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrainProvider: Cesium.createWorldTerrain(),
  animation: false,
  timeline: false,
  infoBox: false,
  selectionIndicator: false,
  baseLayerPicker: false,
  geocoder: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  homeButton: false,
  fullscreenButton: false,
});

// 设置初始视角——卫星高度俯瞰中国南方
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(111.5, 30.0, 500000), // 湖南上空 500km
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-60), // 俯视角度
    roll: 0,
  },
});

// 俯冲动画——5秒内从500km降至50km
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(111.5, 27.5, 50000), // 湖南省上空 50km
  orientation: {
    heading: Cesium.Math.toRadians(10),
    pitch: Cesium.Math.toRadians(-45),
    roll: 0,
  },
  duration: 5, // 5秒
  easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
});
```

**监测站光点叠加**（与录屏同步）：

```javascript
// 添加3-4个监测站光点
const stations = [
  { name: '长沙站', lon: 112.97, lat: 28.23 },
  { name: '株洲站', lon: 113.13, lat: 27.83 },
  { name: '湘潭站', lon: 112.94, lat: 27.83 },
  { name: '衡阳站', lon: 112.57, lat: 26.89 },
];

stations.forEach(station => {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(station.lon, station.lat, 100),
    point: {
      pixelSize: 10,
      color: Cesium.Color.fromCssColorString('#00C9A7'),
      outlineColor: Cesium.Color.fromCssColorString('#00C9A7').withAlpha(0.3),
      outlineWidth: 8,
    },
  });
});
```

**录屏操作步骤**：
1. 启动 Cesium.js 场景，等待地形数据完全加载
2. 启动 OBS Studio 录制（1920×1080, 30fps）
3. 在浏览器控制台执行 flyTo 动画代码
4. 等待动画完成 + 额外 1-2 秒（光点闪烁效果）
5. 停止录制
6. 检查录制文件：地形是否清晰、俯冲是否流畅、光点是否可见

**时长要求**：≥ 5 秒

---

### B13 — 湖南省 3D 地形下沉录屏

**目标**：从高空缓慢下沉至城市级别，镜头向下移动

**Cesium.js 场景配置**：

```javascript
// 设置初始视角——高空俯瞰湖南省
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(111.5, 27.5, 200000), // 200km 高空
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-50),
    roll: 0,
  },
});

// 下沉动画——6秒缓慢下沉
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(112.97, 28.15, 5000), // 长沙市上空 5km
  orientation: {
    heading: Cesium.Math.toRadians(15),
    pitch: Cesium.Math.toRadians(-35),
    roll: 0,
  },
  duration: 6,
  easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
});
```

**录屏操作步骤**：
1. 同 B01 步骤，替换场景配置代码
2. 确保下沉过程中地形细节逐渐清晰（建筑、道路可见）
3. 录制 ≥ 6 秒

---

### B14 — 热力图扩散录屏（⚠️ 全片最重要录屏）

**目标**：Cesium.js 3D 地图上，Deck.gl 热力图从中心向外扩散，展示生态环境监测数据的空间分布

**Cesium.js + Deck.gl 场景配置**：

```javascript
// 在 Cesium 地图上叠加 Deck.gl 热力图层
// 方案一：使用 deck.gl Cesium 集成
// 方案二：使用 deck.gl 独立渲染后合成

// 推荐方案：使用 @deck.gl/cnvas 独立渲染热力图，后合成到 Cesium

// 热力图数据——湖南省环境监测点数据
const heatmapData = [
  // 长沙区域 - 高密度
  { position: [112.97, 28.23], weight: 0.95 },
  { position: [113.03, 28.18], weight: 0.88 },
  { position: [112.90, 28.30], weight: 0.75 },
  // 株洲区域 - 中高密度
  { position: [113.13, 27.83], weight: 0.82 },
  { position: [113.20, 27.78], weight: 0.70 },
  // 湘潭区域 - 中密度
  { position: [112.94, 27.83], weight: 0.65 },
  // 衡阳区域 - 中密度
  { position: [112.57, 26.89], weight: 0.72 },
  // 岳阳区域 - 低密度
  { position: [113.13, 29.37], weight: 0.45 },
  // 常德区域 - 低密度
  { position: [111.69, 29.05], weight: 0.38 },
  // 郴州区域 - 中低密度
  { position: [113.01, 25.77], weight: 0.55 },
  // 更多点...
  { position: [111.45, 27.23], weight: 0.50 },
  { position: [110.48, 27.30], weight: 0.35 },
  { position: [109.47, 27.33], weight: 0.28 },
];

// Deck.gl HeatmapLayer 配置
const heatmapLayer = new HeatmapLayer({
  id: 'heatmap-layer',
  data: heatmapData,
  getPosition: d => d.position,
  getWeight: d => d.weight,
  radiusPixels: 60,
  intensity: 1.2,
  threshold: 0.05,
  colorRange: [
    [14, 116, 144],    // #0E7490 智慧青
    [0, 201, 167],     // #00C9A7 生态绿
    [0, 201, 167],     // #00C9A7 生态绿
    [245, 158, 11],    // #F59E0B 关注琥珀
    [239, 68, 68],     // #EF4444 警示红
  ],
});
```

**热力图扩散动画配置**：

```javascript
// 逐步添加数据点模拟扩散效果
// 初始：仅显示中心点（长沙）
// 随时间推移：逐步添加外围点，radius 逐步增大

let currentRadius = 20;
const targetRadius = 60;
const expandDuration = 8000; // 8秒扩散完成

function animateExpansion() {
  const startTime = Date.now();
  
  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / expandDuration, 1);
    
    // 使用 ease-out 曲线
    const eased = 1 - Math.pow(1 - progress, 3);
    
    currentRadius = 20 + (targetRadius - 20) * eased;
    
    // 更新热力图层
    heatmapLayer.setProps({ radiusPixels: currentRadius });
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}
```

**Cesium 视角设置**：

```javascript
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(111.8, 27.8, 150000), // 湖南省上空 150km
  orientation: {
    heading: Cesium.Math.toRadians(5),
    pitch: Cesium.Math.toRadians(-55),
    roll: 0,
  },
});
```

**录屏操作步骤**：
1. 加载 Cesium.js 湖南省地形 + Deck.gl 热力图层
2. 确认热力图颜色正确（#0E7490 → #00C9A7 → #F59E0B → #EF4444 渐变）
3. 启动 OBS Studio 录制（1920×1080, **推荐 60fps** 以获得更流畅效果）
4. 执行热力图扩散动画
5. 扩散完成后保持 2-3 秒静止展示
6. 停止录制
7. **检查要点**：
   - 热力图颜色是否与品牌色系一致
   - 扩散是否流畅（无卡顿跳帧）
   - 底部地形是否清晰可见
   - 热力图高温区域（红色 #EF4444）是否出现在正确位置

**时长要求**：≥ 8 秒（扩散 6 秒 + 静止 2 秒）

**⚠️ 此录屏是全片最重要素材**，如无法一次性完成：
- 备选方案 A：分阶段录制（先录地形，再录热力图独立帧，后期合成）
- 备选方案 B：使用 Deck.gl 官方示例录屏替代，后期调色匹配品牌色
- 备选方案 C：After Effects 中用分形噪波模拟热力图扩散

---

## 三、交付物检查清单

### 截图检查
- [ ] 分辨率 ≥ 1920×1080
- [ ] PNG 格式，无损
- [ ] 深色主题，无亮色元素
- [ ] 界面数据已填充（无空白/加载中状态）
- [ ] #00C9A7 发光边框已添加
- [ ] 无浏览器 UI 元素（地址栏、书签栏等）
- [ ] 文字清晰可读

### 录屏检查
- [ ] 分辨率 1920×1080
- [ ] 帧率 ≥ 30fps
- [ ] 无掉帧/卡顿
- [ ] Cesium 地形清晰
- [ ] 监测站光点可见（B01）
- [ ] 热力图颜色匹配品牌色系（B14）
- [ ] 动画流畅自然
- [ ] 无录制软件水印
