#!/usr/bin/env node
// Wraps `electron-builder` so a plain `npm run package` (no signing credentials in the
// environment) still produces a *launchable* macOS build. electron-builder's own
// default behavior when no valid signing identity is found is to skip signing
// entirely (confirmed empirically: `codesign -dv` on that output showed Electron's own
// original pre-existing signature untouched, `Sealed Resources=none`) — but every
// executable on Apple Silicon needs *some* valid signature to run at all, ad hoc or
// not, or the kernel refuses to launch it with no error message. Forcing
// `--config.mac.identity=-` (codesign's own "ad hoc" token) makes electron-builder
// sign the fully-assembled bundle after packaging, which is enough to run locally
// (though it still won't pass Gatekeeper's "identified developer" check without a real
// Developer ID certificate and notarization — see docs/modules/desktop.md).
//
// When a real certificate IS configured (`CSC_LINK` set — see the release workflow),
// this does nothing extra: electron-builder uses the real identity as normal, and
// real, Developer-ID-signed + notarized builds don't need the ad-hoc fallback.
import { spawnSync } from "node:child_process";

const hasRealCertificate = Boolean(process.env.CSC_LINK);
const extraArgs = hasRealCertificate ? [] : ["--config.mac.identity=-"];

const result = spawnSync("electron-builder", [...extraArgs, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
