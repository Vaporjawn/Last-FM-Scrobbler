import { describe, expect, it, vi } from "vitest";

const notificationInstances: {
  options: unknown;
  listeners: Map<string, () => void>;
  show: () => void;
  on: (event: string, listener: () => void) => void;
}[] = [];

let isSupported = true;

class FakeNotification {
  readonly show = vi.fn();
  readonly on = vi.fn((event: string, listener: () => void) => {
    this.listeners.set(event, listener);
  });
  private readonly listeners = new Map<string, () => void>();

  constructor(public readonly options: unknown) {
    notificationInstances.push(this as never);
  }

  static isSupported(): boolean {
    return isSupported;
  }
}

vi.mock("electron", () => ({
  Notification: FakeNotification,
  default: { Notification: FakeNotification },
}));

const { showNotification } = await import("../../../src/main/notifications/show-notification.js");

describe("showNotification", () => {
  it("constructs and shows a notification with the given title/body", () => {
    showNotification({ title: "Scrobbled", body: "Weights by Everything Everything" });

    const [notification] = notificationInstances;
    expect(notification?.options).toMatchObject({
      title: "Scrobbled",
      body: "Weights by Everything Everything",
    });
    expect(notification?.show).toHaveBeenCalledOnce();
  });

  it("passes an icon through when provided", () => {
    showNotification({ title: "t", body: "b", icon: "/path/to/icon.png" });

    const notification = notificationInstances.at(-1);
    expect(notification?.options).toMatchObject({ icon: "/path/to/icon.png" });
  });

  it("omits the icon field entirely when not provided", () => {
    showNotification({ title: "t", body: "b" });

    const notification = notificationInstances.at(-1);
    expect(notification?.options).not.toHaveProperty("icon");
  });

  it("registers onClick as a 'click' listener", () => {
    const onClick = vi.fn();
    showNotification({ title: "t", body: "b", onClick });

    const notification = notificationInstances.at(-1);
    expect(notification?.on).toHaveBeenCalledWith("click", onClick);
  });

  it("does not register a 'click' listener when onClick is omitted", () => {
    showNotification({ title: "t", body: "b" });

    const notification = notificationInstances.at(-1);
    expect(notification?.on).not.toHaveBeenCalled();
  });

  it("does nothing (doesn't throw) when Notification.isSupported() is false", () => {
    isSupported = false;
    const countBefore = notificationInstances.length;
    try {
      expect(() => {
        showNotification({ title: "t", body: "b" });
      }).not.toThrow();
      expect(notificationInstances.length).toBe(countBefore);
    } finally {
      isSupported = true;
    }
  });

  it("logs a warning naming the skipped notification when Notification.isSupported() is false", () => {
    isSupported = false;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      showNotification({ title: "Logged in", body: "b" });

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("Logged in"));
    } finally {
      isSupported = true;
      warnSpy.mockRestore();
    }
  });
});
