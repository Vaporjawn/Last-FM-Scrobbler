import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "electron-vite";

export default defineConfig(({ command }) => ({
  // `build.externalizeDeps` defaults to `true`, so main/preload dependencies are
  // externalized without needing the deprecated `externalizeDepsPlugin()`.
  main: {
    // `main/index.ts` reads `process.env.BUG_REPORT_RELAY_URL` directly (unlike
    // LASTFM_API_KEY/SECRET, which go through `resolve-lastfm-credentials.ts`'s
    // injectable-for-testing `env` indirection — a plain `define` can't see through
    // that, so it isn't handled here; that's a separate, still-open gap, not something
    // this fixes). This project documents BUG_REPORT_RELAY_URL as "baked into the
    // packaged app" via a CI repo... except a packaged Electron main process is real,
    // unbundled-by-electron-builder Node.js code — setting the var in the CI job's own
    // environment during `electron-vite build`/`electron-builder` (see
    // .github/workflows/release.yml) only affects that build step's own process; on its
    // own it does nothing to make the value available when the shipped binary later
    // runs on an end user's machine, whose shell has never heard of it. It has to be
    // literally baked into the compiled bundle at build time instead, which is what
    // this `define` actually does — verified by grepping a real `electron-vite build`
    // output for the injected value with none present in the source.
    //
    // Only for `command === 'build'` (`npm run build`/`package*`), never `'serve'`
    // (`npm run dev`/`start`): dev mode deliberately keeps `process.env
    // .BUG_REPORT_RELAY_URL` as a genuine runtime lookup so `main/index.ts`'s existing
    // `process.loadEnvFile(apps/desktop/.env)` call keeps working — a `define` here
    // would turn that runtime read into a value hardcoded at whatever moment
    // `electron-vite dev` last rebuilt main, silently breaking live `.env` edits.
    ...(command === "build"
      ? {
          define: {
            "process.env.BUG_REPORT_RELAY_URL": JSON.stringify(
              // `envDir` defaults to `process.cwd()` (this package's root, since every
              // `npm run build`/`package*` script runs from here), and merges
              // `apps/desktop/.env` (this project's existing local-dev-convenience file
              // — see main/index.ts's docstring on it) with real process.env, which
              // takes precedence — matching how CI's release.yml supplies this var.
              // `''` prefix: loadEnv defaults to only `VITE_`-prefixed vars, and this
              // isn't one. Baked in as `""` (not omitted) when absent either way —
              // `wire-bug-report.ts`'s `isConfigured` check treats that the same as
              // `undefined`.
              loadEnv("production", undefined, "").BUG_REPORT_RELAY_URL ?? "",
            ),
          },
        }
      : {}),
  },
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
}));
