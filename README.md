<div align="center">

# 🎧 Last.fm Scrobbler

**A native, cross-platform Last.fm scrobbler for macOS, Windows, and Linux**

[![CI](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/ci.yml/badge.svg)](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/codeql.yml/badge.svg)](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows11&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-191970?style=flat&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

</div>

Unlike player-specific plugins, this app reads "now playing" directly from each OS's
native media-session API — MPRIS2 on Linux, SMTC on Windows, MediaRemote on macOS — so
it works with whatever you're already using to play music, with no per-player
integration required.

## Contents

- [Features](#features)
- [Status](#status)
- [Quick start](#quick-start)
- [Packages](#packages)
- [Community and support](#community-and-support)
- [License](#license)

## Features

#### 🎵 See what's playing, wherever you are

- **Reads "now playing" natively** — MPRIS2 (Linux), SMTC (Windows), MediaRemote
  (macOS) — works with whatever's already playing, no per-player plugin required.
- **Now Playing** — live current-track view with real-time scrobble-threshold progress.
- **Offline-safe scrobbling** — an on-disk queue means scrobbles are never lost to a
  dropped connection; they submit automatically once Last.fm is reachable again.

#### 📈 Explore your history

- **Scrobble history** — full history list, click through to a detail page (art,
  listener/play stats, your own play count) for any scrobble.
- **Profile** — account stats and Top Artists This Week, in either a list or tile view.

#### 👥 See what friends are playing

- **Activity feed** — what everyone's playing right now, with real avatars,
  self-reported locations, and a Last.fm Pro badge.
- Click through to a friend's own profile or their currently-playing track.

#### ⚙️ Make it yours

- **Dark/light mode** — switches live, no restart.
- A resizable-window aspect-ratio lock.
- Runs in the background via the tray/menu bar, with an optional mini-player popover.
- **Launch at login**, and reset everything to defaults in one click.

#### 🛠️ Built to be trusted

- **Bring your own Last.fm API key**, or use one baked into the build — your choice.
- **In-app bug reporting** — files a GitHub issue directly, anonymously, no account
  needed.
- **Auto-updates** in the background, with a prompt before installing.

## Status

Feature-complete, pre-release — no tagged releases or downloads yet, but every planned
piece above is implemented and tested, and packaging (`electron-builder`, all three
platforms) plus a GitHub Actions release workflow are built too. See each package's
linked doc below for exactly what's live-verified versus code-complete-but-unverified
in this environment (mainly: real Windows/Linux hardware, a real code-signing
certificate, and a real Cloudflare deployment, none of which were available during
development). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design and
[docs/adr/](docs/adr/) for the reasoning behind the major decisions, or the
[project website](https://vaporjawn.dev/Last-FM-Scrobbler/) for a lighter-weight
overview.

Still needed before a first _real_ tagged release: pushing a `v*` tag to actually run
[the release workflow](.github/workflows/release.yml) for the first time, a real code
signing certificate + Apple notarization credentials for a properly signed/notarized
build (see [docs/modules/desktop.md](docs/modules/desktop.md)'s "Packaging &
distribution" section — unsigned builds work locally but won't pass Gatekeeper/
SmartScreen for other people), and deploying
[`services/bug-report-relay`](docs/modules/bug-report-relay.md) (now automated via
[a workflow](.github/workflows/deploy-bug-report-relay.yml) — just needs Cloudflare
secrets configured once). None of this project's own credentials are ever included —
see each linked doc for exactly what to supply yourself.

## Quick start

Package-manager agnostic — use whichever you already have. All three are tested in CI.

```bash
# pnpm
corepack enable && pnpm install && pnpm build && pnpm test

# npm
npm install && npm run build && npm run test

# bun
bun install && bun run build && bun run test
```

See [docs/adr/0007-package-manager-agnostic.md](docs/adr/0007-package-manager-agnostic.md)
for how this works, and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full
contributor guide.

## Packages

| Package                                                         | Responsibility                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`packages/core`](docs/modules/core.md)                         | Scrobbling engine — rules, offline queue, Last.fm API client, auth, filters, logging |
| [`packages/shared-types`](docs/modules/shared-types.md)         | Shared types and the `PlaybackSource` interface                                      |
| [`packages/adapter-linux`](docs/modules/adapter-linux.md)       | MPRIS2 (D-Bus) playback source                                                       |
| [`packages/adapter-windows`](docs/modules/adapter-windows.md)   | SMTC playback source                                                                 |
| [`packages/adapter-macos`](docs/modules/adapter-macos.md)       | MediaRemote playback source                                                          |
| [`apps/desktop`](docs/modules/desktop.md)                       | Electron + React + MUI desktop app                                                   |
| [`apps/site`](docs/modules/site.md)                             | Public landing page, deployed to GitHub Pages                                        |
| [`services/bug-report-relay`](docs/modules/bug-report-relay.md) | Anonymous bug-report → GitHub issue relay                                            |

## Community and support

- [Wiki](https://github.com/Vaporjawn/Last-FM-Scrobbler/wiki) — architecture overview and
  getting-started guide, outside the versioned repo docs
- [Discussions](https://github.com/Vaporjawn/Last-FM-Scrobbler/discussions) — questions,
  ideas, and show-and-tell
- [Issues](https://github.com/Vaporjawn/Last-FM-Scrobbler/issues) — bug reports and feature
  requests (see the [issue templates](https://github.com/Vaporjawn/Last-FM-Scrobbler/issues/new/choose))
- [Contributing guide](docs/CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md) — please report vulnerabilities privately, not as a public issue
- [Contributors](CONTRIBUTORS.md)

## License

MIT — see [LICENSE](LICENSE). Copyright &copy; [Victor Williams](https://github.com/Vaporjawn).
