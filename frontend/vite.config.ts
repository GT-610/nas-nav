import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 输出目录设置为后端项目的static目录
    outDir: path.resolve(__dirname, '../static'),
    // 清空输出目录
    emptyOutDir: true,
    // 配置静态资源路径
    assetsDir: 'assets',
    // 配置rollup选项
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  // 开发服务器配置
  server: {
    port: 3000,
    // 代理API请求到后端服务器
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
