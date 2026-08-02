import { act, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, type AppSettings, type SettingsApi } from "../../src/shared/settings-api.js";
import { SettingsProvider } from "../../src/renderer/src/contexts/SettingsProvider.js";
import { useSettings } from "../../src/renderer/src/contexts/settings-context.js";

function installFakeSettingsApi(): SettingsApi {
  let current: AppSettings = { ...DEFAULT_APP_SETTINGS };
  const api: SettingsApi = {
    get: vi.fn(() => Promise.resolve(current)),
    set: vi.fn((patch: Partial<AppSettings>) => {
      current = { ...current, ...patch };
      return Promise.resolve(current);
    }),
  };
  Object.defineProperty(window, "settings", { value: api, configurable: true });
  return api;
}

/** A minimal stand-in for `SettingsPage`'s own dark-mode toggle — just enough to prove
 * `updateSettings` from one consumer is visible to a *different* consumer under the
 * same provider, without pulling in the whole real page. */
function ToggleConsumer(): JSX.Element {
  const { settings, updateSettings } = useSettings();
  return (
    <button
      onClick={() => {
        void updateSettings({ themeMode: settings.themeMode === "dark" ? "light" : "dark" });
      }}
    >
      Toggle ({settings.themeMode})
    </button>
  );
}

/** A second, independent consumer — stands in for `App.tsx`'s own `useSettings()` call
 * driving the live theme. */
function ReaderConsumer(): JSX.Element {
  const { settings } = useSettings();
  return <div data-testid="reader">{settings.themeMode}</div>;
}

describe("SettingsProvider", () => {
  it("shares one live settings state across every consumer under it", async () => {
    installFakeSettingsApi();

    render(
      <SettingsProvider>
        <ToggleConsumer />
        <ReaderConsumer />
      </SettingsProvider>,
    );

    // Regression test for the actual reported bug: App.tsx and SettingsPage each
    // calling the state-holding hook directly created two separate, unsynchronized
    // copies of AppSettings — toggling dark mode in one never reached the other, so
    // the app's live theme never visibly changed even though the toggle itself (and
    // the persisted setting) worked correctly.
    expect(await screen.findByTestId("reader")).toHaveTextContent("dark");

    await act(async () => {
      screen.getByRole("button", { name: /toggle/i }).click();
      await Promise.resolve();
    });

    expect(await screen.findByTestId("reader")).toHaveTextContent("light");
    expect(screen.getByRole("button", { name: /toggle/i })).toHaveTextContent("Toggle (light)");
  });
});
