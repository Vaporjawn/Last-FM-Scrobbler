// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const trayHandlers: Record<string, () => void> = {};
  const tray = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    popUpContextMenu: vi.fn(),
    getBounds: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      trayHandlers[event] = handler;
    }),
  };
  const icon = { setTemplateImage: vi.fn() };
  return {
    trayHandlers,
    tray,
    icon,
    Tray: vi.fn(function Tray() {
      return tray;
    }),
    Menu: { buildFromTemplate: vi.fn((template: unknown) => ({ template })) },
    nativeImage: { createFromPath: vi.fn(() => icon) },
  };
});

vi.mock("electron", () => ({
  default: {
    Tray: electronMock.Tray,
    Menu: electronMock.Menu,
    nativeImage: electronMock.nativeImage,
  },
}));

import { createTray } from "../../../src/main/tray/create-tray.js";

interface MenuItem {
  label?: string;
  click?: () => void;
}

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

function menuItems(): MenuItem[] {
  const [template] = electronMock.Menu.buildFromTemplate.mock.calls[0] as [MenuItem[]];
  return template;
}

function createPopover(visible: boolean) {
  return {
    isVisible: vi.fn(() => visible),
    hide: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    setPosition: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(electronMock.trayHandlers)) {
    Reflect.deleteProperty(electronMock.trayHandlers, key);
  }
  electronMock.tray.getBounds.mockReturnValue({ x: 1000, y: 0, width: 24, height: 24 });
});

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, "platform", originalPlatform);
  }
});

describe("createTray", () => {
  it("creates a titled tray icon, as a template image on macOS only", () => {
    setPlatform("darwin");
    createTray({ iconPath: "/icon.png", onShow: vi.fn(), onQuit: vi.fn() });

    expect(electronMock.nativeImage.createFromPath).toHaveBeenCalledWith("/icon.png");
    expect(electronMock.icon.setTemplateImage).toHaveBeenCalledWith(true);
    expect(electronMock.tray.setToolTip).toHaveBeenCalledWith("Last.fm Scrobbler");

    electronMock.icon.setTemplateImage.mockClear();
    setPlatform("linux");
    createTray({ iconPath: "/icon.png", onShow: vi.fn(), onQuit: vi.fn() });
    expect(electronMock.icon.setTemplateImage).not.toHaveBeenCalled();
  });

  it("without a popover, uses a plain context menu and shows the window on click", () => {
    const onShow = vi.fn();
    const onQuit = vi.fn();

    const tray = createTray({ iconPath: "/icon.png", onShow, onQuit });

    expect(tray).toBe(electronMock.tray);
    expect(electronMock.tray.setContextMenu).toHaveBeenCalledTimes(1);
    electronMock.trayHandlers.click?.();
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(electronMock.trayHandlers["right-click"]).toBeUndefined();
  });

  it("wires the menu items to show the app and quit", () => {
    const onShow = vi.fn();
    const onQuit = vi.fn();
    createTray({ iconPath: "/icon.png", onShow, onQuit });

    const [show, separator, quit] = menuItems();
    expect(show?.label).toBe("Show Last.fm Scrobbler");
    expect(separator).toEqual({ type: "separator" });
    expect(quit?.label).toBe("Quit");
    show?.click?.();
    quit?.click?.();
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it("with a popover, left-click opens it next to the icon and right-click pops the menu", () => {
    const popover = createPopover(false);
    const resolvePopoverScreenBounds = vi.fn(() => ({ x: 0, y: 0, width: 1440, height: 900 }));
    setPlatform("darwin");

    createTray({
      iconPath: "/icon.png",
      onShow: vi.fn(),
      onQuit: vi.fn(),
      popover: popover as never,
      resolvePopoverScreenBounds,
    });

    expect(electronMock.tray.setContextMenu).not.toHaveBeenCalled();
    electronMock.trayHandlers.click?.();
    expect(resolvePopoverScreenBounds).toHaveBeenCalledWith({
      x: 1000,
      y: 0,
      width: 24,
      height: 24,
    });
    expect(popover.setPosition).toHaveBeenCalledTimes(1);
    expect(popover.show).toHaveBeenCalledTimes(1);
    expect(popover.focus).toHaveBeenCalledTimes(1);

    electronMock.trayHandlers["right-click"]?.();
    expect(electronMock.tray.popUpContextMenu).toHaveBeenCalledTimes(1);
  });

  it("with a popover, clicking while it is open closes it instead", () => {
    const popover = createPopover(true);

    createTray({
      iconPath: "/icon.png",
      onShow: vi.fn(),
      onQuit: vi.fn(),
      popover: popover as never,
      resolvePopoverScreenBounds: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
    });
    electronMock.trayHandlers.click?.();

    expect(popover.hide).toHaveBeenCalledTimes(1);
    expect(popover.show).not.toHaveBeenCalled();
  });

  it("falls back to the plain menu when a popover is given without a screen resolver", () => {
    const popover = createPopover(false);

    createTray({
      iconPath: "/icon.png",
      onShow: vi.fn(),
      onQuit: vi.fn(),
      popover: popover as never,
    });

    expect(electronMock.tray.setContextMenu).toHaveBeenCalledTimes(1);
  });
});
