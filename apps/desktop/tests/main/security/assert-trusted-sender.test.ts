import { describe, expect, it } from "vitest";
import { assertTrustedSender } from "../../../src/main/security/assert-trusted-sender.js";
import { isTrustedUrl } from "../../../src/main/security/is-trusted-url.js";

describe("assertTrustedSender", () => {
  describe("dev-style origin (http)", () => {
    const expectedOrigin = "http://localhost:5173";

    it("passes for a sender from the exact expected origin", () => {
      expect(() => {
        assertTrustedSender({ senderFrame: { url: "http://localhost:5173/" } }, expectedOrigin);
      }).not.toThrow();
    });

    it("passes even when the sender's path/query differs, as long as the origin matches", () => {
      expect(() => {
        assertTrustedSender(
          { senderFrame: { url: "http://localhost:5173/settings?tab=accounts" } },
          expectedOrigin,
        );
      }).not.toThrow();
    });

    it("throws for a different port", () => {
      expect(() => {
        assertTrustedSender({ senderFrame: { url: "http://localhost:9999/" } }, expectedOrigin);
      }).toThrow(/untrusted sender/i);
    });

    it("throws for a different host", () => {
      expect(() => {
        assertTrustedSender({ senderFrame: { url: "http://evil.example/" } }, expectedOrigin);
      }).toThrow(/untrusted sender/i);
    });

    it("throws for a different scheme entirely (file: pretending to be the dev server)", () => {
      expect(() => {
        assertTrustedSender({ senderFrame: { url: "file:///etc/passwd" } }, expectedOrigin);
      }).toThrow(/untrusted sender/i);
    });
  });

  describe("packaged-style origin (file:)", () => {
    const expectedOrigin =
      "file:///Applications/Last.fm%20Scrobbler.app/Contents/Resources/app.asar/out/renderer/index.html";

    it("passes for the exact same file: path", () => {
      expect(() => {
        assertTrustedSender(
          {
            senderFrame: {
              url: "file:///Applications/Last.fm%20Scrobbler.app/Contents/Resources/app.asar/out/renderer/index.html",
            },
          },
          expectedOrigin,
        );
      }).not.toThrow();
    });

    // The whole reason assertTrustedSender can't just compare `.origin` for file: URLs:
    // every file: URL reports the same RFC-6454 origin ("null"), regardless of path —
    // verified directly here, not just asserted in a comment.
    it("confirms two different file: URLs really do share the same origin (the gotcha this guards against)", () => {
      expect(new URL("file:///a/index.html").origin).toBe("null");
      expect(new URL("file:///a/index.html").origin).toBe(
        new URL("file:///totally/different/b.html").origin,
      );
    });

    it("throws for a different file: path — proving the pathname check, not just protocol, is what's enforced", () => {
      expect(() => {
        assertTrustedSender({ senderFrame: { url: "file:///tmp/evil.html" } }, expectedOrigin);
      }).toThrow(/untrusted sender/i);
    });

    it("throws for an http: sender when a file: origin is expected", () => {
      expect(() => {
        assertTrustedSender({ senderFrame: { url: "http://localhost:5173/" } }, expectedOrigin);
      }).toThrow(/untrusted sender/i);
    });
  });

  describe("no senderFrame", () => {
    it("throws when senderFrame is null", () => {
      expect(() => {
        assertTrustedSender({ senderFrame: null }, "http://localhost:5173");
      }).toThrow(/no senderFrame/i);
    });
  });

  describe("isTrustedUrl", () => {
    it("is false, rather than throwing, for text that is not a URL", () => {
      expect(isTrustedUrl("not a url", "http://localhost:5173")).toBe(false);
      expect(isTrustedUrl("", "file:///app/index.html")).toBe(false);
    });

    it("compares a dev origin by origin and a packaged page by file path", () => {
      expect(isTrustedUrl("http://localhost:5173/x?y=1#z", "http://localhost:5173")).toBe(true);
      expect(isTrustedUrl("file:///app/index.html#tray-popover", "file:///app/index.html")).toBe(
        true,
      );
      expect(isTrustedUrl("file:///other/index.html", "file:///app/index.html")).toBe(false);
    });
  });
});
