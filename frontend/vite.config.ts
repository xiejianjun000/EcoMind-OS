import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cesium from 'vite-plugin-cesium';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cesium(),
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
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/pro-layout'],
          'deck-vendor': ['@deck.gl/core', '@deck.gl/layers'],
          'chart-vendor': ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
});
