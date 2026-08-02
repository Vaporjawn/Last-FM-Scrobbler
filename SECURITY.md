# Security Policy

## Supported Versions

This project is pre-1.0 early scaffolding (see [README.md](README.md#status)) with no tagged
releases yet. Only the `main` branch is supported — please make sure you're on the latest commit
before reporting an issue.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately using one of these channels:

1. **Preferred**: [GitHub Security Advisories](https://github.com/Vaporjawn/Last-FM-Scrobbler/security/advisories/new)
   for this repository — this lets us discuss and fix the issue privately before disclosure.
2. **Email**: [victor.williams.dev@gmail.com](mailto:victor.williams.dev@gmail.com) with a description of the
   vulnerability, steps to reproduce, and its potential impact.

You should expect an initial response within 5 business days. This is a hobby/personal project
maintained outside of full-time work, so please be patient — every report is taken seriously and
will be acknowledged.

## Scope

Areas of particular interest for security review, given this project's design (see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- **Credential storage**: Last.fm session keys are stored via Electron's `safeStorage`, which
  depends on the OS keyring (Keychain / DPAPI / libsecret-gnome-keyring-kwallet). Issues with how
  or where credentials are persisted are in scope.
- **Electron security posture**: `contextIsolation`, `nodeIntegration`, preload script
  boundaries, and any remote content loading in `apps/desktop`.
- **The bug-report relay** (`services/bug-report-relay`): validation of untrusted, anonymous
  request bodies before they reach the GitHub Issues API. Known, tracked issue: the
  relay's `GITHUB_PAT` is currently a classic, `public_repo`-scoped token rather than
  the fine-grained, repo-scoped one originally planned — broader than necessary; see
  [issue #10](https://github.com/Vaporjawn/Last-FM-Scrobbler/issues/10).
- **Last.fm API usage**: anything that could leak a user's API key, session key, or scrobble
  history to an unintended party.

## Release Integrity & Code Signing

**Current status (verify against [docs/modules/desktop.md](docs/modules/desktop.md)'s
"Packaging & distribution" section for anything more recent):**

- **macOS**: ad-hoc signed (`codesign --sign -`, no real Apple Developer identity)
  whenever this repo's maintainer hasn't configured a real certificate. This is enough
  for the app to launch at all on Apple Silicon (unsigned binaries are killed outright
  by the kernel's code-integrity enforcement, with no error shown), but it is **not**
  enough to satisfy Gatekeeper's "identified developer" check — expect a Gatekeeper
  warning on a downloaded release unless the maintainer has configured
  `CSC_LINK`/notarization credentials for that specific build.
- **Windows / Linux**: unsigned by default for the same reason — this project never
  bakes in real signing certificates (same reasoning as not baking in a real Last.fm
  API key; see the main README). `CSC_IDENTITY_AUTO_DISCOVERY=false` is set even in
  the "real" release packaging scripts, so a build never silently picks up a signing
  identity from whatever happens to be installed on the machine that built it.
- **Fully signed + notarized builds are wired but inert without credentials** — if the
  maintainer sets `CSC_LINK`/`CSC_KEY_PASSWORD` (or `WIN_CSC_LINK`/
  `WIN_CSC_KEY_PASSWORD`) and, for macOS notarization,
  `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`, `electron-builder`/
  `@electron/notarize` sign and notarize for real. Whether a given published release
  actually has these depends entirely on whether the maintainer configured them for
  that release — there is no way to tell from the release alone without checking
  (`codesign -dv --verbose=4 "Last.fm Scrobbler.app"` and `spctl -a -vv "Last.fm
Scrobbler.app"` on macOS; Windows' file Properties → Digital Signatures tab).

**What the auto-updater checks today, with or without signing**: this app's
auto-updater (`electron-updater`, wrapped in `main/updates/create-updater-client.ts`)
verifies the SHA512 checksum of every downloaded update against the value published in
that release's `latest.yml`/`latest-mac.yml`/`latest-linux.yml` metadata file before
installing it — this is `electron-updater`'s own default behavior and isn't disabled
or bypassed anywhere in this codebase (verified directly against `electron-updater`
6.8.9's own source, not just its docs: the SHA512 comparison lives in its
`builder-util-runtime` dependency's `httpExecutor.js`, and throws
`ERR_CHECKSUM_MISMATCH` on any mismatch). That check protects against corruption or
tampering **in transit** (a partial download, a proxy that mangles bytes). It is
**not** the same guarantee as code signing: the checksum only confirms the downloaded
file matches what the release's own metadata says it should be, not that a trusted
publisher produced either of them. If someone were able to modify a published release
directly — for example via a compromised GitHub Actions token or a compromised
maintainer account — they could replace both the installer and its checksum together,
and this check would still pass.

On Windows specifically, `electron-updater` also _has_ a separate Authenticode
signature check (`NsisUpdater`'s `verifySignature`, comparing against a publisher name
recorded in `app-update.yml` at package time) — but it's a silent no-op, not an error,
when that publisher name isn't present, which is exactly the unsigned-by-default case
described above. So today, on every platform, it reduces to the same SHA512-only
guarantee; this would only start doing something extra on Windows if the maintainer
configures a real signing certificate for that platform specifically.

**If you want stronger assurance than the above for a specific release**, especially
one you can independently confirm is signed and notarized (see the per-platform
verification commands above), that signature is the real trust anchor; absent that,
independently compare the published `latest.yml`'s `sha512` field against a hash you
compute yourself from the downloaded installer (`shasum -a 512` on macOS/Linux,
`Get-FileHash -Algorithm SHA512` in PowerShell on Windows) as a sanity check against a
corrupted or incompletely-mirrored download — keeping in mind this only rules out
transit corruption, not a compromised release itself, for the reason explained above.

## Disclosure

Once a fix is available, we'll coordinate a disclosure timeline with the reporter and credit them
in the fix (unless they prefer to remain anonymous).
