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
  return html
    .replace(/<a\s[^>]*>.*?<\/a>/gis, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
