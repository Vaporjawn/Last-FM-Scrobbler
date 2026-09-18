// Plain, parser-blocking classic script — deliberately NOT `type="module"`/`async`/
// `defer` (any of those would delay execution until after the document is fully
// parsed, i.e. after the point this whole file exists to beat) — served as a static
// asset from `public/` rather than inlined into `index.html`: this page's CSP
// (`script-src 'self'`, see the CSP `<meta>` tag in `index.html`) has no
// `'unsafe-inline'`/nonce, so an inline `<script>` block is flatly rejected. A
// same-origin external file loaded via `<script src="/theme-init.js">` is fully
// CSP-compliant instead, and — being parser-blocking — still runs while the HTML
// parser is still inside `<head>`, before `<body>` (and therefore before anything
// paints).
//
// `window.initialThemeMode` is already defined by the time this runs: it's set by
// `preload/index.ts`'s `contextBridge.exposeInMainWorld` call, and Electron guarantees
// preload scripts run before any of the page's own scripts — see that file's own
// comment for where the value actually comes from (the persisted `AppSettings
// .themeMode`, read synchronously in the main process before this window was even
// constructed).
(() => {
  const mode = window.initialThemeMode === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", mode);

  // Keeps both `<meta>` tags (see index.html's own comment on them) in sync with the
  // real mode too, not just the CSS-driving attribute above.
  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) {
    colorScheme.setAttribute("content", mode);
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", mode === "light" ? "#faf8f5" : "#0f0c0b");
  }
})();
