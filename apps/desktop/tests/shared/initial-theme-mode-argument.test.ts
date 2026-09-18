import { describe, expect, it } from "vitest";
import {
  buildInitialThemeModeArgument,
  resolveThemeModeFromArgv,
} from "../../src/shared/initial-theme-mode-argument.js";

describe("buildInitialThemeModeArgument", () => {
  it("builds the flag for dark", () => {
    expect(buildInitialThemeModeArgument("dark")).toBe("--initial-theme-mode=dark");
  });

  it("builds the flag for light", () => {
    expect(buildInitialThemeModeArgument("light")).toBe("--initial-theme-mode=light");
  });
});

describe("resolveThemeModeFromArgv", () => {
  it("resolves light when the flag is present with a light value", () => {
    expect(resolveThemeModeFromArgv(["/usr/bin/electron", "--initial-theme-mode=light"])).toBe(
      "light",
    );
  });

  it("resolves dark when the flag is present with a dark value", () => {
    expect(resolveThemeModeFromArgv(["/usr/bin/electron", "--initial-theme-mode=dark"])).toBe(
      "dark",
    );
  });

  it("round-trips through buildInitialThemeModeArgument", () => {
    expect(resolveThemeModeFromArgv([buildInitialThemeModeArgument("light")])).toBe("light");
    expect(resolveThemeModeFromArgv([buildInitialThemeModeArgument("dark")])).toBe("dark");
  });

  it("falls back to dark when the flag is entirely missing (e.g. the tray popover window)", () => {
    expect(resolveThemeModeFromArgv(["/usr/bin/electron", "--some-other-flag=1"])).toBe("dark");
    expect(resolveThemeModeFromArgv([])).toBe("dark");
  });

  it("falls back to dark when the flag carries an unrecognized value", () => {
    expect(resolveThemeModeFromArgv(["--initial-theme-mode=purple"])).toBe("dark");
    expect(resolveThemeModeFromArgv(["--initial-theme-mode="])).toBe("dark");
  });

  it("ignores an unrelated argument that merely contains the flag's value as a substring", () => {
    expect(resolveThemeModeFromArgv(["--some-other-theme-mode=light"])).toBe("dark");
  });
});
