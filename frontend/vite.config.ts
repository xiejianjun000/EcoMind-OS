import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// import cesium from 'vite-plugin-cesium'; // temporarily disabled for quick test
import { resolve } from 'path';

/** 请求监控插件 — 实时打印 HTTP 请求日志 */
function requestLogger(): Plugin {
  return {
    name: 'request-logger',
    configureServer(server) {
      const startTime = Date.now();
      server.middlewares.use((req, res, next) => {
        const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const method = req.method?.padEnd(6, ' ');
        const url = req.url?.substring(0, 80) || '/';

        // 过滤掉 HMR 和静态资源请求的噪音
        if (url.includes('/@') || url.includes('/node_modules') || url.includes('__vite')) {
          return next();
        }

        const start = Date.now();
        res.on('finish', () => {
          const ms = Date.now() - start;
          const status = res.statusCode;
          const icon = status >= 400 ? '🔴' : status >= 300 ? '🟡' : '🟢';
          const size = (res as any)._contentLength || '-';

          // API 代理请求高亮
          const isProxy = url.startsWith('/api') || url.startsWith('/deepseek') || url.startsWith('/socket.io');
          const prefix = isProxy ? '🌐' : '📄';

          console.log(
            `  ${icon} ${prefix} ${t}  ${method} ${status}  ${ms}ms  ${size}B  ${url}${isProxy ? ' → proxy' : ''}`
          );
        });
        next();
      });

      const uptime = Math.floor((Date.now() - startTime) / 1000);
      console.log(`\n  📡 请求监控已启动 (uptime: ${uptime}s)\n`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    requestLogger(),
    // cesium(), // temporarily disabled for quick test
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {},
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8000',
        ws: true,
      },
      // DeepSeek API 代理 (解决 CORS)
      '/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/deepseek/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/pro-layout'],
          // 'deck-vendor': ['@deck.gl/core', '@deck.gl/layers'], // temporarily disabled
          'chart-vendor': ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
});
