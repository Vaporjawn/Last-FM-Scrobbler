import { describe, expect, it, vi } from "vitest";
import { applyLoginItemSettings } from "../../../src/main/login-items/apply-login-item-settings.js";

function fakeApp() {
  return { setLoginItemSettings: vi.fn() };
}

describe("applyLoginItemSettings", () => {
  it("registers the app as a login item on macOS when launchAtLogin is true", () => {
    const app = fakeApp();

    applyLoginItemSettings(app, true, "darwin");

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
  });

  it("unregisters the app as a login item on macOS when launchAtLogin is false", () => {
    const app = fakeApp();

    applyLoginItemSettings(app, false, "darwin");

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
  });

  it("registers the app as a login item on Windows when launchAtLogin is true", () => {
    const app = fakeApp();

    applyLoginItemSettings(app, true, "win32");

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
  });

  it("never calls setLoginItemSettings on Linux — Electron has no Linux support for it at all", () => {
    const app = fakeApp();

    applyLoginItemSettings(app, true, "linux");

    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it("never passes openAsHidden — verified deprecated/non-functional on macOS 13+ and never supported elsewhere", () => {
    const app = fakeApp();

    applyLoginItemSettings(app, true, "darwin");

    const [call] = app.setLoginItemSettings.mock.calls;
    expect(call?.[0]).not.toHaveProperty("openAsHidden");
  });
});
