# `apps/site`

## Responsibility

The project's public landing page — a plain, hand-written static HTML/CSS pair (no
framework, no build step, no `package.json`). Covers the whole monorepo (feature
overview, package table, project status, links to get involved), not just one app or
package; it's a sibling of `apps/desktop`, not part of it, despite reusing that app's
icon as its favicon (see docs/modules/desktop.md's "App icon" section).

## Deployment

`.github/workflows/pages.yml` deploys this directory to GitHub Pages automatically —
on every push to `main` that touches `apps/site/**`, or manually via that workflow's
"Run workflow" button. No secrets or configuration needed; it just uploads the
directory as-is via `actions/upload-pages-artifact` and publishes it via
`actions/deploy-pages`.

Live at https://vaporjawn.dev/Last-FM-Scrobbler/ — a custom domain. GitHub
automatically redirects the default `vaporjawn.github.io/Last-FM-Scrobbler/` URL there
once a custom domain is configured for this repo's Pages site (confirmed live via
curl: the `github.io` URL 301s to `vaporjawn.dev`). That configuration lives in the
repo's GitHub Pages settings, not as a `CNAME` file in this directory — there isn't
one, and none is needed.

## Referenced from

- The repo's own "Website" field, shown in the GitHub UI sidebar (`gh repo view --json
  homepageUrl` confirms it's already set to the URL above).
- The root [README.md](../../README.md)'s "Status" section.

## Local preview

No install, no build step:

```bash
cd apps/site && python3 -m http.server
```

Then open the printed URL (any other static file server works too).

## Not a workspace package

`apps/site` intentionally has no `package.json`, even though it sits under the
`apps/*` glob both `package.json`'s `workspaces` field and `pnpm-workspace.yaml`
match — verified this doesn't break workspace resolution for either npm or pnpm
(`npm pkg get name --workspaces` / `pnpm list -r`), both of which silently skip a
matched directory that has no manifest rather than erroring.

## Status

Content kept in sync with the project's actual current state by hand — no automated
check enforces this, so if a future session finds it's drifted stale again (as it was
once already — see git history), that's worth fixing the same way: update the feature
list and status framing to match what's actually true, not what an early version of
the project used to say.
