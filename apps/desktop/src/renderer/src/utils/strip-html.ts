/**
 * Strips HTML tags and decodes a small set of common entities from Last.fm's artist
 * bio summaries, which the API returns pre-formatted with inline HTML — including a
 * trailing "Read more on Last.fm" link we already render separately (dropped here
 * entirely rather than duplicated). Deliberately reduces to plain text rather than
 * rendering the raw markup: bio text is wiki-editable, externally-sourced content, and
 * there's no reason to take on that rendering/sanitization surface for a two-line
 * summary — a React `Typography` with this plain-text output is inherently escaped.
 */
export function stripHtml(html: string): string {
  // Entities decoded *before* tags are stripped, not after — decoding last would let
  // an entity-encoded tag fragment (e.g. a bio literally containing the text
  // "&lt;script&gt;") survive tag-stripping untouched (it isn't real `<...>` syntax
  // yet at that point) and only turn into literal `<script>` in the final output
  // afterward. Not exploitable today (the sole caller renders this as a plain JSX
  // text child, which React auto-escapes) but a latent trap for any future caller
  // that reused this output somewhere unescaped (dangerouslySetInnerHTML, a URL, an
  // attribute) — decoding first means tag-stripping actually sees and removes it,
  // matching this function's own "reduces to plain text" contract.
  return html
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<a\s[^>]*>.*?<\/a>/gis, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}
