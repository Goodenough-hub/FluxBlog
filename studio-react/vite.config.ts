import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// React 子应用构建：
// - base: /blog/studio-app/ —— FluxBlog Astro base=/blog，React 静态产物挂在同前缀下
// - outDir: ../public/studio-app/ —— 直接落到 Astro public 目录，Astro build 时原样复制到 dist/client/studio-app/
// - 产物为静态 SPA，HashRouter 处理路由，避免 Astro SSR 介入
export default defineConfig({
  base: "/blog/studio-app/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../public/studio-app",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        // 拆分 vendor chunk 减小主 bundle
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          antd: ["antd", "@ant-design/icons"],
          vditor: ["vditor"],
        },
      },
    },
  },
});
