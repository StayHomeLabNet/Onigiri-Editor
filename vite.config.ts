import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/mermaid/") || id.includes("/@mermaid-js/")) {
            return "vendor-mermaid";
          }
          if (id.includes("/@codemirror/") || id.includes("/@lezer/")) {
            return "vendor-codemirror";
          }
          if (id.includes("/@tiptap/") || id.includes("/prosemirror-")) {
            return "vendor-tiptap";
          }
          if (id.includes("/katex/")) {
            return "vendor-katex";
          }
          if (id.includes("/lowlight/") || id.includes("/highlight.js/")) {
            return "vendor-highlight";
          }
          if (
            id.includes("/remark-") ||
            id.includes("/rehype-") ||
            id.includes("/unified/") ||
            id.includes("/mdast") ||
            id.includes("/hast") ||
            id.includes("/micromark") ||
            id.includes("/turndown")
          ) {
            return "vendor-markdown";
          }
          if (id.includes("/lucide-react/")) {
            return "vendor-icons";
          }
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
