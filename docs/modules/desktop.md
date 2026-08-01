# `apps/desktop`

## Responsibility

Electron + React + MUI desktop shell. Five destinations: Now Playing (art, artist bio,
similar artists, love/tag actions), Scrobbles (history), Profile (top-artist charts),
Friends (friends' currently-scrobbling tracks), and Preferences (General, Accounts,
Scrobbling, Advanced).

## Not yet built (real feature work, tracked here so it isn't lost)

- Real data wiring for all five views (currently placeholder pages) — depends on
  `packages/core` and the OS adapters being implemented first.
- Tray icon and "launch at login with media players".
- Auto-update (`electron-updater`).
- Crash reporting (tie into `services/bug-report-relay` as an opt-in automatic
  reporter).
- i18n / language selection.
- Code signing and notarization for distribution.
- Last.fm session-key storage via Electron's `safeStorage`. Note for whoever builds
  this: `safeStorage` depends on a system keyring (libsecret/gnome-keyring/kwallet) on
  Linux, which minimal window-manager setups often lack — if it's unavailable, the app
  must surface an explicit warning rather than silently falling back to weaker storage.

## Dependencies

`react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`,
`@emotion/styled`, `electron`, `electron-vite`. Does not yet depend on
`@lastfm-scrobbler/shared-types` — nothing in the current scaffold uses it; it becomes a
real dependency once a view starts consuming `TrackInfo`/`PlaybackSource` data.

## Status

Scaffolded: a running Electron window with an MUI-themed sidebar and five placeholder
pages, and one component test for the navigation sidebar.
