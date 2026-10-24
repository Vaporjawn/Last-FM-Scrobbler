import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { hardenWebContents } from "../../../src/main/security/harden-web-contents.js";

const EXPECTED_ORIGIN = "file:///app/out/renderer/index.html";

function createFakeWebContents() {
  const emitter = new EventEmitter();
  const session = {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
  };
  const webContents = Object.assign(emitter, {
    session,
    setWindowOpenHandler: vi.fn(),
  });
  const openExternal = vi.fn();
  hardenWebContents(webContents as unknown as Electron.WebContents, {
    expectedOrigin: EXPECTED_ORIGIN,
    openExternal,
  });
  return { webContents, session, openExternal };
}

/** Emits a navigation-style event the way Electron does, with a cancellable `event`. */
function navigate(
  webContents: EventEmitter,
  type: "will-navigate" | "will-redirect",
  url: string,
): { defaultPrevented: boolean } {
  const event = {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  webContents.emit(type, event, url);
  return event;
}

describe("hardenWebContents", () => {
  describe("navigation", () => {
    it("lets the window reload its own page, including a different hash", () => {
      const { webContents, openExternal } = createFakeWebContents();

      expect(
        navigate(webContents, "will-navigate", `${EXPECTED_ORIGIN}#tray-popover`).defaultPrevented,
      ).toBe(false);
      expect(openExternal).not.toHaveBeenCalled();
    });

    it("cancels a navigation to a web page and opens it in the real browser instead", () => {
      const { webContents, openExternal } = createFakeWebContents();

      const event = navigate(webContents, "will-navigate", "https://evil.example/phish");

      expect(event.defaultPrevented).toBe(true);
      expect(openExternal).toHaveBeenCalledWith("https://evil.example/phish");
    });

    it("cancels, without opening anything, a navigation to another local file or a script URL", () => {
      const { webContents, openExternal } = createFakeWebContents();

      expect(navigate(webContents, "will-navigate", "file:///etc/passwd").defaultPrevented).toBe(
        true,
      );
      expect(navigate(webContents, "will-navigate", "javascript:alert(1)").defaultPrevented).toBe(
        true,
      );
      expect(openExternal).not.toHaveBeenCalled();
    });

    it("cancels a redirect away from the app's page but allows one within it", () => {
      const { webContents, openExternal } = createFakeWebContents();

      expect(navigate(webContents, "will-redirect", "https://evil.example/").defaultPrevented).toBe(
        true,
      );
      expect(navigate(webContents, "will-redirect", EXPECTED_ORIGIN).defaultPrevented).toBe(false);
      expect(openExternal).not.toHaveBeenCalled();
    });
  });

  it("refuses to attach a <webview>", () => {
    const { webContents } = createFakeWebContents();
    const event = { defaultPrevented: false, preventDefault: vi.fn() };

    webContents.emit("will-attach-webview", event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  describe("new windows", () => {
    function openHandler(webContents: { setWindowOpenHandler: ReturnType<typeof vi.fn> }) {
      return webContents.setWindowOpenHandler.mock.calls[0]?.[0] as (details: { url: string }) => {
        action: string;
      };
    }

    it("denies the window and opens an http(s) target in the real browser", () => {
      const { webContents, openExternal } = createFakeWebContents();

      const result = openHandler(webContents)({ url: "https://www.last.fm/music/Radiohead" });

      expect(result).toEqual({ action: "deny" });
      expect(openExternal).toHaveBeenCalledWith("https://www.last.fm/music/Radiohead");
    });

    it("denies the window and opens nothing for any other kind of URL", () => {
      const { webContents, openExternal } = createFakeWebContents();

      const result = openHandler(webContents)({ url: "file:///etc/passwd" });

      expect(result).toEqual({ action: "deny" });
      expect(openExternal).not.toHaveBeenCalled();
    });
  });

  it("answers every permission request and check with no", () => {
    const { session } = createFakeWebContents();
    const callback = vi.fn();

    const requestHandler = session.setPermissionRequestHandler.mock.calls[0]?.[0] as (
      requester: unknown,
      permission: string,
      callback: (granted: boolean) => void,
    ) => void;
    requestHandler({}, "media", callback);
    const checkHandler = session.setPermissionCheckHandler.mock.calls[0]?.[0] as () => boolean;

    expect(callback).toHaveBeenCalledWith(false);
    expect(checkHandler()).toBe(false);
  });
});
