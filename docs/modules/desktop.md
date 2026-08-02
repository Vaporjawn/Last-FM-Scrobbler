# `apps/desktop`

## Responsibility

Electron + React + MUI desktop shell. Five destinations: Now Playing, Scrobbles
(history), Profile (top artists), Friends, and Preferences (Accounts).

## Required environment variables

- `LASTFM_API_KEY` / `LASTFM_API_SECRET` — credentials for *this application* as
  registered at https://www.last.fm/api/account/create, **not** something individual
  end users provide. Every user of this app authenticates through the same registered
  application, then gets their own per-user session key via the in-app login flow (see
  below). This project never generates or hardcodes real Last.fm credentials — set
  these two environment variables yourself before running `npm run dev`/`start`, and
  bake them into whatever build pipeline produces distributable packages. Without
  them, the app still launches, but login and all Last.fm data views report "not
  configured" rather than throwing.
- `BUG_REPORT_RELAY_URL` — the deployed URL of `services/bug-report-relay` (e.g.
  `https://lastfm-scrobbler-bug-report-relay.<your-subdomain>.workers.dev/report`),
  set once that Worker is deployed with its own `GITHUB_PAT` secret (see
  docs/modules/bug-report-relay.md). Without it, the "Report a Bug" button still
  appears but reports "not configured" instead of submitting.

## Login UX

Preferences → Accounts has a single "Log in with Last.fm" button. Clicking it drives
`packages/core`'s `AuthFlow`: it opens the user's default browser to Last.fm's own
authorization page and polls silently in the background until they click "Allow
Access" there — no token to copy or paste, no second screen in this app. The resulting
session key is stored via `ElectronSecretStorage` (Electron's `safeStorage`, OS
keychain-backed) and never crosses the IPC boundary to the renderer — only the
username does. Multiple accounts can be stored; one is "active" at a time (switchable
from the same tab).

Note for Linux: `safeStorage` depends on a system keyring (libsecret/gnome-keyring/
kwallet), which minimal window-manager setups can lack. When that's the case,
`main/auth/create-account-store.ts` catches it and disables login for that run (with a
logged warning) rather than crashing the app or silently storing secrets insecurely.

## Scrobbling pipeline

`main/playback/wire-now-playing.ts` drives a `Tracker` (from `packages/core`) off the
platform `PlaybackSource`; eligible plays are hand off to
`main/scrobbling/wire-scrobbling.ts`, which enqueues them in a `ScrobbleQueue`
(SQLite, survives restarts) and periodically drains the queue to Last.fm using
whichever account is currently active. If no account is active yet, scrobbles simply
accumulate in the queue (bounded — see docs/adr/0006-offline-queue-persistence.md)
until the user logs in.

## Bug reporting

A "Report a Bug" button lives at the bottom of the sidebar (next to Preferences,
always visible regardless of which view is active). It opens a dialog
(`BugReportDialog`) for a title and description, then submits both — plus
diagnostics (`platform`, `arch`, `appVersion`, and the last 50 log lines from a
main-process `Logger`) — to `services/bug-report-relay` via
`main/bug-report/wire-bug-report.ts`, which files them as an anonymous GitHub issue.
No GitHub account is required, and no Last.fm credential is ever included (see
`docs/adr/0004-anonymous-bug-report-relay.md`).

## A real gotcha found via live verification: `electron`'s ESM named exports

Every main-process/preload file imports from `"electron"` via a **default import,
destructured at runtime** —

```ts
import electron from "electron";
const { app, BrowserWindow, ipcMain, safeStorage, shell } = electron;
```

— rather than `import { app, BrowserWindow, ... } from "electron"`. This was changed
after actually launching the built app (`electron-vite preview`) surfaced
`SyntaxError: The requested module 'electron' does not provide an export named
'BrowserWindow'`, which unit tests alone never would have caught (they mock
`"electron"` entirely). Relatedly: if you're developing inside a shell where
`ELECTRON_RUN_AS_NODE=1` is set (some sandboxed/CI shells set this), Electron's binary
runs as plain Node.js and the real `electron` module — named *or* default export —
isn't available at all; `electron` in-process becomes `undefined`/inert instead of the
real API. That variable must be unset (or absent) for `npm run dev` / `electron-vite
preview` to actually launch a working window.

## Not yet built (real feature work, tracked here so it isn't lost)

- Now Playing's artist bio / similar-artists panel and love/tag actions (the view
  shows live title/artist/album/state; the richer per-track detail from
  `LastfmClient.getArtistInfo`/`getSimilarArtists` isn't wired into it yet).
- Tray icon and "launch at login".
- Auto-update (`electron-updater`).
- *Automatic* crash reporting — an opt-in reporter that auto-fills the bug-report
  dialog (or reports silently) on an unhandled exception/crash. The manual "Report a
  Bug" button/dialog is built (see "Bug reporting" above); wiring it to fire
  automatically on a crash is not.
- i18n / language selection.
- Code signing and notarization for distribution.
- Scrobbling settings UI (enable/disable, exclusion filter expression editor for
  `packages/core`'s filter DSL) — the pipeline honors a `CompiledFilter` if the
  `Tracker` is constructed with one, but there's no UI yet to author one.

## Dependencies

`react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`,
`@emotion/styled`, `electron`, `electron-vite`, `@lastfm-scrobbler/shared-types`,
`@lastfm-scrobbler/core`, and all three platform adapters
(`@lastfm-scrobbler/adapter-{macos,linux,windows}`).

## Status

All five views are real (not placeholders): Now Playing, Scrobbles, Profile, and
Friends render live data once logged in (or a clear "log in on Preferences" prompt
when not); Preferences has a fully functional Accounts tab; bug reporting is wired
end to end. Main-process wiring (playback source selection, now-playing IPC, auth
IPC, read-only Last.fm data IPC, scrobble queue + submission, bug-report relay) is
complete and unit-tested (83 tests: secret storage, account store construction, auth
IPC, Last.fm data IPC, scrobbling queue/submission logic against a real in-memory
`ScrobbleQueue`, bug-report IPC, and renderer component behavior via Testing Library
with faked `window.*` APIs).

Live-verified end to end on this machine, twice — once after the initial auth/
scrobbling/views work, and again after adding bug reporting: the production build
(`electron-vite build` + `electron-vite preview`) launches a real, stable multi-process
Electron app (main/GPU/network/renderer processes all present, matching Electron's
normal architecture) with no startup errors. The second run additionally confirmed
`createPlatformPlaybackSource()` genuinely spawns `packages/adapter-macos`'s real
`mediaremote-adapter.pl` child process as part of normal app startup on this machine —
end-to-end proof the adapter is correctly wired into the running app, not just
independently tested. Not verified: actual on-screen rendering content (this
development environment has no attached display, so screenshots aren't possible —
verification stopped at "the process tree is healthy and nothing crashed"), and the
full login → scrobble round trip against the real Last.fm API, or a real bug-report
submission against a deployed relay (no Last.fm API credentials, Cloudflare account,
or deployed relay URL were available in this environment).
