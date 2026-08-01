# 0003: Electron + React + MUI for the desktop shell

## Status

Accepted

## Context

The desktop app needs a full multi-view GUI (Now Playing with artist bio/art, scrobble
history, profile charts, a friends activity feed, multi-tab preferences) — a much
larger UI surface than foo_scrobbler_mac's single preferences panel. Considered Electron
vs. Tauri + a Node sidecar process.

## Decision

Electron + React + MUI. The renderer imports `packages/core` directly in the same
process family — no IPC/serialization boundary — and the React + Vitest + Playwright
tooling around Electron is the most mature option for this kind of image/chart-heavy,
multi-view UI.

## Consequences

- Install size (~150-200MB, bundled Chromium) is in real tension with the original
  project's "lightweight, no wrapper apps" philosophy. Accepted explicitly, not
  overlooked — revisit if it becomes a real pain point.
- Code signing/notarization (macOS Gatekeeper, Windows SmartScreen) and auto-update
  (`electron-updater`) are real follow-up costs, out of scope for initial scaffolding.
