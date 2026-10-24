import { describe, expect, it, vi } from "vitest";

const ipcMainHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
const ipcMain = {
  handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
    ipcMainHandlers.set(channel, handler);
  },
  removeHandler: (channel: string) => {
    ipcMainHandlers.delete(channel);
  },
};

vi.mock("electron", () => ({ ipcMain, default: { ipcMain } }));

const { wireFilterValidation } =
  await import("../../../src/main/filters/wire-filter-validation.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

const EXPECTED_ORIGIN = "http://localhost:5173";
const TRUSTED_EVENT = { senderFrame: { url: "http://localhost:5173/" } };

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler(TRUSTED_EVENT, ...args));
}

describe("wireFilterValidation", () => {
  it("resolves { valid: true } for a well-formed expression", async () => {
    wireFilterValidation({ expectedOrigin: EXPECTED_ORIGIN });

    const result = await invoke(IPC_CHANNELS.filterValidate, 'sourceApp == "firefox"');

    expect(result).toEqual({ valid: true });
  });

  it("resolves { valid: true } for a more complex expression using and/or/not", async () => {
    wireFilterValidation({ expectedOrigin: EXPECTED_ORIGIN });

    const result = await invoke(
      IPC_CHANNELS.filterValidate,
      'sourceApp == "firefox" or (sourceApp == "chrome" and not title contains "Podcast")',
    );

    expect(result).toEqual({ valid: true });
  });

  it("resolves { valid: false, error } for a syntax error, rather than rejecting", async () => {
    wireFilterValidation({ expectedOrigin: EXPECTED_ORIGIN });

    const result = await invoke(IPC_CHANNELS.filterValidate, "sourceApp ==");

    expect(result).toMatchObject({ valid: false });
    expect((result as { error: string }).error).toEqual(expect.any(String));
  });

  it("resolves { valid: false, error } for an unknown field", async () => {
    wireFilterValidation({ expectedOrigin: EXPECTED_ORIGIN });

    const result = await invoke(IPC_CHANNELS.filterValidate, 'notAField == "x"');

    expect(result).toMatchObject({ valid: false });
  });

  it("removes the handler when the returned cleanup function is called", () => {
    const stop = wireFilterValidation({ expectedOrigin: EXPECTED_ORIGIN });
    expect(ipcMainHandlers.has(IPC_CHANNELS.filterValidate)).toBe(true);

    stop();

    expect(ipcMainHandlers.has(IPC_CHANNELS.filterValidate)).toBe(false);
  });

  it("reports an unexpected (non-syntax) failure as an invalid expression instead of throwing", async () => {
    wireFilterValidation({ expectedOrigin: EXPECTED_ORIGIN });

    // Nesting deep enough to overflow the recursive-descent parser's call stack, which
    // surfaces as a RangeError rather than a FilterSyntaxError.
    const result = (await invoke(
      IPC_CHANNELS.filterValidate,
      `${"(".repeat(200_000)}title == "x"${")".repeat(200_000)}`,
    )) as { valid: boolean; error?: string };

    expect(result.valid).toBe(false);
    expect(result.error).toContain("RangeError");
  });

  it("rejects every handler it registers when the caller is not the app's own page", () => {
    wireFilterValidation({ expectedOrigin: EXPECTED_ORIGIN });
    expect(ipcMainHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of ipcMainHandlers) {
      expect(() => handler({ senderFrame: { url: "https://evil.example/" } }), channel).toThrow(
        /untrusted sender/i,
      );
    }
  });
});
