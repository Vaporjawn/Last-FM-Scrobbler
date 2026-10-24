import { describe, expect, it } from "vitest";
import {
  OPTIONAL_SIGNING_ENV_NAMES,
  resolvePackageEnv,
} from "../../scripts/resolve-package-env.mjs";

describe("resolvePackageEnv", () => {
  it("drops signing variables that Actions expanded to an empty string", () => {
    const resolved = resolvePackageEnv({ CSC_LINK: "", APPLE_ID: "  ", PATH: "/usr/bin" });
    expect(resolved).toEqual({ PATH: "/usr/bin" });
  });

  it("keeps signing variables that have a real value", () => {
    const resolved = resolvePackageEnv({ CSC_LINK: "base64data", CSC_KEY_PASSWORD: "pw" });
    expect(resolved).toEqual({ CSC_LINK: "base64data", CSC_KEY_PASSWORD: "pw" });
  });

  it("never touches unrelated variables, even when empty", () => {
    const resolved = resolvePackageEnv({ LASTFM_API_KEY: "", BUG_REPORT_RELAY_URL: "" });
    expect(resolved).toEqual({ LASTFM_API_KEY: "", BUG_REPORT_RELAY_URL: "" });
  });

  it("does not mutate the input and covers every documented signing variable", () => {
    const input = Object.fromEntries(OPTIONAL_SIGNING_ENV_NAMES.map((name) => [name, ""]));
    const resolved = resolvePackageEnv(input);
    expect(resolved).toEqual({});
    expect(Object.keys(input)).toHaveLength(OPTIONAL_SIGNING_ENV_NAMES.length);
  });
});
