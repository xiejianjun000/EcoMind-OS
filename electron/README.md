# EcoMind OS 桌面应用

Electron 封装的桌面客户端，将前端 (React/Vite) 和后端 (Python/FastAPI) 打包为独立桌面应用。

## 架构

```
┌──────────────────────────────────────────┐
│              Electron 主进程              │
│                                          │
│  ┌─────────────┐  ┌───────────────────┐  │
│  │ 后端进程管理器 │  │ ecomind:// 协议处理 │  │
│  │ (Python)     │  │ /api/*  → 8000代理 │  │
│  │ uvicorn:8000 │  │ /     → dist/静态  │  │
│  └─────────────┘  └───────────────────┘  │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │         BrowserWindow               │ │
│  │  加载 ecomind://index.html          │ │
│  │  ├── API: /api/* → localhost:8000   │ │
│  │  ├── WS:  ws://localhost:8000/ws    │ │
│  │  └── 静态: 内置 dist/               │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

## 开发

```bash
cd electron
npm install
npm run dev          # 同时启动 Vite + Python 后端 + Electron
```

## 构建桌面安装包

```bash
# 1. 构建前端
cd ../frontend && npm run build

# 2. 构建后端 (PyInstaller 打包, 可选)
cd ../electron && npm run build:backend

# 3. 打包 Electron
npm run build:mac     # macOS → .dmg
npm run build:win     # Windows → .exe 安装包
npm run build:linux   # Linux → .AppImage / .deb
```

输出位置: `dist-electron/`

## 文件结构

```
electron/
├── main.js                  # Electron 主进程 (启动后端 + 协议代理 + 窗口)
├── preload.js               # 预加载脚本 (contextBridge IPC)
├── package.json             # 依赖 + electron-builder 配置
├── entitlements.mac.plist   # macOS 签名权限
├── scripts/
│   ├── dev.js               # 开发模式启动器
│   └── build-backend.sh     # PyInstaller 后端打包
└── README.md
```

## 与 Trae 桌面版的区别

| | EcoMind OS | Trae |
|---|---|---|
| 技术栈 | Electron + Python 后端 | Electron (VS Code fork) |
| 定位 | AI Agent 对话 + 数据看板 | IDE 代码编辑器 |
| 包大小 | ~200MB | ~400MB |
| 后端 | Python/FastAPI (内嵌) | Node.js (内嵌) |
| 自更新 | 待实现 | 内置 |
