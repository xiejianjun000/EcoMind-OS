/**
 * EcoMind OS 预加载脚本
 * 
 * 通过 contextBridge 安全暴露有限的 Node.js / 桌面能力给渲染进程。
 * 遵循 Electron 安全最佳实践: contextIsolation + sandbox。
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ecomind", {
  /** 桌面平台信息 */
  platform: process.platform,
  isDesktop: true,
  isMac: process.platform === "darwin",
  isWindows: process.platform === "win32",
  isLinux: process.platform === "linux",

  /** 应用版本 */
  version: process.env.npm_package_version || "1.0.0",

  /** 最小化窗口 */
  minimize: () => ipcRenderer.send("window-minimize"),
  
  /** 最大化/还原窗口 */
  maximize: () => ipcRenderer.send("window-maximize"),
  
  /** 关闭窗口 */
  close: () => ipcRenderer.send("window-close"),

  /** 打开外部链接 (系统默认浏览器) */
  openExternal: (url) => ipcRenderer.send("open-external", url),

  /** 选择文件对话框 */
  selectFile: (options) => ipcRenderer.invoke("dialog:selectFile", options),
  
  /** 选择目录对话框 */
  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),

  /** 获取应用数据目录 */
  getAppDataPath: () => ipcRenderer.invoke("app:getDataPath"),

  /** 监听后端状态 */
  onBackendStatus: (callback) => {
    ipcRenderer.on("backend-status", (_, status) => callback(status));
  },

  /** IPC 事件监听 */
  on: (channel, callback) => {
    const validChannels = ["backend-status", "app-update", "notification"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => callback(data));
    }
  },

  /** 移除 IPC 监听 */
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
