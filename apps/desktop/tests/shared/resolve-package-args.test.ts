import { describe, expect, it } from "vitest";
import { resolvePackageArgs } from "../../scripts/resolve-package-args.mjs";

describe("resolvePackageArgs", () => {
  it("lets a later --publish always win over the script's built-in --publish never", () => {
    expect(resolvePackageArgs(["--linux", "--publish", "never", "--publish", "always"])).toEqual([
      "--linux",
      "--publish",
      "always",
    ]);
  });

  it("keeps a single --publish untouched", () => {
    expect(resolvePackageArgs(["--mac", "--publish", "never"])).toEqual([
      "--mac",
      "--publish",
      "never",
    ]);
  });

  it("passes arguments without --publish through unchanged", () => {
    expect(resolvePackageArgs(["--dir"])).toEqual(["--dir"]);
    expect(resolvePackageArgs([])).toEqual([]);
  });

  it("handles three occurrences by keeping only the last", () => {
    expect(
      resolvePackageArgs([
        "--publish",
        "onTag",
        "--win",
        "--publish",
        "never",
        "--publish",
        "always",
      ]),
    ).toEqual(["--win", "--publish", "always"]);
  });
});
