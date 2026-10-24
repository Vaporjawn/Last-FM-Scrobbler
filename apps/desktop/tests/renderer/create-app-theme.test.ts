import { describe, expect, it } from "vitest";
import { createAppTheme } from "../../src/renderer/src/theme/index.js";

const ANY_STRING: unknown = expect.any(String);

type Resolve = (args: { theme: unknown; ownerState: Record<string, unknown> }) => unknown;

function buttonRoot(mode: "light" | "dark"): { theme: unknown; resolve: Resolve } {
  const theme = createAppTheme(mode);
  const root = theme.components?.MuiButton?.styleOverrides?.root as Resolve;
  return { theme, resolve: root };
}

describe("createAppTheme", () => {
  it("builds a light and a dark palette", () => {
    expect(createAppTheme("light").palette.mode).toBe("light");
    expect(createAppTheme("dark").palette.mode).toBe("dark");
  });

  describe("button overrides", () => {
    it("lifts primary text and outlined buttons to an accessible colour in dark mode", () => {
      const { theme, resolve } = buttonRoot("dark");

      const outlined = resolve({ theme, ownerState: { color: "primary", variant: "outlined" } });
      const text = resolve({ theme, ownerState: { color: "primary", variant: "text" } });

      expect(outlined).toMatchObject({ borderColor: ANY_STRING });
      expect(text).toMatchObject({ color: ANY_STRING });
      expect(text).not.toHaveProperty("borderColor");
    });

    it("leaves other buttons alone: contained, non-primary, or any light-mode button", () => {
      const dark = buttonRoot("dark");
      const light = buttonRoot("light");

      expect(
        dark.resolve({ theme: dark.theme, ownerState: { color: "primary", variant: "contained" } }),
      ).toEqual({});
      expect(
        dark.resolve({ theme: dark.theme, ownerState: { color: "error", variant: "text" } }),
      ).toEqual({});
      expect(
        light.resolve({ theme: light.theme, ownerState: { color: "primary", variant: "text" } }),
      ).toEqual({});
    });
  });

  it("only recolours links and focused form labels in dark mode", () => {
    const dark = createAppTheme("dark").components;
    const light = createAppTheme("light").components;

    expect(dark?.MuiLink?.styleOverrides?.root).toMatchObject({ color: ANY_STRING });
    expect(light?.MuiLink?.styleOverrides?.root).toEqual({});
    expect(dark?.MuiFormLabel?.styleOverrides?.root).toHaveProperty("&.Mui-focused");
    expect(light?.MuiFormLabel?.styleOverrides?.root).toEqual({});
  });

  it("gives chips the theme's border radius", () => {
    const theme = createAppTheme("dark");
    const chipRoot = theme.components?.MuiChip?.styleOverrides?.root as (args: {
      theme: typeof theme;
    }) => unknown;

    expect(chipRoot({ theme })).toEqual({ borderRadius: theme.shape.borderRadius });
  });

  it("smooths fonts only in dark mode, and always uses tabular numbers", () => {
    const darkBody = (
      createAppTheme("dark").components?.MuiCssBaseline?.styleOverrides as {
        body: Record<string, unknown>;
      }
    ).body;
    const lightBody = (
      createAppTheme("light").components?.MuiCssBaseline?.styleOverrides as {
        body: Record<string, unknown>;
      }
    ).body;

    expect(darkBody).toMatchObject({
      WebkitFontSmoothing: "antialiased",
      fontVariantNumeric: "tabular-nums",
    });
    expect(lightBody).not.toHaveProperty("WebkitFontSmoothing");
    expect(lightBody).toMatchObject({ fontVariantNumeric: "tabular-nums" });
  });
});
