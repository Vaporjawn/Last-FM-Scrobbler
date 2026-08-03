import { describe, expect, it, vi } from "vitest";
import { applyDockIconVisibility } from "../../../src/main/dock/apply-dock-icon-visibility.js";

function fakeApp(withDock: boolean) {
  // `dock` is always present (never omitted) — matches Electron's own real `App.dock`
  // type exactly (`readonly dock: Dock | undefined`, see DockApp's docstring), not an
  // omittable optional property.
  return {
    dock: withDock ? { hide: vi.fn(), show: vi.fn().mockResolvedValue(undefined) } : undefined,
  };
}

describe("applyDockIconVisibility", () => {
  it("shows the Dock icon when showDockIcon is true", () => {
    const app = fakeApp(true);

    applyDockIconVisibility(app, true);

    expect(app.dock?.show).toHaveBeenCalledOnce();
    expect(app.dock?.hide).not.toHaveBeenCalled();
  });

  it("hides the Dock icon when showDockIcon is false", () => {
    const app = fakeApp(true);

    applyDockIconVisibility(app, false);

    expect(app.dock?.hide).toHaveBeenCalledOnce();
    expect(app.dock?.show).not.toHaveBeenCalled();
  });

  it("is a no-op on platforms with no Dock (app.dock is undefined)", () => {
    const app = fakeApp(false);

    expect(() => {
      applyDockIconVisibility(app, true);
    }).not.toThrow();
    expect(() => {
      applyDockIconVisibility(app, false);
    }).not.toThrow();
  });
});
