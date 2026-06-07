# Pack B — AI 生图 Prompt 与来源记录

**版本**：v1.0 | **制作人**：Ada | **日期**：2026-06-01

---

## 生图通用规范

所有 AI 生图必须遵循以下统一规范，确保风格一致性：

### 通用风格锚点
- **底色**：深宇宙黑 `#050A0E`，所有图片背景为深色
- **强调色**：生态绿 `#00C9A7` 用于数据高亮、状态指示、边框
- **辅助色**：智慧青 `#0E7490`、警示红 `#EF4444`、关注琥珀 `#F59E0B`
- **UI 风格**：深色主题（dark mode），类似 Vercel/Linear/Notion 暗色界面
- **字体**：界面文字使用无衬线体，中文用思源黑体风格，英文用 Inter 风格
- **边框**：关键 UI 元素需有 `#00C9A7` 8px 模糊发光边框
- **禁止**：禁止出现 emoji、禁止卡通风格、禁止亮色背景、禁止水印

### Prompt 五层结构
1. **输出物**：生成一张横向 [具体内容] 的图片
2. **风格**：深色科技 UI / 科技纪录片风
3. **构图**：16:9 横向构图，主体 [位置]，[留白方向]
4. **否定**：不要 text watermark / border watermark / logo / 页眉 / 页脚 / 装饰边框 / emoji
5. **技术**：背景 #050A0E 深宇宙黑，输出 16:9

---

## B02 — 执法人员办公场景

**用途**：S04 左列 — 展示"信息断裂"痛点
**规格**：1920×1080 / 16:9 / JPG

### 中文 Prompt

> 生成一张横向的办公场景图片。风格为深色调科技纪录片风，整体偏灰暗压抑。画面展示一位执法人员坐在灰色办公桌前，桌上堆满纸质档案文件夹，桌面杂乱。旁边一台老旧的液晶显示器显示着一个灰白色的独立政务系统界面，界面是静态表格数据，无法导出的样子。屏幕光线微弱，整个场景色调灰暗、缺乏活力。构图16:9横向，主体居中偏左，右侧留出空间。不要文字水印、边框水印、logo、页眉页脚、装饰边框、emoji。背景深灰色偏暗，输出16:9比例。

### English Prompt

> Generate a horizontal image of an office scene. Dark-toned documentary style, overall gray and oppressive atmosphere. The scene shows a law enforcement officer sitting at a gray desk piled high with paper files and folders, desk surface cluttered and messy. Beside them, an old LCD monitor displays a gray-white standalone government system interface with static table data that appears non-exportable. Screen light is dim, the entire scene is grayish, lacking vitality. 16:9 landscape composition, subject centered-left, space on the right. No text watermark, border watermark, logo, header, footer, decorative border, or emoji. Background dark gray, output 16:9 ratio.

---

## B03 — 多系统窗口截图

**用途**：S04 中列 — 展示"系统割裂"痛点
**规格**：1920×1080 / 16:9 / PNG（界面类需要清晰）

### 中文 Prompt

> 生成一张横向的多窗口电脑屏幕模拟图片。风格为深色科技 UI 界面，3-4个独立的政务系统窗口层叠排列在深黑色背景上。窗口分别是：环保局管理系统（灰蓝色标题栏）、排污监测系统（灰绿色标题栏）、审批平台（灰色标题栏）。窗口之间有红色虚线断开标记，表示数据不互通。窗口内的数据为灰色静态表格，无交互感。整体色调深暗，窗口边框有微弱的发光效果。构图16:9横向，窗口群居中。不要文字水印、边框水印、logo、页眉页脚、装饰边框、emoji。背景#050A0E深宇宙黑，输出16:9比例。

### English Prompt

> Generate a horizontal image simulating a multi-window computer screen. Dark tech UI style, 3-4 independent government system windows stacked on a deep black background. Windows are: Environmental Bureau Management System (gray-blue title bar), Emission Monitoring System (gray-green title bar), Approval Platform (gray title bar). Red dashed line disconnection marks between windows indicating data isolation. Window content shows gray static tables with no interactivity. Overall dark tone, window borders have subtle glow effects. 16:9 landscape composition, window group centered. No text watermark, border watermark, logo, header, footer, decorative border, or emoji. Background #050A0E deep space black, output 16:9 ratio.

---

## B04 — 审批看板截图

**用途**：S04 右列 — 展示"流程阻塞"痛点
**规格**：1920×1080 / 16:9 / PNG

### 中文 Prompt

> 生成一张横向的审批流程看板模拟界面图片。风格为深色科技 UI，深黑色背景。画面展示一个看板式界面，有多行审批项目排列，每个项目卡片显示项目名称和状态。大量项目标记为红色"待审核"状态标签（#EF4444色），形成排队拥堵感。看板底部显示一行大数字"14天"（红色#EF4444），下方小字"平均审批周期"。一个进度条从左向右移动但卡在30%处停止，进度条颜色变为红色并闪烁。界面整体有深色主题风格，关键数据用红色高亮。构图16:9横向，看板居中。不要文字水印、边框水印、logo、页眉页脚、装饰边框、emoji。背景#050A0E深宇宙黑，输出16:9比例。

### English Prompt

> Generate a horizontal image simulating an approval workflow kanban board interface. Dark tech UI style, deep black background. The image shows a kanban-style interface with multiple rows of approval items, each card showing project name and status. Many items marked with red "Pending Review" status tags (#EF4444), creating a sense of queue congestion. At the bottom of the kanban, a large number "14 days" in red (#EF4444), with small text "Average Approval Cycle" below. A progress bar moves from left to right but stops at 30%, the bar color turns red and flashes. Overall dark theme style, key data highlighted in red. 16:9 landscape composition, kanban centered. No text watermark, border watermark, logo, header, footer, decorative border, or emoji. Background #050A0E deep space black, output 16:9 ratio.

---

## B05 — 合规检查报告界面截图

**用途**：S05 前半段 — 展示"合规盲区"痛点
**规格**：1920×1080 / 16:9 / PNG

### 中文 Prompt

> 生成一张横向的合规检查报告界面模拟图片。风格为深色科技 UI，深黑色背景。画面展示一份政务合规文档界面，文档中有多个红色警示标记（#EF4444）散布，部分区域显示"⚠ 未检测"和"⚠ 未知来源"标记。文档右侧有一把断开的锁形图标，锁体用红色断裂线条表示，暗示合规体系不完整。界面为深色主题，文档文字为浅灰色，警示标记为醒目红色。构图16:9横向，合规文档居中偏左。不要文字水印、边框水印、logo、页眉页脚、装饰边框、emoji。背景#050A0E深宇宙黑，输出16:9比例。

### English Prompt

> Generate a horizontal image simulating a compliance check report interface. Dark tech UI style, deep black background. The image shows a government compliance document interface with multiple red warning markers (#EF4444) scattered throughout, some areas showing "⚠ Not Detected" and "⚠ Unknown Source" labels. On the right side of the document, a broken lock icon with red fracture lines, suggesting incomplete compliance system. Interface in dark theme, document text in light gray, warning markers in striking red. 16:9 landscape composition, compliance document centered-left. No text watermark, border watermark, logo, header, footer, decorative border, or emoji. Background #050A0E deep space black, output 16:9 ratio.

---

## B06 — 审批队列统计界面截图

**用途**：S05 后半段 — 展示"人工审核瓶颈"痛点
**规格**：1920×1080 / 16:9 / PNG

### 中文 Prompt

> 生成一张横向的审批队列统计界面模拟图片。风格为深色科技 UI 仪表盘，深黑色背景。画面中央偏右显示超大数字"14"（字号极大，颜色#EF4444红色），右侧紧跟"天"字（较小，白色）。数字下方小字"平均审批周期"（浅灰色）。数字左侧有一个水平进度条，从左到30%处停止，进度条前段为#00C9A7绿色但卡住处变为#EF4444红色并闪烁。界面下方有一行排队统计的小型柱状图，显示多日的审批积压趋势。整体深色仪表盘风格，数据可视化元素丰富。构图16:9横向，数字居中偏右。不要文字水印、边框水印、logo、页眉页脚、装饰边框、emoji。背景#050A0E深宇宙黑，输出16:9比例。

### English Prompt

> Generate a horizontal image simulating an approval queue statistics interface. Dark tech UI dashboard style, deep black background. Center-right of the image shows a supersized number "14" (very large font, #EF4444 red), followed by "days" in smaller white text. Below the number, small text "Average Approval Cycle" in light gray. To the left of the number, a horizontal progress bar moving from left to 30% then stopping, the bar changes from #00C9A7 green to #EF4444 red at the stuck point and flashes. Below the interface, a small bar chart showing multi-day approval backlog trends. Overall dark dashboard style, rich data visualization elements. 16:9 landscape composition, number centered-right. No text watermark, border watermark, logo, header, footer, decorative border, or emoji. Background #050A0E deep space black, output 16:9 ratio.

---

## 来源记录

### AI 生图来源

| 编号 | 生成工具 | Prompt 版本 | 生成日期 | 许可证 | 备注 |
|------|---------|-----------|---------|--------|------|
| B02 | 待执行（Midjourney/DALL-E/Stable Diffusion） | v1.0 | 待定 | 自有 | 痛点场景，非真实人物 |
| B03 | 待执行 | v1.0 | 待定 | 自有 | 模拟界面，无版权风险 |
| B04 | 待执行 | v1.0 | 待定 | 自有 | 模拟界面，无版权风险 |
| B05 | 待执行 | v1.0 | 待定 | 自有 | 模拟界面，无版权风险 |
| B06 | 待执行 | v1.0 | 待定 | 自有 | 模拟界面，无版权风险 |

### 网络搜索素材来源

> 本项目 Pack B 暂无网络搜索素材。所有图片均为 AI 生成或产品真实截图。如后续需补充素材，将在此处记录来源 URL 和许可证。

---

## 待执行 Prompt 清单

以下 Prompt 已编写完成，等待图片生成工具执行：

1. **B02** — 执法人员办公场景（见上方中文/英文 Prompt）
2. **B03** — 多系统窗口截图（见上方中文/英文 Prompt）
3. **B04** — 审批看板截图（见上方中文/英文 Prompt）
4. **B05** — 合规检查报告界面（见上方中文/英文 Prompt）
5. **B06** — 审批队列统计界面（见上方中文/英文 Prompt）

**执行建议**：
- 推荐使用 Midjourney v6 或 DALL-E 3 执行，以获得最佳画面质量
- 每个 Prompt 执行后检查：风格是否统一（深色主题）、是否有意外水印、分辨率是否≥1920px宽
- 如首次生成不满意，可微调 Prompt 中的"构图"和"色调"部分重试
- B03/B04/B05/B06 为界面类图片，如 AI 生图工具无法精确生成 UI，可改为 HTML/CSS 构建后截图
