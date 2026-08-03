import { describe, expect, it } from "vitest";
import { stripHtml } from "../../src/renderer/src/utils/strip-html.js";

describe("stripHtml", () => {
  it("strips plain HTML tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("drops a trailing 'Read more' link entirely, including its text", () => {
    expect(stripHtml('Bio text. <a href="https://last.fm">Read more on Last.fm</a>')).toBe(
      "Bio text.",
    );
  });

  it("decodes common HTML entities", () => {
    expect(stripHtml("Rock &amp; Roll")).toBe("Rock & Roll");
    expect(stripHtml("&quot;quoted&quot;")).toBe('"quoted"');
    expect(stripHtml("rock&#39;n&#39;roll")).toBe("rock'n'roll");
  });

  it("does not resurrect an entity-encoded tag fragment into literal tag syntax", () => {
    // Regression test: entities used to be decoded *after* tags were stripped — an
    // entity-encoded tag fragment like "&lt;script&gt;" isn't real `<...>` syntax at
    // strip-time, so it survived tag-stripping untouched and only became literal
    // `<script>` in the final output afterward. Not exploitable via this app's sole
    // caller (rendered as plain JSX text, auto-escaped by React), but a latent trap
    // for any future caller that reused this output unescaped.
    expect(stripHtml("A bio mentioning &lt;script&gt;alert(1)&lt;/script&gt; as an example.")).toBe(
      "A bio mentioning alert(1) as an example.",
    );
  });

  it("strips both a real tag and an entity-encoded tag-like fragment in the same input", () => {
    // With entities decoded first, "&lt;fake tag&gt;" becomes real `<...>` syntax
    // before tag-stripping runs, so it's removed the same as a genuine tag — this is
    // the intended effect of the fix, not just "fake tag" being preserved as text.
    expect(stripHtml("<em>real tag</em> and &lt;fake tag&gt;")).toBe("real tag and");
  });

  it("trims surrounding whitespace", () => {
    expect(stripHtml("  <p>padded</p>  ")).toBe("padded");
  });
});
