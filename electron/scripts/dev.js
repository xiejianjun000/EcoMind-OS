/**
 * 开发模式启动器
 * 同时启动 Vite 前端 + Python 后端，Electron 加载 localhost:5173
 *
 * 用法: npm run dev  (在 electron/ 目录下)
 */

const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const FRONTEND = path.join(ROOT, "frontend");
const BACKEND = path.join(ROOT, "backend");

function startProcess(name, cmd, args, opts = {}) {
  console.log(`[Dev] 启动 ${name}: ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: true,
    ...opts,
  });
  child.on("error", (err) => {
    console.error(`[Dev] ${name} 错误:`, err.message);
  });
  child.on("exit", (code) => {
    console.log(`[Dev] ${name} 退出 (${code})`);
  });
  return child;
}

// 1. 启动后端 (Python uvicorn)
const backendChild = startProcess(
  "Backend",
  process.platform === "win32" ? "python" : "python3",
  ["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
  { cwd: BACKEND, env: { ...process.env, ECOMIND_DESKTOP: "1" } }
);

// 2. 启动前端 (Vite dev server)
const frontendChild = startProcess(
  "Frontend",
  "npx",
  ["vite", "--port", "5173"],
  { cwd: FRONTEND }
);

// 3. 等待二者就绪后启动 Electron
const { execSync } = require("child_process");

async function waitForPort(port, label) {
  const http = require("http");
  for (let i = 0; i < 60; i++) {
    try {
      await new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/health`, (res) => { resolve(); });
        http.get(`http://localhost:${port}`, (res) => { resolve(); });
        setTimeout(resolve, 1000);
      });
      console.log(`[Dev] ${label} (port ${port}) 就绪`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.warn(`[Dev] ${label} 可能未就绪，继续...`);
}

setTimeout(async () => {
  await waitForPort(8000, "Backend");
  await waitForPort(5173, "Frontend");
  
  console.log("[Dev] 启动 Electron...");
  const electronChild = startProcess("Electron", "npx", ["electron", "."], {
    cwd: path.join(ROOT, "electron"),
    env: { ...process.env, NODE_ENV: "development" },
  });
}, 2000);

// 清理
process.on("SIGINT", () => {
  console.log("\n[Dev] 正在关闭...");
  [backendChild, frontendChild].forEach((child) => {
    if (child && !child.killed) {
      child.kill();
    }
  });
  process.exit(0);
});
