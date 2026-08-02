import { describe, expect, it, vi } from "vitest";

const ipcMainHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
const ipcMain = {
  handle: vi.fn((channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
    ipcMainHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    ipcMainHandlers.delete(channel);
  }),
};

vi.mock("electron", () => ({ ipcMain, default: { ipcMain } }));

const { wireBugReport } = await import("../../../src/main/bug-report/wire-bug-report.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler({}, ...args));
}

describe("wireBugReport", () => {
  it("isConfigured reports false when no relay URL is set", async () => {
    wireBugReport({ relayUrl: undefined });

    await expect(invoke(IPC_CHANNELS.bugReportIsConfigured)).resolves.toBe(false);
  });

  it("isConfigured reports true when a relay URL is set", async () => {
    wireBugReport({ relayUrl: "https://relay.example/report" });

    await expect(invoke(IPC_CHANNELS.bugReportIsConfigured)).resolves.toBe(true);
  });

  it("submit throws a clear error when not configured", async () => {
    wireBugReport({ relayUrl: undefined });

    await expect(invoke(IPC_CHANNELS.bugReportSubmit, "Title", "Body")).rejects.toThrow(
      /not configured/i,
    );
  });

  it("submit POSTs title/body/diagnostics to the relay and returns the issue URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ issueUrl: "https://github.com/x/y/issues/1", issueNumber: 1 }), {
        status: 201,
      }),
    );
    wireBugReport({
      relayUrl: "https://relay.example/report",
      getDiagnostics: () => ({ platform: "darwin" }),
      fetchImpl,
    });

    const result = await invoke(IPC_CHANNELS.bugReportSubmit, "Crash on launch", "It crashes.");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://relay.example/report",
      expect.objectContaining({ method: "POST" }),
    );
    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({
      title: "Crash on launch",
      body: "It crashes.",
      diagnostics: { platform: "darwin" },
    });
    expect(result).toEqual({ issueUrl: "https://github.com/x/y/issues/1", issueNumber: 1 });
  });

  it("submit throws when the relay responds with a non-2xx status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("relay error", { status: 502 }));
    wireBugReport({ relayUrl: "https://relay.example/report", fetchImpl });

    await expect(invoke(IPC_CHANNELS.bugReportSubmit, "Title", "Body")).rejects.toThrow(/502/);
  });

  it("removes both handlers when the returned cleanup function is called", () => {
    const stop = wireBugReport({ relayUrl: "https://relay.example/report" });
    expect(ipcMainHandlers.has(IPC_CHANNELS.bugReportSubmit)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.bugReportIsConfigured)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.bugReportSubmit)).toBe(false);
  });
});
