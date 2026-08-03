import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS, type AppSettings, type AspectRatioOption } from "../../src/shared/settings-api.js";
import { NavigationSidebar } from "../../src/renderer/src/components/NavigationSidebar.js";
import { SettingsContext } from "../../src/renderer/src/contexts/settings-context.js";
import { ok } from "../../src/renderer/src/hooks/ok.js";

/** Wraps `NavigationSidebar` in a `SettingsContext.Provider` seeded directly with
 * `aspectRatio` and `loading: false` — a synchronously-resolved value, not the real
 * `SettingsProvider`'s own `useSettingsState()` (which always starts a render with the
 * portrait default before asynchronously resolving `window.settings.get()` — see that
 * hook's own docstring). Bypassing that async load entirely keeps most of this file's
 * tests, which are about navigation/toggle mechanics rather than settings-loading
 * timing, simple synchronous assertions with no `waitFor` needed. Defaults to a
 * landscape ratio ("16:9") — matching this suite's original assumption that the
 * sidebar starts expanded — since the portrait-collapse behavior itself gets its own
 * dedicated tests below (including one exercising the real un-mocked default, see
 * "defaults to collapsed with no settings available at all"). */
function renderSidebar(
  props: ComponentProps<typeof NavigationSidebar>,
  aspectRatio: AspectRatioOption = "16:9",
): ReturnType<typeof render> {
  const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, aspectRatio };
  return render(
    <SettingsContext.Provider
      value={{
        settings,
        loading: false,
        error: undefined,
        updateSettings: vi.fn().mockResolvedValue(ok()),
        resetSettings: vi.fn().mockResolvedValue(ok()),
      }}
    >
      <NavigationSidebar {...props} />
    </SettingsContext.Provider>,
  );
}

describe("NavigationSidebar", () => {
  it("shows the app icon and wordmark when expanded", () => {
    renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() });

    expect(screen.getByText("Last.fm")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Last.fm Scrobbler" })).toBeInTheDocument();
  });

  it("shows only the app icon, not the wordmark, once collapsed", () => {
    renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() });

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));

    expect(screen.queryByText("Last.fm")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Last.fm Scrobbler" })).toBeInTheDocument();
  });

  it("renders all five navigation destinations", () => {
    renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() });

    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByText("Scrobbles")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("calls onSelectView with the clicked destination", () => {
    const onSelectView = vi.fn();
    renderSidebar({ activeView: "now-playing", onSelectView });

    fireEvent.click(screen.getByText("Friends"));

    expect(onSelectView).toHaveBeenCalledWith("friends");
  });

  it("hides labels but keeps every destination reachable and accessible once collapsed", () => {
    renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() });

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));

    expect(screen.queryByText("Now Playing")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Now Playing")).toBeInTheDocument();
    expect(screen.getByLabelText("Scrobbles")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile")).toBeInTheDocument();
    expect(screen.getByLabelText("Friends")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("still calls onSelectView by destination while collapsed", () => {
    const onSelectView = vi.fn();
    renderSidebar({ activeView: "now-playing", onSelectView });

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    fireEvent.click(screen.getByLabelText("Friends"));

    expect(onSelectView).toHaveBeenCalledWith("friends");
  });

  it("does not render a 'Report a Bug' button when onReportBug is omitted", () => {
    renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() });

    expect(screen.queryByText("Report a Bug")).not.toBeInTheDocument();
  });

  it("calls onReportBug when the 'Report a Bug' button is clicked", () => {
    const onReportBug = vi.fn();
    renderSidebar({ activeView: "now-playing", onSelectView: vi.fn(), onReportBug });

    fireEvent.click(screen.getByText("Report a Bug"));

    expect(onReportBug).toHaveBeenCalled();
  });

  it("restores labels when expanded again", () => {
    renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() });

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    fireEvent.click(screen.getByLabelText("Expand sidebar"));

    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });

  describe("portrait aspect ratio", () => {
    it("starts collapsed when the aspect ratio is 9:14", () => {
      renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() }, "9:14");

      expect(screen.queryByText("Last.fm")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    });

    it("starts collapsed when the aspect ratio is 9:16", () => {
      renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() }, "9:16");

      expect(screen.queryByText("Last.fm")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    });

    it("starts expanded when the aspect ratio is landscape or square", () => {
      renderSidebar({ activeView: "now-playing", onSelectView: vi.fn() }, "4:3");

      expect(screen.getByText("Last.fm")).toBeInTheDocument();
      expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
    });

    // This app's own real default settings (`DEFAULT_APP_SETTINGS.aspectRatio`) are
    // already `"9:14"` — a portrait ratio — so a bare render with no settings context
    // at all (`useSettings()`'s own no-provider fallback, see that hook's docstring)
    // is the most realistic reproduction of what a fresh install actually shows.
    it("defaults to collapsed with no settings available at all", () => {
      render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

      expect(screen.queryByText("Last.fm")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    });

    it("re-collapses when the aspect ratio changes to portrait while already running", () => {
      const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, aspectRatio: "16:9" };
      const contextValue = {
        settings,
        loading: false,
        error: undefined,
        updateSettings: vi.fn().mockResolvedValue(ok()),
        resetSettings: vi.fn().mockResolvedValue(ok()),
      };
      const { rerender } = render(
        <SettingsContext.Provider value={contextValue}>
          <NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />
        </SettingsContext.Provider>,
      );
      expect(screen.getByText("Last.fm")).toBeInTheDocument();

      rerender(
        <SettingsContext.Provider value={{ ...contextValue, settings: { ...settings, aspectRatio: "9:14" } }}>
          <NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />
        </SettingsContext.Provider>,
      );

      expect(screen.queryByText("Last.fm")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    });

    it("does not force back open when the aspect ratio changes away from portrait", () => {
      const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, aspectRatio: "9:14" };
      const contextValue = {
        settings,
        loading: false,
        error: undefined,
        updateSettings: vi.fn().mockResolvedValue(ok()),
        resetSettings: vi.fn().mockResolvedValue(ok()),
      };
      const { rerender } = render(
        <SettingsContext.Provider value={contextValue}>
          <NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />
        </SettingsContext.Provider>,
      );
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();

      rerender(
        <SettingsContext.Provider value={{ ...contextValue, settings: { ...settings, aspectRatio: "16:9" } }}>
          <NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />
        </SettingsContext.Provider>,
      );

      // Still collapsed — leaving portrait doesn't force it open, which would
      // override a sidebar state the user may have set deliberately in the meantime.
      expect(screen.queryByText("Last.fm")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    });
  });
});
