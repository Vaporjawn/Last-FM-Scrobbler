import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSettings } from "../../src/renderer/src/contexts/settings-context.js";
import { DEFAULT_APP_SETTINGS } from "../../src/shared/settings-api.js";

describe("useSettings without a provider", () => {
  it("returns the defaults and refuses writes instead of throwing", async () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(result.current.loading).toBe(false);
    await expect(result.current.updateSettings({ themeMode: "light" })).resolves.toEqual({
      success: false,
      error: "Not available right now.",
    });
    await expect(result.current.resetSettings()).resolves.toEqual({
      success: false,
      error: "Not available right now.",
    });
  });
});
