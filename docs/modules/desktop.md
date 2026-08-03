# `apps/desktop`

## Responsibility

Electron + React + MUI desktop shell. Five destinations: Now Playing, Scrobbles
(history), Profile (top artists), Friends, and Settings (General/Accounts). Runs as
a background app by default — see "Background app (tray / menu bar)" below.

## Required environment variables

- `LASTFM_API_KEY` / `LASTFM_API_SECRET` — credentials for *this application* as
  registered at https://www.last.fm/api/account/create. This project never generates
  or hardcodes real Last.fm credentials — set these two environment variables
  yourself before running `npm run dev`/`start`, and bake them into whatever build
  pipeline produces distributable packages, **or** skip this entirely and let end
  users supply their own key via Settings → Accounts (see "Bring your own key"
  below) — either path works, and both are available in the same build
  simultaneously. Without *either* source configured, the app still launches, but
  login and all Last.fm data views report "not configured" rather than throwing.
  **The "bake into the build pipeline" half is currently aspirational, not actually
  true for a packaged build** — see "Bug reporting" below for why (a real, distinct
  bug, found and only partially fixed while verifying `BUG_REPORT_RELAY_URL`).
- `LIBREFM_API_KEY` / `LIBREFM_API_SECRET` — the same idea as `LASTFM_API_KEY`/
  `LASTFM_API_SECRET` above, but for Libre.fm (an additional, optional scrobbling
  destination connected *alongside* Last.fm, not instead of it — see "Additional
  services" below). **Not currently configured for this repo** — nothing in this repo
  has ever registered a real Libre.fm API key, so this pair is unset by default and
  Settings → Accounts falls back to its own "bring your own key" form for Libre.fm
  until someone supplies one. Set these two locally/in a build pipeline exactly like
  the Last.fm pair once you have a real Libre.fm-issued key, and Libre.fm's own
  Settings → Accounts UI collapses to a single "Log in with Libre.fm" button, same as
  Last.fm's.
- `BUG_REPORT_RELAY_URL` — the deployed URL of `services/bug-report-relay` (e.g.
  `https://lastfm-scrobbler-bug-report-relay.<your-subdomain>.workers.dev/report`),
  set once that Worker is deployed with its own `GITHUB_PAT` secret (see
  docs/modules/bug-report-relay.md). Without it, the "Report a Bug" button still
  appears but reports "not configured" instead of submitting. Unlike
  `LASTFM_API_KEY`/`LASTFM_API_SECRET` above, this one really does get baked into a
  packaged build correctly — see "Bug reporting" below.

**For local dev**, create `apps/desktop/.env` (git-ignored — see the repo's root
`.gitignore`) instead of exporting these in your shell every time:

```
LASTFM_API_KEY=
LASTFM_API_SECRET=
LIBREFM_API_KEY=
LIBREFM_API_SECRET=
BUG_REPORT_RELAY_URL=
```

`main/index.ts` loads it automatically on startup via the built-in
`process.loadEnvFile()` (stable since Node 22.21/24.10, available since 20.12 — no
extra dependency), skipped entirely in a packaged build (`app.isPackaged`), since a
distributed app has no reason to read a loose text file for secrets — see that file's
comment for the exact reasoning. This is purely a "don't retype it every launch"
convenience; it changes nothing about *where* the values come from — you still have to
obtain a real key yourself (nothing in this repo can do that for you, and nothing here
ever hardcodes one), same as documented above and in "Bring your own key" below.

**Configured for this repo**: `LASTFM_API_KEY`/`LASTFM_API_SECRET` are set as
[repository secrets](https://github.com/Vaporjawn/Last-FM-Scrobbler/settings/secrets/actions)
on `Vaporjawn/Last-FM-Scrobbler` (never in source — see `.github/workflows/release.yml`,
which reads them via `secrets.LASTFM_API_KEY`/`secrets.LASTFM_API_SECRET` into the
package-build step's environment, same pattern as `CSC_LINK`/`APPLE_ID`/etc. right
below it) and locally in a git-ignored `apps/desktop/.env` for dev. A real key/secret
pair must **never** be added directly to any tracked file, workflow YAML, or committed
config — this repo is public, and git history is effectively permanent even after a
value is later rotated on Last.fm's side. Rotate via the [API account
page](https://www.last.fm/api/accounts) if either value is ever suspected exposed
(e.g. pasted somewhere outside these two storage locations), then update both the repo
secrets and local `.env` to match.

## Login UX

Settings → Accounts has a single "Log in with Last.fm" button. Clicking it drives
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

**Why this can't be a guaranteed "push" back to the app**: verified directly against
Last.fm's own API docs (`last.fm/api/desktopauth`), the desktop token-based auth flow
has **no redirect/callback mechanism at all**. Their docs state it plainly: after the
user grants access, "the user is asked to close their browser and return to your
application" — manually. (The `cb` callback-URL parameter that *does* exist is
documented under the separate "web application" flow at `last.fm/api/webauth`, which
uses a different, token-less mechanism entirely — Last.fm generates and delivers the
token via that callback itself, rather than the app pre-fetching one via
`auth.getToken` the way this app does. It doesn't apply here.) A custom
`myapp://callback` URL scheme — the standard fix for "the browser can't get back to a
desktop app" in OAuth-style flows — was investigated and ruled out for exactly this
reason: there's nothing Last.fm will ever redirect to. This app's desktop auth is
`auth.getToken` → open browser → silently poll `auth.getSession` until it stops
returning "not authorized yet", by design, with no way to be told "done" any faster or
more reliably than that.

Given that, "jumping back to the app" can only ever be a **best-effort courtesy**, not
a guaranteed handoff — and the UI (`SettingsPage.tsx`) says so explicitly while
`isLoggingIn` is true, so the user's own expectation matches what Last.fm's flow can
actually promise rather than what a nicer-looking notification implies it can.
`wire-auth.ts` covers both outcomes of that wait:

- **`onLoginSuccess`** (wired in `main/index.ts`) runs right after the session is
  stored, with two independent, best-effort mechanisms:
  1. `main/window/bring-app-to-foreground.ts`'s `bringAppToForeground()` — extracted
     into its own module specifically so its exact behavior is unit-tested (see
     `tests/main/window/bring-app-to-foreground.test.ts`): `app.focus({steal: true})`
     **first** (macOS-only, the documented way for a background app to forcibly
     retake focus — order matters here, since a window can't out-rank the OS-level
     active-app decision on its own), then `restore()`-if-minimized, `show()`,
     `moveTop()`, `focus()`, and finally `app.dock?.bounce("critical")` /
     `window.flashFrame(true)` as a fallback that doesn't require focus-stealing
     permission. **What the tests actually prove**: that every one of these calls
     happens, with the right arguments, in the right order, and that the
     no-window/no-dock/not-minimized edge cases are handled correctly. **What no
     test can prove**: that a real OS actually honors any of this — macOS in
     particular treats focus-stealing as something to actively resist, and
     Electron's own docs say to use `steal` "as sparingly as possible" precisely
     because it isn't guaranteed. That's real, live window-manager behavior with no
     CI equivalent.
  2. A native OS notification (`notifications/show-notification.ts`) reading "Logged
     in — You're now logged in to Last.fm Scrobbler as {username}", fired alongside
     (not instead of) the above. This is the one signal in the whole chain that's
     actually guaranteed to appear regardless of focus, Do Not Disturb, or window
     manager — clicking it re-runs `bringAppToForeground()` in case the window still
     isn't visible. Even this has one caveat, see below.
- **`onLoginFailed`** (also wired in `main/index.ts`) runs when `AuthFlow.authenticate()`
  throws — most commonly `AuthTimeoutError` after the default 5-minute poll window
  elapses with no approval. Before this existed, a failure here was **completely
  silent** unless the user happened to still be looking at the window when it
  happened (only then would `SettingsPage`'s snackbar, driven by the renderer-side
  promise rejection, ever be seen) — for a flow whose entire premise is sending the
  user away to a browser, that's the common case, not an edge case. It now also fires
  a native "Login failed" notification with the error message, independent of window
  focus, the same way the success path does.

Both outcomes are logged via the main-process `Logger` (visible in a bug report's
diagnostics) — if a user reports neither the window coming forward nor a notification
appearing, check, in order: (1) whether `showNotification` itself logged
`"skipped (...) — Notification.isSupported() is false"` (macOS notification
permissions for an unsigned/ad-hoc dev build, or a Linux desktop with no notification
daemon, can make this false even though the code ran correctly — this used to be a
silent no-op with zero trace of it happening, which is exactly what made this bug hard
to diagnose the first few times around); (2) whether a "Login failed" log line shows
up at all, roughly 5 minutes after login was started (points at the poll timing out —
i.e., "Allow Access" was never actually clicked on Last.fm's page, or was clicked too
late); (3) whether *neither* appears at all, which points at `onLoginSuccess`/
`onLoginFailed` not being reached — a real wiring bug upstream, in `AuthFlow` itself or
the IPC plumbing, rather than anything about focus or notifications specifically. Also
worth ruling out first, given this app is designed to persist in the background: make
sure you're testing against a freshly *restarted* process (fully quit via the tray/menu
bar "Quit" item, not just closed-to-tray) after any code change — Electron's main
process doesn't hot-reload, and `wireCloseToTray` deliberately keeps the same
long-running process alive across window closes, so it's easy to keep testing stale
code without realizing it.

### Bring your own key

Logging in needs an *application*-level Last.fm API key/secret pair to exist first
(distinct from the per-user session key `AuthFlow` gets — see above). There are two
ways to supply one, and both are available in the same build at once:

1. **Baked in by whoever built this instance** — `LASTFM_API_KEY`/`LASTFM_API_SECRET`
   environment variables (see above). Takes precedence when set.
2. **Supplied by the end user** — an "API key" / "Shared secret" form in
   Settings → Accounts, shown directly (no gate in front of it) whenever no
   environment-baked key is active, with a link to
   https://www.last.fm/api/account/create to generate the pair. That link is
   pre-filled via query string (see `buildCreateApiAccountUrl()`) so there's nothing
   to type on Last.fm's side beyond clicking "Submit" — it does still require being
   logged in to last.fm.com to view at all (Last.fm's own login page handles that
   redirect if you aren't), but this app has no reliable way to know whether that's
   true at any given moment, so it doesn't try to gate anything on it. An earlier
   version of this flow had a "Log in to Last.fm" button as an explicit first step
   that had to be clicked before the key form would even appear; it was removed
   because it wasn't tracking anything real — clicking it only opened a browser tab
   and flipped a local boolean, with no way to confirm the login it implied actually
   happened, so it was pure friction with no corresponding signal.

   Saving persists it via `AppCredentialsStore` (`ElectronSecretStorage`-backed, same
   mechanism as account session keys, but a separate store/file —
   `app-credentials.json` vs. `secrets.json` — since this holds an application
   credential, not a per-user one). A saved key only takes effect on the *next* launch
   (`main/lastfm/resolve-lastfm-credentials.ts` resolves it once at `app.whenReady()`),
   so the Settings UI offers a "Restart now" button (`window.auth.relaunch()` →
   `app.relaunch()` + `app.exit()`) right after saving.

Either source, once active, unlocks the exact same "Log in with Last.fm" button and
`AuthFlow` described above — the end user never sees a difference. A user-supplied key
can be changed or removed from Settings ("Remove saved API key"); an
environment-baked one can't (it was a deliberate choice by whoever built/launched this
instance, so Settings doesn't offer to edit or clear it — see
`window.auth.credentialsSource()`).

### Additional services (Libre.fm / ListenBrainz)

Settings → Accounts also offers Libre.fm and ListenBrainz — connected *alongside*
Last.fm, not switched between: every scrobble and now-playing update goes to every
currently-connected service at once (see `main/scrobbling/wire-scrobbling.ts`'s
docstring). Each has its own connect/disconnect state, entirely independent of
Last.fm's.

**Libre.fm** reuses `LastfmClient` itself, pointed at Libre.fm's own API/auth-page
URLs (protocol-identical to Last.fm — see `LastfmClientOptions.baseUrl`/`authUrl`) —
and follows the *exact same* `LIBREFM_API_KEY`/`LIBREFM_API_SECRET`-then-bring-your-
own-key precedence Last.fm uses (see `resolve-librefm-credentials.ts`), so once a real
key is baked in, Settings collapses to a single "Log in with Libre.fm" button, same as
Last.fm. One thing this differs from Last.fm on deliberately: a saved Libre.fm key
takes effect *immediately*, no relaunch needed (`resolveLibrefmCredentials` is
re-checked on every login attempt, not resolved once at startup) — there's no
"environment vs. user-supplied, fixed for the process lifetime" split to preserve the
way Last.fm's `credentialsSource` has, since nothing else in this app depends on
Libre.fm's client being constructed only once. **Two things about Libre.fm were not
independently live-verified this session** (see `wire-secondary-auth.ts`'s docstrings
for the full caveat): the exact authorization-page URL (guessed by analogy with
Last.fm's own `www.last.fm`-vs-`ws.audioscrobbler.com` split), and whether Libre.fm's
signed endpoints (`auth.getSession`, `track.scrobble`) actually require a *real*,
Libre.fm-registered key/secret pair, or tolerate an arbitrary one the way
`auth.getToken` was confirmed to. If login fails once a real attempt is made, checking
those two things first is the fastest path to a fix.

**ListenBrainz** has no browser-authorization flow to offer at all — confirmed against
its own official docs and source (`docs/users/api/index.rst` in
`metabrainz/listenbrainz-server`): third-party listen submission is authenticated with
a per-account token the user copies from their own settings page, full stop. (The
wider MetaBrainz ecosystem does have an OAuth2 system as of mid-2026 — see
https://blog.metabrainz.org/2026/06/25/upcoming-changes-to-user-accounts-and-authentication/
— but it isn't wired up to grant a ListenBrainz listen-submission token, so it doesn't
help here.) Settings → Accounts can't turn this into a "log in" button the way
Last.fm/Libre.fm's flows work; the best available UX is a direct link to
https://listenbrainz.org/settings/ next to the token field, so there's at least
nothing to hunt for.

## Background app (tray / menu bar)

Playback tracking and scrobbling only happen while the app process is running, so
closing the window doesn't quit it by default — `main/tray/wire-close-to-tray.ts`
intercepts the window's `close` event and hides it instead, as long as
`AppSettings.closeToTray` is enabled (the default; see `shared/settings-api.ts` and
`main/settings/settings-store.ts`, a plain JSON file at
`app.getPath("userData")/settings.json`). `main/tray/create-tray.ts` puts an icon in
the system tray (Windows/Linux) or menu bar (macOS, rendered as a template image so
the OS recolors it for light/dark mode and Retina automatically — see
`apps/desktop/resources/tray-iconTemplate*.png`) with "Show"/"Quit" entries, so the
app stays reachable and can still be told to actually exit. Settings → General has
a "Keep running in the tray/menu bar when the window is closed" toggle for turning
this off; the real-quit paths (the tray's "Quit" item, Cmd+Q, `app.quit()`) all route
through one `isQuitting` flag so they aren't re-intercepted as a hide.

The very first time the window is actually hidden this way — across the whole
install's lifetime, not just this run — `main/index.ts`'s `handleTrayHide()` shows a
one-time native "Still running" notification explaining where the app went (see
"Native notifications" below). Tracked via `AppSettings.hasShownTrayHint` (not a
Settings toggle — this is bookkeeping, not something to choose a value for) so it
never repeats after that first time. `wire-close-to-tray.ts` itself stays a pure
"hide instead of close" policy module — it just calls an optional `onHide` callback
every time it actually hides the window; the one-time/persisted-flag decision lives
in `main/index.ts`, not there.

Tray icon assets are hand-built minimal PNGs (see the git history for the generator
script) rather than real artwork — there's no image-editing tool in this environment.
`apps/desktop/resources/` ships alongside the packaged app via electron-builder's
`extraResources` (see "Packaging & distribution" below), so `resolve-tray-icon-path.ts`
resolves correctly both in `npm run dev`/`electron-vite preview` and in a real
packaged build — see `resolve-resource-path.ts` for exactly how (`app.getAppPath()`
in dev vs. `process.resourcesPath` once packaged; these are **not** interchangeable
when `asar` is enabled, a real bug caught and fixed while adding the app icon below).

## App icon

The app's own icon (Dock/taskbar/window icon, and the packaged installer's icon) is
derived from Last.fm's own high-resolution `apple-touch-icon`
(`https://www.last.fm/static/images/lastfm_avatar_applemusic*.png`, 1024×1024) —
generated into `apps/desktop/build/icon.{icns,ico,png}` via macOS's `sips`/`iconutil`
(`.icns`) and ImageMagick (`.ico`), referenced by `electron-builder.yml`'s
`mac.icon`/`win.icon`/`linux.icon`. This is a fan-made, unofficial Last.fm client —
not affiliated with or endorsed by Last.fm — using their icon for recognizability,
the same way most unofficial clients for a service do.

In a packaged build, electron-builder bakes the icon into the app bundle itself at
package time — nothing in this app's own runtime code touches it. In dev mode
(`npm run dev`/`electron-vite preview`, which never runs electron-builder at all),
`apps/desktop/resources/app-icon.png` (a 512×512 copy of the same source, shipped
alongside the tray icons via the same `extraResources` mechanism) is set explicitly:
`create-main-window.ts`'s `BrowserWindow` `icon` option (Windows/Linux window/taskbar
icon) and `main/index.ts`'s `app.dock.setIcon(...)` call (macOS Dock icon
specifically — `BrowserWindow`'s `icon` option doesn't affect that on macOS).
`resolve-app-icon-path.ts` resolves the right path for dev vs. packaged the same way
`resolve-tray-icon-path.ts` does (see above) — both now share one `resolve-resource-path.ts`
helper rather than duplicating that dev-vs-packaged branch.

Real custom icon *artwork* commissioned specifically for this project is still not
built — see "Not yet built" below; this section is about the (real, working,
Last.fm-derived) icon that exists today, not a placeholder.

The project's public landing page (`apps/site/`, a GitHub Pages deployment) is
documented separately — see docs/modules/site.md — it's a sibling of this app, not
part of it, despite reusing this app's icon for its favicon (see "App icon" above).

## Scrobbling pipeline

`main/playback/wire-now-playing.ts` drives a `Tracker` (from `packages/core`) off the
platform `PlaybackSource`; eligible plays are hand off to
`main/scrobbling/wire-scrobbling.ts`, which enqueues them in a `ScrobbleQueue`
(SQLite, survives restarts) and periodically drains the queue to Last.fm using
whichever account is currently active. If no account is active yet, scrobbles simply
accumulate in the queue (bounded — see docs/adr/0006-offline-queue-persistence.md)
until the user logs in.

## Bug reporting

A "Report a Bug" button lives at the bottom of the sidebar (next to Settings,
always visible regardless of which view is active). It opens a dialog
(`BugReportDialog`) for a title and description, then submits both — plus
diagnostics (`platform`, `arch`, `appVersion`, and the last 50 log lines from a
main-process `Logger`) — to `services/bug-report-relay` via
`main/bug-report/wire-bug-report.ts`, which files them as an anonymous GitHub issue.
No GitHub account is required, and no Last.fm credential is ever included (see
`docs/adr/0004-anonymous-bug-report-relay.md`).

If "Report a Bug" shows "not configured" instead of a form, that's this build's
`BUG_REPORT_RELAY_URL` (see above) being unset — not a bug in the dialog itself. The
relay's code is complete and tested, but has never actually been deployed from this
development environment (no Cloudflare account was available here); deploying it is
now automated via `.github/workflows/deploy-bug-report-relay.yml` once this repo's
maintainer configures `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets — see
docs/modules/bug-report-relay.md's "Deployment" section for exactly what that involves
and what URL to set `BUG_REPORT_RELAY_URL` to afterward (as a `BUG_REPORT_RELAY_URL`
repo secret — `.github/workflows/release.yml`'s packaging step reads it from there).

Every layer of this feature — dialog → hook → preload → IPC → `wire-bug-report.ts` →
the relay Worker → GitHub's REST API — has been verified end-to-end: comprehensive
mocked tests at every layer (see each file's own test), plus a real (not mocked) local
run of the relay itself via `wrangler dev`, exercising its actual `workerd` runtime
against real `POST` requests all the way to real calls to `api.github.com` — first
against a placeholder PAT (401, correctly wrapped into a non-leaking `502`), then, once
this repo's owner supplied a real `GITHUB_PAT`, an actual filed issue
(https://github.com/Vaporjawn/Last-FM-Scrobbler/issues/9) proving the full path works
end-to-end, not just up to a credential boundary — see docs/modules/bug-report-relay.md's
"Status".
The one thing that *was* a genuine bug (not just "not deployed yet"): setting
`BUG_REPORT_RELAY_URL` as a CI secret during packaging did nothing on its own — a
packaged Electron main process is real Node.js code, and CI-time env vars only exist
for that CI job's own process, not the binary it produces. Fixed by having
`apps/desktop/electron.vite.config.ts` `define`-inline `process.env.BUG_REPORT_RELAY_URL`
into the compiled main bundle at `electron-vite build` time (verified by grepping a real
build's output for the injected value) — dev mode (`npm run dev`/`start`) is untouched
and still reads a real `apps/desktop/.env` at runtime, same as before. **Known, separate,
still-open gap this did not fix**: `LASTFM_API_KEY`/`LASTFM_API_SECRET` have the exact
same "CI secret alone doesn't reach the packaged binary" problem, but aren't fixed by
this — they're read through `resolve-lastfm-credentials.ts`'s injectable-for-testing
`env` indirection (`const env = options.env ?? process.env`), which a build-time
`define` can't see through since it only matches the literal source expression
`process.env.X`, not an aliased local variable. Until that's addressed separately, the
"baked into the packaged app" claim for the Last.fm API key above is aspirational, not
actually true for a real distributed build — a packaged app currently falls through to
"Bring your own key" regardless of what `LASTFM_API_KEY`/`LASTFM_API_SECRET` repo
secrets are set.

## Packaging & distribution

`apps/desktop/electron-builder.yml` + `apps/desktop/scripts/package.mjs` produce real
installers: `npm run package:mac`/`package:win`/`package:linux` (or plain
`package`/`package:dir` for the current platform) build `out/` via `electron-vite`
first, then run `electron-builder` to produce a `.dmg`/`.zip` (macOS), `.exe`
NSIS installer + portable `.exe` (Windows), or `.AppImage`/`.deb` (Linux) into
`apps/desktop/release/`.

A few things worth knowing if you touch this config:

- **`asar: true` with a targeted `asarUnpack`, not `asar: false`.** Three things need
  to exist as real files on disk rather than sealed inside `app.asar` (asar is a
  virtual/single-file archive; `spawn()` and native `dlopen`/`require()` can't reach
  into it): any native Node addon (`**/*.node` — covers `better-sqlite3`), the two
  platform adapters' compiled native binaries (`**/native-build/**` —
  `MediaRemoteAdapter.framework` for macOS, `SmtcHelper.exe` for Windows, each
  resolved by the adapter relative to its own package root at runtime — see
  `packages/adapter-macos/src/index.ts` and
  `packages/adapter-windows/src/smtc/resolve-helper-path.ts`), and the vendored
  `mediaremote-adapter.pl` script (`**/vendor/mediaremote-adapter/**`) macOS passes as
  a literal file path to a spawned `perl` process. Verified locally: a first attempt
  at plain `asar: false` (copy everything as real files, nothing sealed) made
  electron-builder's own node_modules file-copier choke trying to recreate
  `MediaRemoteAdapter.framework`'s internal `Versions/Current` symlinks
  (`ENOENT: no such file or directory, ensureSymlink`); `asarUnpack`'s copier handles
  the same framework correctly.
- **Native module rebuilding for Electron's ABI** (`better-sqlite3`) is handled by
  electron-builder's own default `npmRebuild: true` behavior (invokes
  `@electron/rebuild` automatically before packaging) — nothing extra configured here.
- **Ad-hoc code signing is forced on macOS when no real certificate is configured**,
  via `apps/desktop/scripts/package.mjs` passing `--config.mac.identity=-` unless
  `CSC_LINK` is set. This isn't optional cosmetic polish: verified locally that a
  *fully unsigned* packaged app (electron-builder's own default when it finds no
  valid signing identity — confirmed via `codesign -dv`, which showed the raw
  downloaded Electron binary's own original signature untouched, `Sealed
  Resources=none`) fails to launch at all on Apple Silicon with **no error output of
  any kind** — the kernel's code-integrity enforcement silently kills it. Ad-hoc
  signing (`codesign --sign -`, no real identity, still not enough to satisfy
  Gatekeeper's "identified developer" check) is the minimum needed for the app to
  actually run locally; verified via `codesign -dv` showing a complete,
  correctly-sealed signature (`Sealed Resources version=2 rules=13 files=182`) after
  this fix.
- **Signing with a real certificate + notarization are both wired but inert without
  credentials** — this project never bakes in real certificates (same reasoning as
  `LASTFM_API_KEY`). Set `CSC_LINK`/`CSC_KEY_PASSWORD` (macOS/Windows shared, or
  `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` to use a different cert per platform) and,
  for notarization, `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` as
  environment variables (or the equivalent repo secrets in
  `.github/workflows/release.yml`) to sign for real; electron-builder
  (via `@electron/notarize`) only attempts notarization when those are present, and
  it requires a real signature to begin with.
- **`.github/workflows/release.yml`** builds and publishes installers for all three
  platforms to a GitHub Release whenever a `v*` tag is pushed (or as an unpublished,
  downloadable workflow artifact via manual `workflow_dispatch`, for testing the
  workflow itself without cutting a real release).
- **What this means for end users, and what the auto-updater does/doesn't verify as a
  result** — see [SECURITY.md](../../SECURITY.md)'s "Release Integrity & Code Signing"
  section rather than duplicating that explanation here.

**Verification status**: the macOS `--dir` (unpacked) build was produced and inspected
directly on this machine — confirmed `MediaRemoteAdapter.framework` and
`better-sqlite3`'s `darwin-arm64` prebuild both survived asar-unpacking with correct
internal structure/symlinks, `Info.plist` correctly reflects `electron-builder.yml`'s
config (bundle ID, copyright, etc.), and `codesign -dv`/`spctl` confirm the ad-hoc
signing fix actually produces a well-formed, completely-sealed signature. **Not
verified**: whether the packaged `.app` actually opens a visible, working window on a
real desktop session — repeated attempts to launch it directly in this development
environment (which has no attached display — see "Status" below) exited immediately
with no output and no crash report, which given everything else checks out is most
likely this same "no display" limitation rather than a packaging defect, but that's
inference, not confirmation. Windows and Linux packaging were configured and reviewed
but not run at all in this environment (no Windows/Linux machine available); the
release workflow's Windows/Linux matrix jobs will be the first real signal on whether
those targets build cleanly.

## Auto-update

`apps/desktop` checks GitHub Releases for a newer version via `electron-updater`
(`main/updates/create-updater-client.ts` wraps its `autoUpdater` singleton behind a
small `UpdaterClient` interface for testability; `main/updates/wire-updates.ts` drives
the actual check/download/prompt lifecycle and the `shared/updates-api.ts` IPC
surface). Reads *where* to check from `app-update.yml`, generated at package time from
`electron-builder.yml`'s `publish: {provider: github, owner: Vaporjawn, repo:
Last-FM-Scrobbler}` block — this only actually resolves to anything once
`.github/workflows/release.yml` has published at least one real GitHub Release (see
"Packaging & distribution" above), so there's nothing to check against yet in this
repo.

- **When it checks**: once ~10 seconds after launch, then every 4 hours while running
  (a background/tray app can stay running for days — see "Background app" above) —
  both gated on `AppSettings.autoUpdateEnabled` (default on; toggle lives in
  Settings → General, next to a "Check for updates now" button that *always* works
  regardless of the toggle).
- **What happens when one's found**: `autoUpdater.autoDownload` is left `true`, so a
  detected update downloads automatically in the background — no separate "download
  this update?" prompt. Once the download finishes, a native `dialog.showMessageBox`
  (`main/updates/show-restart-prompt.ts`) asks "Restart Now" or "Later" — a native
  dialog rather than in-app UI on purpose, since this is a background app whose window
  is very often hidden and an in-app banner would go unseen. Choosing "Restart Now"
  calls `autoUpdater.quitAndInstall()`; choosing "Later" leaves the downloaded update
  in place to install automatically the next time the app quits and reopens.
- **Status visibility**: Settings → General also shows a live one-line status
  (checking/downloading progress percent/downloaded/error) sourced from the same
  `UpdateStatus` pushed to the renderer over IPC.
- **Platform coverage**: `mac`'s `zip` target and `win`'s `nsis` target are both
  required for electron-updater's platform backends (Squirrel.Mac / NSIS differential
  updates respectively) — both already configured (see "Packaging & distribution").
  Linux's `AppImage` target supports electron-updater's own update mechanism; the
  `deb` target doesn't (`.deb` users update via their distro's normal package-manager
  flow instead, same as most Linux-distributed Electron apps).
- **Not verified**: end-to-end, since it requires at least two real, code-signed
  published releases (an "old" and a "new" one) to actually exercise a check → download
  → install cycle — nothing this development environment can produce without real
  signing credentials and a real prior release to update *from*. The IPC
  wiring/state-machine/settings-gating logic is unit-tested (fake `UpdaterClient`
  event emitter — see `tests/main/updates/`), but the real `electron-updater` ↔
  GitHub Releases integration itself is not.

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

**This isn't `electron`-specific — it bit `electron-updater` too.** `create-updater-client.ts`
originally had `import { autoUpdater } from "electron-updater"`, which typechecks fine
(the package's `.d.ts` declares the named export) but crashed the entire main process
on launch with `SyntaxError: Named export 'autoUpdater' not found` — a full app-startup
failure, not a degraded feature, since it's a top-level import evaluated before
anything else runs. Same fix, same reason: `import electronUpdater from
"electron-updater"; const { autoUpdater } = electronUpdater;`. **Any CJS npm
dependency imported into `apps/desktop/src/main` or `src/preload` is a candidate for
this exact bug** — if you add one and use named-import syntax, don't just trust
`tsc`/unit tests (which mock these modules and never load the real thing); do an
actual `electron-vite build` + `electron-vite preview` launch with
`ELECTRON_ENABLE_LOGGING=1` (see below) before considering the integration done.

## A real gotcha found via live verification: sandboxed preload can't load an ESM preload script

`create-main-window.ts` sets `sandbox: false` in `webPreferences`, with a comment
explaining why — found via an actual runtime error report, not anticipated in advance.
Electron's default sandboxed preload loader (`sandbox: true`, the default since
Electron 20) runs preload scripts through a restricted loader that only understands
CommonJS. This project's `"type": "module"` makes electron-vite build the preload as
ESM (`out/preload/index.mjs`), which the sandboxed loader can't execute at all — it
fails with `SyntaxError: Cannot use import statement outside a module`, logged to the
renderer's DevTools console (**not** the main process's stdout/stderr, and not
something unit tests would ever surface, since they mock `"electron"` and never
actually load a real preload script).

The failure mode this produces is easy to misdiagnose: when the preload script can't
load, `contextBridge.exposeInMainWorld` never runs, so *every* `window.*` API
(`window.auth`, `window.settings`, `window.nowPlaying`, …) is silently `undefined` in
the renderer. Every hook here is written to degrade gracefully when its API is
missing (see each hook's docstring) — which is correct behavior for a component test,
but in a real broken-preload scenario it means the UI doesn't show an error, it just
quietly does nothing: Settings' Accounts section, for example, showed an endless
loading spinner rather than any indication of what had gone wrong (see `useAuth`'s
`refresh()`, which now also falls back to a non-loading state and surfaces `error` if
its initial IPC calls reject, precisely so a future instance of *any* IPC failure —
this one or otherwise — fails visibly instead of hanging forever).

`sandbox: false` here only affects what the *preload script itself* can access (it
gets a full Node environment instead of the restricted sandboxed one) — it does not
weaken `contextIsolation: true`/`nodeIntegration: false` above, which are what
actually keep the renderer's web content isolated from Node. Since the preload script
is first-party code we wrote (not remote/untrusted content), this is a standard,
low-risk tradeoff — the alternative (keeping the sandbox on and forcing electron-vite
to emit CommonJS for the preload build specifically) was not pursued here.

If you hit "Unable to load preload script" / "Cannot use import statement outside a
module" again after touching `electron.vite.config.ts` or `webPreferences`: check this
setting first, and check with `ELECTRON_ENABLE_LOGGING=1` (routes the renderer's
DevTools console into the terminal running `electron-vite preview`/`dev` — otherwise
these errors are only visible in an actual DevTools window) before assuming it's a new
bug.

## A real gotcha found via live verification: external links opened this app's own window, not the OS browser

`create-main-window.ts` calls `mainWindow.webContents.setWindowOpenHandler(...)`,
denying the request and handing the URL to `shell.openExternal` instead. Without it,
every `<a target="_blank">` in the renderer (the "Get your Last.fm API key" link, the
artist bio's "Read more on Last.fm" link, etc.) opened in a brand-new *Electron*
window — this app's own window, with none of the user's actual browser
logins/extensions/history — rather than their real default browser. `AuthFlow`'s own
browser step (`main/index.ts`'s `wireAuth({ openUrl: (url) => shell.openExternal(url)
})`) was never affected, since it already called `shell.openExternal` directly instead
of relying on a plain link — this only affected links rendered as ordinary JSX
`<Link>`/`<a>` elements. Found by actually clicking a link in the running app, not
from a typecheck or unit test (component tests never trigger real window-open
behavior). If you add a new external link anywhere in the renderer, it gets this
behavior for free — no per-link plumbing needed.

## A real gotcha found via live verification: the CSP silently blocked every real Last.fm image

`renderer/index.html`'s Content-Security-Policy meta tag had no `img-src` directive:
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`. Per the CSP
spec, `img-src` falls back to `default-src` when unset — `'self'` only — so every
`<img src="https://lastfm.freetls.fastly.net/...">` (real user avatars, real friend
avatars; see "Profile: real avatar photo" and "Friends: real avatars + activity"
below) was silently blocked at the browser level. "Silently" from the UI's point of
view, that is — the real symptom was reported as "not seeing any images" after the
avatar feature was built, tested (200+ passing tests), typechecked, linted, and
manually smoke-tested with a clean console on a cold launch. All of that passed
because none of it renders a real browser Content-Security-Policy the way an actual
Chromium renderer process does — component tests run in jsdom, which doesn't enforce
CSP at all. The bug only became visible by launching the *packaged/previewed* app for
real and reading its devtools/stdout console, which showed the exact violation:
```
Loading the image 'https://lastfm.freetls.fastly.net/i/u/300x300/...' violates the
following Content Security Policy directive: "default-src 'self'". Note that
'img-src' was not explicitly set, so 'default-src' is used as a fallback. The action
has been blocked.
```
Fixed by adding `img-src 'self' data: https://lastfm.freetls.fastly.net` explicitly.
`data:` covers inline/base64 image content; the explicit Last.fm CDN host (rather than
a blanket `https:`) keeps the policy no looser than it needs to be. **Lesson**: any
future feature that renders a remote URL (`<img>`, but the same reasoning would apply
to `<audio>`/`<video>`/`fetch()`/WebSocket/etc. sources) needs a live, real-Electron
console check before being considered actually verified — passing tests and a clean
first-glance console log are not sufficient proof that CSP allows it, because nothing
in this stack enforces CSP anywhere except a real Chromium renderer.

## IPC and renderer security model

Defense-in-depth around the main ↔ renderer boundary, layered on top of Electron's own
process-isolation primitives:

- **`webPreferences`** (`create-main-window.ts`): `contextIsolation: true`,
  `nodeIntegration: false` — the two settings that actually keep the renderer's web
  content isolated from Node.js. `sandbox: false` is a deliberate, documented exception
  to Electron's default (see "A real gotcha found via live verification: sandboxed
  preload can't load an ESM preload script" above) that affects only what the
  first-party preload script itself can access, not the renderer's isolation from Node.
- **Preload surface** (`preload/index.ts`): every API the renderer can call goes
  through `contextBridge.exposeInMainWorld` — nothing leaks a raw Node/Electron object
  into the renderer's `window`, and every event-subscription API returns a working
  unsubscribe function rather than leaking a listener that outlives its caller.
- **`assertTrustedSender`** (`main/validate-ipc-sender.ts`) — a guard every
  `ipcMain.handle` in the three highest-privilege handler modules
  (`auth/wire-auth.ts`, `auth/wire-secondary-auth.ts`, `lastfm/wire-track-actions.ts`)
  calls first, before doing anything else: throws unless the IPC call's `senderFrame`
  genuinely matches this app's own renderer. Not currently protecting against anything
  exploitable today — `contextIsolation` is on, `nodeIntegration` is off, and
  `create-main-window.ts`'s `setWindowOpenHandler` denies every attempt to open a new
  window/navigate elsewhere (see "external links" above), so untrusted content should
  never end up sharing this window's IPC surface in normal operation. Electron's own
  security checklist still lists sender validation as standard practice specifically
  for the regressions this guards against instead (a dependency accidentally loading
  remote content, a future feature adding an iframe). Deliberately **not** applied to
  read-only public Last.fm data (`wire-lastfm-data.ts`), settings, filter validation,
  or bug reporting — none of those handlers can mutate a signed-in user's account or
  exfiltrate a credential, and the bug-report relay is explicitly designed to be
  publicly reachable anyway (its own abuse protection lives in the relay itself — see
  `docs/modules/bug-report-relay.md`'s length limits and rate limiting).

  The one subtlety worth knowing if you touch this: every `file:` URL serializes to
  the literal origin string `"null"` per RFC 6454 (verified directly:
  `new URL("file:///a").origin === new URL("file:///b").origin === "null"`), so a naive
  `senderUrl.origin === expectedOrigin` compare would accept a call from *any* local
  file in a packaged build, not just this app's own `renderer/index.html` — silently
  defeating the whole point of the check. `resolve-expected-renderer-origin.ts`
  resolves a real `file:` URL (not the string `"null"`) as the expected origin
  specifically so `assertTrustedSender` can fall back to a full pathname compare for
  that case instead.
- **`openExternalIfSafe`** (`main/index.ts`) — `wireAuth`'s and `wireSecondaryAuth`'s
  `openUrl` callbacks (used to open the Last.fm/Libre.fm "authorize this app" page) are
  gated through `isSafeExternalUrl` before reaching `shell.openExternal`, matching
  every other `shell.openExternal` call site in this app (`create-main-window.ts`'s
  `setWindowOpenHandler` already gated the rest — see "external links" above). The
  auth-flow URL itself was traced and confirmed non-exploitable regardless (always a
  fixed, hardcoded Last.fm/Libre.fm host plus this build's own baked-in `api_key` plus
  an opaque token value the API just returned — never attacker- or renderer-influenced
  data), so this is regression-proofing against a *future* change to either call site,
  the same "defense-in-depth, not a response to a live vulnerability" framing
  `assertTrustedSender` itself uses.
- **Secrets on disk**: `ElectronSecretStorage` (Electron's `safeStorage`, OS
  keychain-backed — see "Login UX" above) treats a corrupt or unreadable secrets file
  (an interrupted write during a crash, disk corruption, manual tampering) as "nothing
  stored" rather than throwing out of every `get()`/`set()`/`delete()`/`list()` call
  from then on — the same fallback shape `main/settings/settings-store.ts` already used
  for a corrupt `settings.json`.
- **No `eval`/`new Function`/`child_process.exec`** anywhere in the main process. No
  `dangerouslySetInnerHTML`/`innerHTML` anywhere in the renderer. No credential value
  (`sessionKey`/`apiSecret`/`apiKey`/a ListenBrainz token) is ever passed to a
  `logger.*` call — verified by grep across every call site, not assumed.

## Responsive layout and window sizing

The window has a hard floor of `MIN_WINDOW_WIDTH = 680` / a matching minimum height
(`create-main-window.ts`), reconciled against whatever aspect ratio is currently
selected (`AppSettings.aspectRatio`: `"free" | "16:9" | "4:3" | "1:1" | "9:16" |
"9:14"` — the last two are portrait, width < height, see
`shared/settings-api.ts`'s `isPortraitAspectRatio`). Below that floor, individual UI
elements have to actively cooperate to avoid overflowing rather than shrinking, which
surfaced as widespread breakage the first time every view was checked systematically
at narrow widths:

- **Root cause**: `App.tsx`'s top-level `<Box component="main">` was missing
  `minWidth: 0`. CSS flexbox gives every flex item an implicit `min-width: auto`
  default, meaning a flex item never shrinks below its own content's intrinsic
  width — `overflow: "auto"` on its own does nothing about this, since overflow only
  controls what happens to content that doesn't fit, not whether the item itself is
  allowed to become narrower than that content in the first place. Because this was
  the single flex item wrapping the *entire* active page, any one unshrinkable element
  anywhere in the currently-rendered page's tree could force the whole app wider than
  the actual window — explaining why the symptom looked scattered across unrelated
  pages before the actual root cause was found. Fixed by adding `minWidth: 0` there;
  the same fix was independently needed on `PageHeader.tsx`'s title `Box` (next to its
  `action` slot) and `ProfilePage.tsx`'s username `Box` (next to the fixed-size
  account avatar).
- **The equivalent CSS Grid gotcha**: `FriendsPage.tsx`'s activity grid used
  `gridTemplateColumns: "${FRIEND_COLUMN_WIDTH}px 1fr"` — a bare `1fr` track is
  shorthand for `minmax(auto, 1fr)`, which has the identical "won't shrink below
  content" problem flexbox's default does. Fixed by spelling it out as
  `minmax(0, 1fr)`.
- **`flexWrap: "wrap"` over a second guessed breakpoint**: `SettingsRow.tsx`'s label +
  control row and the Libre.fm login row in `SettingsPage.tsx` both wrap onto a second
  line at narrow widths (`flexWrap: "wrap"`, `rowGap`) rather than switching layout at
  a hardcoded breakpoint — deliberately, to avoid the same "the breakpoint doesn't
  match the real available width" bug class a fixed `sm`/`md` cutoff can reintroduce
  later (an actual, previously-hit instance of that exact bug class in this codebase).
- **Last-resort clipping**: `FriendListItem.tsx`'s artist + timestamp-chip row has
  `overflow: "hidden"` as a genuine last resort for the true worst case (a long artist
  name plus a full-length timestamp chip at exactly the 680px floor) — everything above
  is a real shrink-to-fit fix; this one just guarantees a graceful clip rather than a
  layout break on the one combination none of the above alone can fully save.

**Sidebar auto-collapse in portrait mode** (`NavigationSidebar.tsx`): the sidebar
starts collapsed whenever the current aspect ratio is portrait (`"9:16"`/`"9:14"`) —
there's little enough horizontal room in that orientation that an expanded sidebar
competes directly with the content it's next to. Implemented with a
`hasSyncedInitialLoadRef` to distinguish two situations that need different behavior:
`useSettingsState` always renders with a synchronous, hardcoded-default `AppSettings`
first and only replaces it with the real persisted settings once an async
`window.settings.get()` resolves, so the *first* time real settings become available,
`collapsed` is synced to match the real aspect ratio in **either** direction (portrait
→ collapse, landscape/square → expand, correcting whatever the hardcoded default
guessed). After that initial sync, entering portrait later (a live Settings change)
still auto-collapses, but leaving portrait later never force-expands — a user who
manually re-opened the sidebar while in portrait keeps it open when they switch back to
landscape, respecting their explicit choice rather than overriding it every time the
aspect ratio changes.

## Now Playing: artist panel, love/tag

Now Playing shows a "Scrobbling from {app}" header (a small friendly-name lookup over
`TrackInfo.sourceApp`'s raw platform identifier — see
`renderer/src/utils/resolve-source-app-name.ts` — falling back to the raw value for
anything unrecognized), love/unlove and tag icon buttons next to the track info
(`LastfmClient.love`/`unlove`/`addTags`, signed as the active account via
`main/lastfm/wire-track-actions.ts` — reject with a clear error if no account is
logged in), and an artist panel below (bio summary, listener/play stats, and a
Similar Artists row, via `LastfmClient.getArtistInfo`/`getSimilarArtists` —
public/unsigned, so this works even logged out).

Two deliberate simplifications, not oversights:
- **No real artwork.** No adapter currently surfaces album art, and Last.fm's API
  mostly returns a generic placeholder image for artist photos now (a rights change
  from years ago) — so Now Playing/Scrobbles/the artist panel all use a styled
  initial-letter placeholder rather than fetching or faking a real image. Confirmed
  live, not just assumed — see `docs/modules/core.md`'s "Known limitation: artist
  images" section for the exact evidence (same placeholder image hash returned for
  every artist queried).
- **"Loved" is a local guess, not a fetched value.** There's no wired-up way to ask
  Last.fm "is the *current* track already loved by this user" (`track.getInfo` with a
  username would tell you, but isn't wired up) — the heart icon starts unloved for
  every new track and only reflects clicks made this session (see
  `renderer/src/hooks/use-track-actions.ts`).

## Profile: real avatar photo

Unlike artist images (above), a user's own Last.fm avatar *is* a real, working photo —
confirmed live against the real API for an account with one set, returning a genuine
~190KB image, not a placeholder (see `docs/modules/core.md`). `ProfilePage`'s account
card renders it via `LastfmClient.getUserInfo` → `main/lastfm/wire-lastfm-data.ts` →
`renderer/src/hooks/use-user-profile.ts` → MUI's `Avatar` with a `src` prop. No manual
fallback logic is needed on the "no photo set" or "fetch failed" paths: `avatarUrl` is
simply `undefined` in both cases (`UserProfile.avatarUrl`'s docstring explains why —
Last.fm returns an empty `#text` for every image size rather than omitting the field),
and MUI's `Avatar` already renders its children (the account's first-initial letter,
same as before this feature existed) whenever `src` is `undefined`, and self-heals to
that same fallback if a real `src` fails to load client-side. Top Artists on the same
page intentionally still use letter avatars — see the artist-images limitation above.

## Friends: real avatars + activity

`FriendsPage` renders each friend via `components/FriendListItem.tsx`:
- **Avatar** — `Friend.avatarUrl`, straight from `LastfmClient.getFriends`'s existing
  `user.getFriends` call. No extra per-friend request needed for this part: unlike
  `ProfilePage`'s avatar (a separate `getUserInfo` call), `user.getFriends`' response
  already includes each friend's own `image` array directly (verified live) — same
  `pickLargestImageUrl` picking/fallback logic as `UserProfile.avatarUrl`.
- **Activity** — a "Scrobbling now" chip + track/artist (currently playing), or the
  track/artist with a plain timestamp (most recent past scrobble), or nothing at all
  (no scrobble history, the fetch failed, or it just hasn't resolved yet). This *does*
  need a separate call per friend — `renderer/src/hooks/use-friend-activity.ts` calls
  `getRecentTracks(username, 1)` — since Last.fm has no bulk "recent tracks for these N
  users" endpoint. Each row fetches and fails independently (`Promise` per row, not a
  single `Promise.all` gating the whole list), so one friend's empty/failing history
  never blocks or blanks out the rest of the list; failures are deliberately swallowed
  into the same "show nothing" state as "no history" rather than surfacing a per-row
  error message next to someone's name.

Same CSP fix as Profile above applies here too (see "the CSP silently blocked every
real Last.fm image") — both features were built together, and both were affected by
the same missing `img-src` directive.

**Known scaling consideration, not yet addressed**: activity is fetched with one
`getRecentTracks` call per friend, all fired in parallel as soon as the friend list
loads (each `FriendListItem` mounts its own `useFriendActivity`). For an account with
a large friend list (spot-checked against a real account with 117 friends — see
`docs/modules/core.md`), that's 117 simultaneous unsigned API requests on every
Friends page visit. Last.fm's API has generally tolerated this in ad-hoc testing, but
there's no batching, staggering, throttling, or caching between visits — if this turns
out to be a real problem in practice (rate-limit errors, a slow/janky page load for
accounts with hundreds of friends), the fix would be either windowed/staggered
fetching (e.g. N at a time via a small concurrency limiter) or fetching activity only
for friends actually scrolled into view, not a redesign of the underlying approach.

## Snackbars (in-app transient feedback)

`renderer/src/contexts/SnackbarProvider.tsx` + `snackbar-context.ts` — a small,
self-contained MUI `Snackbar`/`Alert`-based toast system, mounted once in `App.tsx`
(inside `ThemeProvider`, wrapping everything else) so any page/component can call
`useSnackbar().notify({ message, severity?, action?, autoHideDurationMs? })`.
Messages queue one at a time (MUI's own documented pattern for consecutive
snackbars — a new message waits behind the current one rather than replacing or
stacking on top of it); errors stay up longer by default (8s vs. 4s) since they're
more worth actually reading than a routine success confirmation. `useSnackbar()`
returns a harmless no-op `notify` — never throws — when no `SnackbarProvider` is an
ancestor, matching this codebase's established `useAuth`/`useSettings`/etc.
"degrade gracefully outside its normal mounting context" convention (so existing
component tests don't all need to be wrapped in a new provider just to render).

**Where it's wired in** (see `renderer/src/hooks/action-result.ts`'s `ActionResult`
type — every hook action below returns `{success: true} | {success: false, error}`
rather than a plain boolean specifically so a caller can react to the *exact* outcome
immediately, without racing a stale closure over the hook's own `error` state — see
that file's docstring for why that race is real):
- **Now Playing**: love/unlove and add-tags success/failure (`NowPlayingPage.tsx`) —
  previously *zero* user-visible feedback for either (success was invisible, errors
  were caught but never rendered anywhere) — the single biggest UI feedback gap found
  when surveying the app for this.
- **Settings**: login success/failure, log out, switch active account, save/clear
  a user-supplied API key (with a longer-lived "Restart now" action button snackbar,
  replacing what used to be a persistent inline `Alert`), a `closeToTray`/
  `autoUpdateEnabled` toggle failing to persist, and "Check for updates now" (fires
  regardless of outcome — the inline status line already shows checking/downloading
  progress, so this is specifically about acknowledging the button click itself).
- Deliberately **not** wired into Scrobbles/Profile/Friends' page-load errors (already
  adequately shown as persistent inline text — an ongoing "this page has no data"
  state, not a one-shot action outcome) or `BugReportDialog` (the dialog itself is
  already the confirmation surface, staying open to show the created issue's URL).

## Native notifications (OS-level, background-relevant events)

`main/notifications/show-notification.ts` wraps Electron's `Notification` API (not
`dialog.showMessageBox`'s blocking modal — see `main/updates/show-restart-prompt.ts`
for that, used instead when an actual decision needs collecting). No-ops (doesn't
throw) when `Notification.isSupported()` is false — e.g. a Linux desktop with no
notification daemon running, same category of environment-dependent caveat this
project already applies to `safeStorage`'s keyring dependency.

This is specifically for events that happen **unattended**, often with the main
window hidden (see "Background app" above) — snackbars only make sense with the
window open, so anything that can legitimately happen while it's hidden needs a
different mechanism:
- **A scrobble is submitted successfully** (`wire-scrobbling.ts`'s new `onScrobbled`
  callback, wired in `main/index.ts`) — "Scrobbled: {track} — {artist}", or "…and N
  more" for a multi-item batch (catching up after being offline). This was previously
  the single biggest *silent* background gap in the whole app — no feedback of any
  kind, not even a log line, for the app's core purpose succeeding.
- **Scrobble submission keeps failing** (`onScrobbleFailed`) — but only once it's
  failed **3 consecutive** drain cycles in a row, not on every single retry (which
  would spam a notification every `drainIntervalMs` — 60s by default — for as long as
  an outage lasts); resets back to zero the moment a batch reaches Last.fm again.
- **The window is hidden-to-tray for the first time** this install has ever done that
  (see "Background app" above) — a one-time "Still running in the tray/menu bar"
  explainer, tracked via `AppSettings.hasShownTrayHint` so it never repeats.
- **An update is found** (`wire-updates.ts`'s `onUpdateAvailable`) — purely
  informational (the download already starts automatically in the background; see
  "Auto-update" above), and **a background update check fails**
  (`onUpdateCheckFailed`) — not throttled the way scrobbling's equivalent is, since
  checks only run every few hours here, inherently far less frequent than a
  scrobble-queue retry loop.
- **Login succeeds** — see "Login UX" above for the full two-mechanism story
  (`bringAppToForeground()` plus this notification, fired alongside rather than
  instead of it, since forced focus-stealing isn't guaranteed to actually work on
  every OS/window-manager combination).
- Deliberately **not** used for: bug-report submission (always window-open,
  dialog-confirmed already, no hidden-window scenario to cover) and per-track-change
  events (far too frequent/noisy — every song, all day — see `wire-now-playing.ts`).

**Not verified**: whether `Notification` actually displays correctly in a packaged
build on any real OS — same "no attached display in this environment" limitation
already noted throughout "Packaging & distribution" and "Status" below. The
IPC-free, callback-based wiring itself (which hook fires which notification, with
what content, under what conditions) is unit-tested with a fake `Notification`
constructor (`tests/main/notifications/show-notification.test.ts` and the relevant
`onScrobbled`/`onScrobbleFailed`/`onHide`/`onUpdateAvailable`/`onUpdateCheckFailed`
cases in each module's own test file) — the real OS-level rendering isn't.

## Not yet built (real feature work, tracked here so it isn't lost)
- "Launch at login" (the tray/menu-bar background-app behavior itself is built — see
  above; auto-*update* is also built — see "Auto-update" above — this is specifically
  about auto-*starting* on OS boot/login, a different feature).
- *Automatic* crash reporting — an opt-in reporter that auto-fills the bug-report
  dialog (or reports silently) on an unhandled exception/crash. The manual "Report a
  Bug" button/dialog is built (see "Bug reporting" above); wiring it to fire
  automatically on a crash is not.
- i18n / language selection.
- Scrobbling settings UI (enable/disable, exclusion filter expression editor for
  `packages/core`'s filter DSL) — the pipeline honors a `CompiledFilter` if the
  `Tracker` is constructed with one, but there's no UI yet to author one.
- Custom, original application icon artwork — the app now has a real, working icon
  (see "App icon" above), just one derived from Last.fm's own branding rather than
  bespoke artwork commissioned for this project specifically; not a functional gap,
  just a possible future polish item.

## Dependencies

`react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`,
`@emotion/styled`, `electron`, `electron-vite`, `electron-builder`,
`electron-updater`, `cross-env`, `@lastfm-scrobbler/shared-types`,
`@lastfm-scrobbler/core`, and all three platform adapters
(`@lastfm-scrobbler/adapter-{macos,linux,windows}`).

## Status

All five views are real (not placeholders) and visually distinct from bare placeholder
text — Card/Paper layouts, icons, and rank/progress styling rather than plain lists:
Now Playing, Scrobbles, Profile, and Friends render live data once logged in (or a
clear "log in on Settings" prompt when not); Settings has General (background-app
behavior) and Accounts tabs; bug reporting is wired end to end. Main-process wiring
(playback source selection, now-playing IPC, auth IPC, read-only Last.fm data IPC,
scrobble queue + submission, bug-report relay, settings persistence, tray/close-to-tray)
is complete and unit-tested (196 tests: secret storage, account store and
app-credentials store construction, auth IPC (including bring-your-own-key
save/clear/relaunch), the env-vs-user-supplied credential resolver, read-only Last.fm
data IPC (including artist info/similar artists), signed track actions
(love/unlove/addTags), scrobbling queue/submission logic (including the
`onScrobbled`/`onScrobbleFailed` native-notification hooks and their 3-consecutive-
failure throttling) against a real in-memory `ScrobbleQueue`, bug-report IPC, settings
persistence, close-to-tray window interception (including its `onHide` callback), the
auto-updater's IPC/state-machine/scheduling/notification logic against a fake
`UpdaterClient` event emitter, `showNotification`'s wrapping of a faked `Notification`
constructor, and renderer component behavior via Testing Library with faked
`window.*` APIs (including the `SnackbarProvider` queue itself, and every page's
snackbar-firing wiring) — exact count will drift as work continues; treat it as
"extensively tested," not a precise live figure). Packaging itself
(`electron-builder`) is verified separately, by directly inspecting a real locally-built
macOS app bundle rather than a unit test — see "Packaging & distribution" above for
exactly what that did and didn't confirm.

Live-verified end to end on this machine multiple times as features were added
(most recently after the Now Playing artist panel/love/tag work): the production build
(`electron-vite build` + `electron-vite preview`) launches a real, stable multi-process
Electron app (main/GPU/network/renderer processes all present, matching Electron's
normal architecture) with no startup errors. Earlier runs additionally confirmed
`createPlatformPlaybackSource()` genuinely spawns `packages/adapter-macos`'s real
`mediaremote-adapter.pl` child process as part of normal app startup on this machine —
end-to-end proof the adapter is correctly wired into the running app, not just
independently tested. Not verified: actual on-screen rendering content (this
development environment has no attached display, so screenshots aren't possible —
verification stopped at "the process tree is healthy, the build compiles cleanly, and
nothing crashed on launch"), whether the tray icon actually renders/behaves correctly
on a real desktop session, and the full login → scrobble round trip against the real
Last.fm API, or a real bug-report submission against a deployed relay (no Last.fm API
credentials, Cloudflare account, or deployed relay URL were available in this
environment).
