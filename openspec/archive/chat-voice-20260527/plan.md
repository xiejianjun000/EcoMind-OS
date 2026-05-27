# 语音 — 执行计划

### Step 1: VoiceInputButton
- 1.1 SpeechRecognition API 封装
- 1.2 按住录音 / 松开停止
- 1.3 识别结果回调

### Step 2: TTS 朗读
- 2.1 SpeechSynthesis API 封装
- 2.2 消息朗读按钮（已有 Volume2 占位）
- 2.3 中断/恢复

### Step 3: 集成
- 3.1 Chat 输入框旁添加 VoiceInputButton
- 3.2 MessageBubble 朗读按钮接入 TTS
