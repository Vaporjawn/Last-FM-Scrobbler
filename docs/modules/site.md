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

## SEO assets

The `<head>` carries a full set of search/social metadata, deliberately kept in this
one hand-written `index.html` rather than generated — there's no build step to
generate it with (see "Not a workspace package" below):

- **Standard meta**: `description`, `keywords`, `author`, `robots` (`index, follow`),
  and a `canonical` link pointing at the production URL — guards against the
  `vaporjawn.github.io/...` GitHub Pages default URL (see "Deployment" above) ever
  being indexed as a separate, duplicate page from the real `vaporjawn.dev` one.
- **Open Graph + Twitter Card**: `og:*`/`twitter:*` tags for link-unfurling on
  Discord/Slack/social platforms, pointing at `og-image.png` (1200×630 — the
  standard link-preview aspect ratio; both `og:image` and `twitter:image` must be
  **absolute** URLs per spec, not resolved relative to the page). Generated with
  ImageMagick (`magick -size 1200x630 xc:"#0f1115" ...`, composited from `favicon.png`
  plus text in Helvetica Neue) to match this page's own dark-hero/red-accent palette
  (`styles.css`'s `--bg-hero`/`--accent` custom properties) rather than looking like a
  generic auto-generated card. Regenerate by re-running the same composition (see git
  history for the exact `magick` invocation) if the tagline or palette ever changes.
- **JSON-LD structured data** (`application/ld+json`, `schema.org/SoftwareApplication`)
  — lets a search engine show this as an app result (platforms, price, license) rather
  than a generic webpage snippet. `softwareVersion` is deliberately omitted: there's no
  tagged release yet (see the Status section in `index.html` itself), and structured
  data is expected to reflect something real, not a placeholder — add it once
  `.github/workflows/release.yml` has actually published a `v*` tag.
- **Icons**: `favicon.png` (512×512, also `apps/desktop/build/icon.png` — see
  docs/modules/desktop.md's "App icon"), `favicon.ico` (16/32/48 multi-resolution, for
  the handful of contexts that still request `/favicon.ico` directly rather than
  reading the declared `<link rel="icon">`), and `apple-touch-icon.png` (180×180,
  flattened onto a white background rather than keeping transparency — iOS applies its
  own corner-rounding mask on top, and a transparent PNG's uncovered corners can render
  oddly against an arbitrary Home Screen wallpaper). All three generated from the same
  source square via `magick favicon.png -resize ...`, not independently drawn.
- **`theme-color`**: separate light/dark values via `prefers-color-scheme` media
  queries, matching `styles.css`'s own light/dark `--bg` values (not `--bg-hero` — this
  is the browser-chrome color for the page generally, not just the top hero band).
- **`robots.txt`** / **`sitemap.xml`**: a plain allow-all robots file pointing at the
  sitemap, and a single-URL sitemap (this is a one-page site — there's nothing else to
  list). Update `sitemap.xml`'s `lastmod` when the page's actual content next changes
  meaningfully, not on every unrelated commit.

**Not automated by this repo**: the GitHub repository's own **social preview image**
(shown when a bare `https://github.com/Vaporjawn/Last-FM-Scrobbler` link is
shared — distinct from this page's Open Graph tags above, which only apply to the
`vaporjawn.dev` URL) has no public REST API for setting it as of this writing; it's a
manual upload at
https://github.com/Vaporjawn/Last-FM-Scrobbler/settings — "Social preview". Use
`og-image.png` from this directory for that upload, so both surfaces show the same
card.

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
