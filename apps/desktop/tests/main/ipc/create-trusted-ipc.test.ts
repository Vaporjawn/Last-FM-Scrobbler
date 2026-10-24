import { describe, expect, it, vi } from "vitest";
import { createTrustedIpc } from "../../../src/main/ipc/create-trusted-ipc.js";

const EXPECTED_ORIGIN = "http://localhost:5173";

function setup() {
  const registered = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
  const ipcMain = {
    handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      registered.set(channel, listener);
    }),
  };
  const ipc = createTrustedIpc(ipcMain, EXPECTED_ORIGIN);
  return { ipc, registered };
}

describe("createTrustedIpc", () => {
  it("runs the handler, passing the event and arguments, for a call from the app's own page", () => {
    const { ipc, registered } = setup();
    const handler = vi.fn().mockReturnValue("result");
    ipc.handle("channel:ok", handler);
    const event = { senderFrame: { url: "http://localhost:5173/" } };

    const result = registered.get("channel:ok")?.(event, "a", 2);

    expect(result).toBe("result");
    expect(handler).toHaveBeenCalledWith(event, "a", 2);
  });

  it("refuses a call from another origin without entering the handler", () => {
    const { ipc, registered } = setup();
    const handler = vi.fn();
    ipc.handle("channel:bad", handler);

    expect(() =>
      registered.get("channel:bad")?.({ senderFrame: { url: "https://evil.example/" } }),
    ).toThrow(/untrusted sender/i);
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses a call that has no sender frame", () => {
    const { ipc, registered } = setup();
    const handler = vi.fn();
    ipc.handle("channel:none", handler);

    expect(() => registered.get("channel:none")?.({ senderFrame: null })).toThrow(/senderFrame/);
    expect(handler).not.toHaveBeenCalled();
  });
});
