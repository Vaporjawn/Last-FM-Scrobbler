import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The script is a classic, parser-blocking IIFE (see its own header comment), so
// importing it runs it. The path goes through a variable so TypeScript doesn't try to
// resolve a type declaration for a plain script.
const THEME_INIT_PATH = "../../src/renderer/public/theme-init.js";

async function runThemeInit(): Promise<void> {
  vi.resetModules();
  await import(/* @vite-ignore */ THEME_INIT_PATH);
}

function setInitialThemeMode(value: unknown): void {
  Object.defineProperty(window, "initialThemeMode", { value, configurable: true });
}

describe("theme-init.js", () => {
  beforeEach(() => {
    document.head.innerHTML =
      '<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0f0c0b">';
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "initialThemeMode");
  });

  it("applies the light theme to the root element and both <meta> tags", async () => {
    setInitialThemeMode("light");

    await runThemeInit();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute("content")).toBe(
      "light",
    );
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      "#faf8f5",
    );
  });

  it.each([["dark"], [undefined], ["sepia"]])(
    "falls back to the dark theme for %s",
    async (value) => {
      setInitialThemeMode(value);

      await runThemeInit();

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute("content")).toBe(
        "dark",
      );
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
        "#0f0c0b",
      );
    },
  );

  it("still sets the root attribute when the page has no theme <meta> tags", async () => {
    document.head.innerHTML = "";
    setInitialThemeMode("light");

    await runThemeInit();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
