import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发模式：vite 端口 5173，/api 代理到本地 decision-workbench 服务（默认 8434）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8434" },
  },
  build: { outDir: "dist" },
});
