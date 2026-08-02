import { createTheme, type Theme } from "@mui/material/styles";
import type { ThemeMode } from "../../../shared/settings-api.js";

// MUI's dark-mode default sets `background.default` and `background.paper` to the
// *same* `#121212`, leaning entirely on elevation shadows/overlays to separate
// surfaces — a difference that's easy to miss, especially on `Paper
// variant="outlined"` (used in ScrobblesPage/FriendsPage), which skips the elevation
// overlay entirely and relies on nothing but a hairline border. Giving `default`/
// `paper` two genuinely different, warm-neutral (not cold grey) tones — in both
// modes, just at opposite ends of the lightness scale — means every Paper/Card/
// Dialog/Popover surface visibly lifts off the page on its own, independent of
// elevation.
const DARK_BACKGROUND = { default: "#0f0c0b", paper: "#1c1714" };
// A warm off-white default with a pure-white paper lifting off it — the light-mode
// mirror of the dark pairing above, same reasoning: two genuinely different tones,
// warm rather than the cold grey a "just flip the dark palette" light mode tends to
// produce.
const LIGHT_BACKGROUND = { default: "#faf8f5", paper: "#ffffff" };

/**
 * Builds this app's theme for a given mode — see `AppSettings.themeMode` (Settings →
 * General) for how a user's choice reaches this. Both light and dark are genuinely
 * considered palettes, not one derived by MUI's automatic light/dark inversion from
 * the other: same brand primary, same secondary, same type scale and shape in both —
 * only the handful of values that actually need to differ (backgrounds, and whether
 * the dark-mode-specific font-smoothing fix below applies) do. See the comment above
 * each block for the reasoning behind values that are shared across both modes.
 */
export function createAppTheme(mode: ThemeMode): Theme {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        // Last.fm's own red — this app's one non-negotiable brand color, unchanged
        // across both modes (verified live against last.fm's own site: this red reads
        // clearly on both a white and a near-black background, so there's no need for
        // a separate light-mode shade).
        main: "#d51007",
      },
      // A warm, muted brass/amber rather than MUI's default purple-leaning secondary
      // (which reads as generic Material and visually competes with the red instead of
      // complementing it). Amber-and-red is a deliberate nod to this app's subject —
      // vinyl labels, VU meters, and vintage radio/hi-fi dials all pair warm gold
      // accents with red — and it's desaturated enough to stay clearly subordinate to
      // `primary` rather than fighting it for attention. `contrastText` is picked by
      // hand (not MUI's auto-contrast) since `#c9932e` is a light-*mid* tone where
      // white text reads noticeably weaker than a dark warm near-black — true in both
      // modes, since this is about contrast against the amber itself, not the page.
      secondary: {
        main: "#c9932e",
        contrastText: "#1a120c",
      },
      background: isDark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    },
    // Native-OS system-font stack rather than importing a web font. Two reasons, not
    // just one: (1) this project's whole identity is reading "now playing" natively
    // from each OS's own media session rather than acting like a web page wrapped in a
    // window (see README) — using each OS's own UI typeface reinforces that instead of
    // undermining it with an imported "generic Electron app" font; (2) this app's CSP
    // (`apps/desktop/src/renderer/index.html`) has no `font-src` allowance, so a web
    // font would need CSP changes and a new asset to self-host — real added surface
    // area this theme-only pass shouldn't reach for. Mirrors the exact stack already
    // used by `apps/site`'s styles.css, so the product's typography feels consistent
    // across the app and the marketing site.
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      // NowPlayingPage's and ScrobbleDetailPage's track title — the single largest,
      // most important piece of text in the app. Bolder and a touch smaller than MUI's
      // 34px/regular-400 default, which is sized for a full-width web hero rather than
      // a compact app pane; the slight negative tracking reads as considered/editorial
      // rather than MUI's default +0.25px web-body tracking. 600, not a full 700 —
      // both real call sites had independently landed on 600 with a local `sx`
      // override before this was ever centralized (a full 700 read as slightly too
      // heavy at this size next to the by-artist h6 line right under it); this is that
      // already-settled answer promoted into the theme itself instead of staying
      // duplicated as an override in two places.
      h4: {
        fontWeight: 600,
        fontSize: "1.875rem",
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
      },
      // Every page's own title (Scrobbles/Friends/Profile/Settings) — the most
      // repeated heading in the app, so it carries the most weight (literally) in
      // establishing the type identity. MUI's default is regular-400, which barely
      // reads as a heading at all next to body text; bold at a slightly denser size
      // gives each page clear, confident identity in a narrow sidebar-nav'd pane.
      h5: {
        fontWeight: 700,
        fontSize: "1.375rem",
        lineHeight: 1.3,
        letterSpacing: "-0.01em",
      },
      // Reused for several different jobs (the "by {artist}" line under h4, the artist
      // info panel heading, the listener/play-count numbers, the logged-in username) —
      // semibold rather than MUI's medium-500 default gives it real presence as a
      // secondary heading without the bold weight/negative tracking h4/h5 use for
      // primary titles, and the smaller size (18px vs. the 20px default) keeps it from
      // overpowering the h4 title it usually sits directly beneath.
      h6: {
        fontWeight: 600,
        fontSize: "1.125rem",
        lineHeight: 1.4,
        letterSpacing: "0em",
      },
      // Settings' section labels ("Accounts", "Last.fm API key"). Same size as MUI's
      // default (no reason to change it — body-adjacent text stays body-sized) but
      // semibold with widened tracking so it reads unambiguously as a field-group
      // label, not a heavier paragraph.
      subtitle1: {
        fontWeight: 600,
        fontSize: "1rem",
        lineHeight: 1.5,
        letterSpacing: "0.02em",
      },
      // The app's smallest heading role ("Scrobbling from", "Similar Artists") — styled
      // as a quiet uppercase eyebrow/label rather than a small paragraph, the one
      // deliberate typographic risk in this pass: it's an established pattern for
      // secondary labels (and reads like a hardware readout — on-brand for a "what's
      // playing" app), but it's a real stylistic choice, not a safe default, so it's
      // called out explicitly here.
      subtitle2: {
        fontWeight: 600,
        fontSize: "0.8125rem",
        lineHeight: 1.4,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
      // MUI's own default (`textTransform: "uppercase"`, `letterSpacing: "0.4px"`
      // widened for that all-caps setting) is exactly the "generic Material Design"
      // look this theme's whole opening comment says to avoid — it just hadn't been
      // reached yet, since every button in the app rendering in caps was the one
      // remaining unexamined default. Every button label in this codebase (`Log in
      // with Last.fm`, `Save API key`, `Check for updates now`, …) is already written
      // in real sentence case specifically for this — turning the transform off here
      // needed no source-string changes anywhere, only this. `letterSpacing: "normal"`
      // alongside it: MUI's widened tracking exists to keep all-caps text from
      // feeling cramped, and just looks loose once the text isn't all-caps anymore.
      button: {
        textTransform: "none",
        letterSpacing: "normal",
      },
    },
    // MUI's default (4px) is tight enough to look sharp-cornered/boxy — closer to
    // generic Material than a considered native app. 10px is a deliberate middle
    // ground: soft enough to feel intentional on Paper/Dialog/Popover surfaces and the
    // rounded album-art Avatar in ScrobbleListItem, without going full pill-shaped.
    shape: {
      borderRadius: 10,
    },
    components: {
      // Chip does *not* read `shape.borderRadius` — verified directly against the
      // installed @mui/material source (Chip.js hard-codes `borderRadius: 32 / 2`
      // regardless of theme). Without this override, every Chip in the app ("Now
      // Playing", "Scrobbling now") would stay a 16px pill while Paper/Button/rounded
      // Avatar all became 10px — a real inconsistency, not a stylistic one, so it's
      // corrected here rather than left as a known gap.
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.shape.borderRadius,
          }),
        },
      },
      // App.tsx already renders `<CssBaseline />`, so its own generated `<style>` tag
      // is the one global stylesheet this app has — these two rules ride along in it
      // rather than adding a second global CSS source of truth for two small,
      // genuinely global concerns:
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            // Chromium/WebKit's own default subpixel-AA text rendering was designed
            // for light-background pages; light text on a near-black background
            // renders visibly heavier/fuzzier under it than it should, which grayscale
            // antialiasing (the standard fix for exactly this, WebKit-only — Firefox/
            // other engines ignore the property harmlessly) corrects for every piece
            // of text in the app at once. Dark mode only: this fix is specifically for
            // *light text on a dark background* — light mode's dark text on a light
            // background is exactly the case subpixel-AA was designed for, so forcing
            // grayscale there would only make it render slightly worse.
            ...(isDark
              ? { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }
              : {}),
            // Every number this app displays — listener/play counts, timestamps,
            // "X%" download progress, "you've listened to this N times" — is a
            // *count*, always compared against neighboring digits (stacked stat
            // numbers, a progress percentage ticking up), not read as prose. The
            // system font stack's default figures are proportional (a "1" is
            // narrower than an "8"), which reads as slightly uneven in exactly that
            // comparison context; tabular figures give every digit the same
            // advance width instead, the standard fix for numeral-heavy UI, applied
            // once here rather than as a one-off `sx` on each of the ~8 places
            // numbers show up.
            fontVariantNumeric: "tabular-nums",
          },
        },
      },
    },
  });
}
