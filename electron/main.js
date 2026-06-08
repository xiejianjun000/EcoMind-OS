/**
 * EcoMind OS 桌面应用 — Electron 主进程
 * 
 * 架构:
 *   1. 启动 Python 后端 (uvicorn → localhost:8000)
 *   2. 注册 ecomind:// 自定义协议
 *      - /api/* /socket.io/* → 代理到 localhost:8000
 *      - 其他 → 从内置 dist/ 提供静态文件
 *   3. 创建 BrowserWindow 加载 ecomind://index.html
 *   4. 应用退出时清理后端进程
 *
 * 前置: 前端已构建到 frontend/dist/
 *       后端 PyInstaller 已构建到 backend-dist/ (可选, 否则需要 Python 环境)
 */

const {
  app,
  BrowserWindow,
  protocol,
  net,
  dialog,
  Menu,
  shell,
} = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ─── 常量 ────────────────────────────────────────────────

const BACKEND_PORT = 8000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const isDev = !app.isPackaged;
const isMac = process.platform === "darwin";

// 资源路径: 开发时用相对路径, 打包后用 process.resourcesPath
function resourcePath(...parts) {
  if (isDev) {
    return path.join(__dirname, "..", ...parts);
  }
  return path.join(process.resourcesPath, ...parts);
}

const DIST_DIR = isDev
  ? path.join(__dirname, "..", "frontend", "dist")
  : path.join(__dirname, "dist");

const BACKEND_DIR = resourcePath("backend-dist");
const BACKEND_BINARY = isMac
  ? path.join(BACKEND_DIR, "ecomind-backend")
  : path.join(BACKEND_DIR, "ecomind-backend.exe");

// ─── 后端生命周期 ─────────────────────────────────────────

let backendProcess = null;

function getBackendCommand() {
  // 优先使用 PyInstaller 打包的二进制文件
  if (fs.existsSync(BACKEND_BINARY)) {
    return { cmd: BACKEND_BINARY, args: ["--port", String(BACKEND_PORT)] };
  }
  
  // 否则使用系统 Python (开发模式)
  const backendDir = isDev
    ? path.join(__dirname, "..", "backend")
    : resourcePath("backend");
  
  if (fs.existsSync(path.join(backendDir, ".venv", "bin", "python"))) {
    return {
      cmd: path.join(backendDir, ".venv", "bin", "python"),
      args: ["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
      cwd: backendDir,
    };
  }
  
  return {
    cmd: process.platform === "win32" ? "python" : "python3",
    args: ["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
    cwd: backendDir,
  };
}

async function startBackend() {
  const { cmd, args, cwd } = getBackendCommand();
  
  console.log(`[EcoMind] 启动后端: ${cmd} ${args.join(" ")}`);
  if (cwd) console.log(`[EcoMind] 工作目录: ${cwd}`);

  const env = {
    ...process.env,
    ECOMIND_DESKTOP: "1",
    PYTHONUNBUFFERED: "1",
  };

  backendProcess = spawn(cmd, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });

  backendProcess.stdout?.on("data", (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });
  backendProcess.stderr?.on("data", (data) => {
    console.error(`[Backend] ${data.toString().trim()}`);
  });
  backendProcess.on("error", (err) => {
    console.error(`[EcoMind] 后端启动失败:`, err.message);
    dialog.showErrorBox("启动失败", `无法启动后端服务:\n${err.message}\n\n请确保已安装 Python 3.9+ 及依赖。`);
    app.quit();
  });
  backendProcess.on("exit", (code) => {
    console.log(`[EcoMind] 后端进程退出, 代码: ${code}`);
    backendProcess = null;
  });

  // 等待后端就绪
  await waitForBackend();
}

async function waitForBackend(maxRetries = 60, interval = 1000) {
  const http = require("http");
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${BACKEND_URL}/health`, (res) => {
          if (res.statusCode === 200) resolve(null);
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error("timeout")); });
      });
      console.log(`[EcoMind] 后端就绪 (第 ${i + 1} 次尝试)`);
      return;
    } catch {
      if (i % 5 === 4) console.log(`[EcoMind] 等待后端... (${i + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  
  throw new Error(`后端在 ${maxRetries}s 内未就绪`);
}

function stopBackend() {
  if (backendProcess) {
    console.log("[EcoMind] 正在关闭后端...");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(backendProcess.pid), "/f", "/t"]);
    } else {
      backendProcess.kill("SIGTERM");
      // 优雅关闭超时后强制 kill
      setTimeout(() => {
        if (backendProcess) {
          backendProcess.kill("SIGKILL");
        }
      }, 5000);
    }
  }
}

// ─── 自定义协议 ───────────────────────────────────────────

function registerProtocol() {
  protocol.handle("ecomind", async (request) => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // API 请求 → 代理到后端
    if (pathname.startsWith("/api/") || pathname.startsWith("/socket.io")) {
      try {
        const proxyUrl = `${BACKEND_URL}${pathname}${url.search}`;
        return await net.fetch(proxyUrl, {
          method: request.method,
          headers: request.headers,
          body: request.method !== "GET" && request.method !== "HEAD" 
            ? request.body : undefined,
        });
      } catch (err) {
        console.error(`[Protocol] API 代理失败: ${pathname}`, err.message);
        return new Response("Backend unavailable", { status: 502 });
      }
    }

    // 静态文件 → 从 dist/ 提供
    let filePath = pathname === "/" || pathname === ""
      ? "index.html"
      : pathname.replace(/^\//, "");
    
    // SPA fallback: 非文件路径返回 index.html
    const fullPath = path.join(DIST_DIR, filePath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      filePath = "index.html";
    }

    try {
      return await net.fetch(`file://${path.join(DIST_DIR, filePath)}`);
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  });
}

// ─── 窗口创建 ─────────────────────────────────────────────

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "EcoMind OS",
    icon: path.join(DIST_DIR, "vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
    backgroundColor: "#0a1628",
  });

  // 窗口就绪后再显示, 避免白屏闪烁
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // 加载应用
  const loadURL = isDev
    ? "http://localhost:5173"  // 开发模式: Vite dev server
    : "ecomind://index.html";  // 生产模式: 自定义协议

  mainWindow.loadURL(loadURL).catch((err) => {
    console.error("[EcoMind] 加载失败:", err);
    // 回退: 尝试直接加载文件
    mainWindow.loadFile(path.join(DIST_DIR, "index.html")).catch(() => {
      dialog.showErrorBox("加载失败", `无法加载前端页面。\n请确保前端已构建: npm run build`);
      app.quit();
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── 菜单 ─────────────────────────────────────────────────

function createMenu() {
  const template = [
    ...(isMac ? [{
      label: "EcoMind OS",
      submenu: [
        { role: "about", label: "关于 EcoMind OS" },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    }] : []),
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "刷新" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "resetZoom", label: "重置缩放" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "关于",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "EcoMind OS",
              message: "湖南省生态环境系统 AI 智能体协作平台",
              detail: `版本: ${app.getVersion()}\n引擎: DeepSeek-V3/R1\n领域专家: 12 个\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── 应用生命周期 ─────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    registerProtocol();
    createMenu();
    await startBackend();
    createWindow();
  } catch (err) {
    console.error("[EcoMind] 启动失败:", err);
    dialog.showErrorBox("启动失败", err.message);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("quit", () => {
  stopBackend();
});
