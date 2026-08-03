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
    reset: vi.fn(() => {
      current = { ...DEFAULT_APP_SETTINGS };
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

/** Also surfaces `loading`/`error` — the two fields `ReaderConsumer` above doesn't
 * care about — for the tests that need to assert on them directly. */
function StatusConsumer(): JSX.Element {
  const { loading, error } = useSettings();
  return (
    <div data-testid="status">
      {loading ? "loading" : "loaded"} / {error ?? "no-error"}
    </div>
  );
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

  it("surfaces a rejected initial get() via `error`, instead of an unhandled rejection", async () => {
    // Regression test: the initial window.settings.get() call had no .catch() at
    // all, unlike every sibling data-fetching hook in this codebase — a rejection
    // (e.g. a stale preload build during development) surfaced only as an unhandled
    // promise rejection, silently leaving `settings` at defaults with `error` never
    // set, so no consumer could tell "checked and failed" apart from "still loading".
    const api: SettingsApi = {
      get: vi.fn().mockRejectedValue(new Error("IPC not ready")),
      set: vi.fn(),
      reset: vi.fn(),
    };
    Object.defineProperty(window, "settings", { value: api, configurable: true });

    render(
      <SettingsProvider>
        <StatusConsumer />
      </SettingsProvider>,
    );

    expect(await screen.findByTestId("status")).toHaveTextContent("loaded / IPC not ready");
  });

  it("does not let a stale (out-of-order) updateSettings response clobber a newer one", async () => {
    // Regression test: updateSettings/resetSettings applied their resolved response
    // via a plain setSettings(updated) with no ordering guard — two concurrent calls
    // with *different* patches (e.g. toggling dark mode, then before that IPC round
    // trip resolves, toggling notifications) could apply out of order, transiently
    // reverting whichever change's response happened to resolve first even though it
    // was requested first (not last).
    //
    // Each call's mock response is computed independently from DEFAULT_APP_SETTINGS
    // plus *that* call's own patch (not a shared mutable variable read at resolve
    // time) — this is deliberate: it's what makes the first call's eventually-
    // resolved value genuinely stale (still says "light", the target of the *first*
    // click) rather than accidentally reflecting whatever the second click already
    // did, which would make this test pass regardless of whether the real fix exists.
    let resolveFirstSet: (() => void) | undefined;
    const set = vi
      .fn()
      .mockImplementationOnce(
        (patch: Partial<AppSettings>) =>
          new Promise<AppSettings>((resolve) => {
            resolveFirstSet = () => {
              resolve({ ...DEFAULT_APP_SETTINGS, ...patch });
            };
          }),
      )
      .mockImplementation((patch: Partial<AppSettings>) =>
        Promise.resolve({ ...DEFAULT_APP_SETTINGS, ...patch }),
      );
    const api: SettingsApi = { get: vi.fn().mockResolvedValue(DEFAULT_APP_SETTINGS), set, reset: vi.fn() };
    Object.defineProperty(window, "settings", { value: api, configurable: true });

    render(
      <SettingsProvider>
        <ToggleConsumer />
      </SettingsProvider>,
    );
    await screen.findByRole("button", { name: /toggle \(dark\)/i });

    // First click: toggles to light (the optimistic update applies immediately), but
    // its IPC response stays pending.
    await act(async () => {
      screen.getByRole("button", { name: /toggle/i }).click();
      await Promise.resolve();
    });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenNthCalledWith(1, { themeMode: "light" });

    // Second click (a real, later user action, reading the just-applied optimistic
    // "light" state): toggles back to dark, and its response resolves immediately.
    await act(async () => {
      screen.getByRole("button", { name: /toggle/i }).click();
      await Promise.resolve();
    });
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenNthCalledWith(2, { themeMode: "dark" });
    expect(screen.getByRole("button", { name: /toggle/i })).toHaveTextContent("Toggle (dark)");

    // The first (stale) call's response finally arrives, saying "light" — it must
    // not clobber the second, newer call's already-applied "dark" result.
    await act(async () => {
      resolveFirstSet?.();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: /toggle/i })).toHaveTextContent("Toggle (dark)");
  });
});
