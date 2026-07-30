import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const API代理目标 = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3100";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "^/api(?:/|$)": {
        target: API代理目标,
        changeOrigin: true,
      },
      "/health": {
        target: API代理目标,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  test: {
    environment: "happy-dom",
    globals: false,
  },
});
