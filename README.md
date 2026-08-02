# Last.fm Scrobbler

[![CI](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/ci.yml/badge.svg)](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/codeql.yml/badge.svg)](https://github.com/Vaporjawn/Last-FM-Scrobbler/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A native, cross-platform Last.fm scrobbler for macOS, Windows, and Linux. Unlike
player-specific plugins, this app reads "now playing" directly from each OS's native
media-session API — MPRIS2 on Linux, SMTC on Windows, MediaRemote on macOS — so it works
with whatever you're already using to play music, with no per-player integration
required.

## Status

Early scaffolding — no tagged releases or downloads yet. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design and [docs/adr/](docs/adr/)
for the reasoning behind the major decisions, or the
[project website](https://vaporjawn.dev/Last-FM-Scrobbler/) for a lighter-weight overview.

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
