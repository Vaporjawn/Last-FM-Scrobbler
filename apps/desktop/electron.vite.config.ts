import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  // `build.externalizeDeps` defaults to `true`, so main/preload dependencies are
  // externalized without needing the deprecated `externalizeDepsPlugin()`.
  main: {},
  preload: {},
  renderer: {
    root: "src/renderer",
    // `server.forwardConsole` (pipes renderer console output into the terminal
    // running `npm start`) is a real, useful Vite option — but it's Vite 8+ only, and
    // this project is pinned to Vite 7 pending electron-vite confirming Vite 8/Rolldown
    // compatibility. Revisit once that lands.
    build: {
      // The renderer only ever runs inside the exact Chromium electron-builder ships
      // (see apps/desktop's pinned `electron` version) — there's no older browser to
      // support, so skip the downleveling/polyfilling Vite's default target implies.
      target: "esnext",
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
    plugins: [react()],
  },
});
