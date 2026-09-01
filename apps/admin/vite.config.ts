import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // In a workspace, react-router can resolve React from the root while the
    // app resolves its own nested copy. Two Reacts means every hook throws
    // "Invalid hook call", so pin the bundle to exactly one.
    dedupe: ["react", "react-dom"],
    alias: {
      // @proj/shared compiles to CommonJS for the Express API, and Vite's dev
      // pipeline can't see named exports through the CJS re-export. It's plain
      // TypeScript with no runtime deps, so consume the source directly —
      // that also means no rebuild step when the contract changes.
      "@proj/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url)
      ),
    },
  },
  server: {
    port: 5173,
    // Same-origin API calls in dev, so no CORS and no base-URL config.
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
