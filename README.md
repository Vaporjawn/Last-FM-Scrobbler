# Last.fm Scrobbler

A native, cross-platform Last.fm scrobbler for macOS, Windows, and Linux. Unlike
player-specific plugins (e.g. [foo_scrobbler_mac](https://github.com/zfoxer/foo_scrobbler_mac)),
this app reads "now playing" directly from each OS's native media-session API — MPRIS2 on
Linux, SMTC on Windows, MediaRemote on macOS — so it works with whatever you're already
using to play music, with no per-player integration required.

## Status

Early scaffolding. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design
and [docs/adr/](docs/adr/) for the reasoning behind the major decisions.

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

## License

MIT — see [LICENSE](LICENSE).
