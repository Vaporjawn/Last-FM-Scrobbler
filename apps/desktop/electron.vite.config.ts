import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  // `build.externalizeDeps` defaults to `true`, so main/preload dependencies are
  // externalized without needing the deprecated `externalizeDepsPlugin()`.
  main: {},
  preload: {},
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
    plugins: [react()],
  },
});
