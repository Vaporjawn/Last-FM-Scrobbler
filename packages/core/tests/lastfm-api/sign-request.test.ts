import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signRequest } from "../../src/lastfm-api/sign-request.js";

function md5(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

describe("signRequest", () => {
  it("sorts params alphabetically and concatenates name+value before hashing", () => {
    const params = { method: "auth.getSession", token: "yyyy", api_key: "xxxx" };
    const secret = "ilovecher";

    // Build the expected string the same way the spec describes, independently of
    // the implementation under test, to avoid the test just re-deriving the code.
    const manuallyOrdered = "api_key" + "xxxx" + "method" + "auth.getSession" + "token" + "yyyy" + secret;

    expect(signRequest(params, secret)).toBe(md5(manuallyOrdered));
  });

  it("excludes the format and callback parameters from the signature", () => {
    const withExtras = signRequest(
      { method: "artist.getInfo", artist: "Radiohead", format: "json", callback: "cb" },
      "secret",
    );
    const withoutExtras = signRequest({ method: "artist.getInfo", artist: "Radiohead" }, "secret");

    expect(withExtras).toBe(withoutExtras);
  });

  it("produces a 32-character lowercase hex digest", () => {
    const signature = signRequest({ a: "1" }, "secret");
    expect(signature).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is stable regardless of the order params are provided in", () => {
    const a = signRequest({ b: "2", a: "1", c: "3" }, "secret");
    const b = signRequest({ c: "3", a: "1", b: "2" }, "secret");
    expect(a).toBe(b);
  });

  it("includes the session key when present, since it's a real request parameter", () => {
    const withSk = signRequest({ method: "track.love", sk: "session123" }, "secret");
    const withoutSk = signRequest({ method: "track.love" }, "secret");
    expect(withSk).not.toBe(withoutSk);
  });
});
