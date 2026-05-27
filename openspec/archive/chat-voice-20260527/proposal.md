# 变更提案：语音输入/输出

### 是什么
利用浏览器 Web Speech API 实现语音输入（SpeechRecognition）和语音播报（SpeechSynthesis），零额外依赖。

### 范围
- 语音输入：麦克风按钮 → 语音转文字 → 填入输入框
- 语音播报：消息朗读按钮 → TTS 朗读 AI 回复
- 浏览器兼容降级：不支持的浏览器隐藏按钮

### 影响
- Chat/index.tsx：+30 行（VoiceInputButton + TTS 逻辑）
- 新增 VoiceInputButton.tsx（约 80 行）
