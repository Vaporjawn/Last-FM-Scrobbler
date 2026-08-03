import { describe, expect, it, vi } from "vitest";
import { AccountStore, AppCredentialsStore, type SecretStorage } from "@lastfm-scrobbler/core";
import { resolveLibrefmCredentials } from "../../../src/main/auth/resolve-librefm-credentials.js";

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

const { wireSecondaryAuth } = await import("../../../src/main/auth/wire-secondary-auth.js");
const { IPC_CHANNELS } = await import("../../../src/shared/ipc-channels.js");

const EXPECTED_ORIGIN = "http://localhost:5173";
const TRUSTED_EVENT = { senderFrame: { url: "http://localhost:5173/" } };

function inMemoryStorage(): SecretStorage {
  const data = new Map<string, string>();
  return {
    get: (key) => Promise.resolve(data.get(key)),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    delete: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
    list: () => Promise.resolve([...data.keys()]),
  };
}

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return Promise.resolve(handler(TRUSTED_EVENT, ...args));
}

function fakeAuthFlowClient(username: string) {
  return {
    getAuthToken: () => Promise.resolve("token123"),
    buildAuthUrl: (token: string) => `https://libre.fm/auth?token=${token}`,
    getSession: () => Promise.resolve({ username, sessionKey: "sk-123", isSubscriber: false }),
  };
}

/** Builds the `resolveLibrefmCredentials` option `wireSecondaryAuth` requires, backed
 * by the real `resolveLibrefmCredentials` (already independently tested in
 * `resolve-librefm-credentials.test.ts`) reading from `librefmAppCredentialsStore` —
 * the same wiring `main/index.ts` uses in production, just with no env vars set by
 * default (a test wanting to exercise the "environment" source passes its own `env`
 * override). */
function resolverFor(
  librefmAppCredentialsStore: AppCredentialsStore,
  env: Record<string, string> = {},
) {
  return () => resolveLibrefmCredentials({ env, librefmAppCredentialsStore });
}

describe("wireSecondaryAuth", () => {
  describe("Libre.fm", () => {
    it("librefmIsConfigured reports false when no credentials are saved or baked in", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.librefmIsConfigured)).resolves.toBe(false);
      await expect(invoke(IPC_CHANNELS.librefmCredentialsSource)).resolves.toBe("none");
    });

    it("librefmIsConfigured reports true once a key/secret pair is saved", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await invoke(IPC_CHANNELS.librefmSetCredentials, "key", "secret");

      await expect(invoke(IPC_CHANNELS.librefmIsConfigured)).resolves.toBe(true);
      await expect(invoke(IPC_CHANNELS.librefmCredentialsSource)).resolves.toBe("user-supplied");
      await expect(librefmAppCredentialsStore.get()).resolves.toEqual({
        apiKey: "key",
        apiSecret: "secret",
      });
    });

    it("librefmCredentialsSource reports 'environment' when baked-in credentials take precedence", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      await librefmAppCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore, {
          LIBREFM_API_KEY: "env-key",
          LIBREFM_API_SECRET: "env-secret",
        }),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.librefmIsConfigured)).resolves.toBe(true);
      await expect(invoke(IPC_CHANNELS.librefmCredentialsSource)).resolves.toBe("environment");
    });

    it("librefmSetCredentials rejects an empty key or secret", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.librefmSetCredentials, "", "secret")).rejects.toThrow();
      await expect(invoke(IPC_CHANNELS.librefmSetCredentials, "key", "")).rejects.toThrow();
    });

    it("librefmClearCredentials clears a saved pair", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      await librefmAppCredentialsStore.set({ apiKey: "key", apiSecret: "secret" });
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await invoke(IPC_CHANNELS.librefmClearCredentials);

      await expect(librefmAppCredentialsStore.get()).resolves.toBeUndefined();
    });

    it("librefmLogin throws when no credentials are saved or baked in", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.librefmLogin)).rejects.toThrow(/not configured/);
    });

    it("librefmLogin runs the auth flow, stores the account, and makes it active", async () => {
      const librefmAccountStore = new AccountStore(inMemoryStorage());
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      await librefmAppCredentialsStore.set({ apiKey: "key", apiSecret: "secret" });
      const openUrl = vi.fn();
      const onLibrefmLoginSuccess = vi.fn();
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore,
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl,
        onLibrefmLoginSuccess,
        createLibrefmAuthFlowClient: () => fakeAuthFlowClient("alice"),
      });

      const result = await invoke(IPC_CHANNELS.librefmLogin);

      expect(result).toEqual({ username: "alice" });
      expect(openUrl).toHaveBeenCalledWith("https://libre.fm/auth?token=token123");
      await expect(librefmAccountStore.getActiveAccount()).resolves.toEqual({
        username: "alice",
        sessionKey: "sk-123",
      });
      expect(onLibrefmLoginSuccess).toHaveBeenCalledExactlyOnceWith("alice");
    });

    it("librefmLogin works from baked-in environment credentials with nothing saved", async () => {
      const librefmAccountStore = new AccountStore(inMemoryStorage());
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore,
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore, {
          LIBREFM_API_KEY: "env-key",
          LIBREFM_API_SECRET: "env-secret",
        }),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
        createLibrefmAuthFlowClient: () => fakeAuthFlowClient("alice"),
      });

      const result = await invoke(IPC_CHANNELS.librefmLogin);

      expect(result).toEqual({ username: "alice" });
      await expect(librefmAccountStore.getActiveAccount()).resolves.toEqual({
        username: "alice",
        sessionKey: "sk-123",
      });
    });

    it("librefmLogin calls onLibrefmLoginFailed and rethrows when the flow fails", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      await librefmAppCredentialsStore.set({ apiKey: "key", apiSecret: "secret" });
      const onLibrefmLoginFailed = vi.fn();
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
        onLibrefmLoginFailed,
        createLibrefmAuthFlowClient: () => ({
          getAuthToken: () => Promise.reject(new Error("boom")),
          buildAuthUrl: () => "https://libre.fm/auth",
          getSession: () => Promise.reject(new Error("unreachable")),
        }),
      });

      await expect(invoke(IPC_CHANNELS.librefmLogin)).rejects.toThrow("boom");
      expect(onLibrefmLoginFailed).toHaveBeenCalledExactlyOnceWith("boom");
    });

    it("librefmLogout disconnects the active account", async () => {
      const librefmAccountStore = new AccountStore(inMemoryStorage());
      await librefmAccountStore.addAccount({ username: "alice", sessionKey: "sk-123" });
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore,
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await invoke(IPC_CHANNELS.librefmLogout);

      await expect(librefmAccountStore.getActiveAccount()).resolves.toBeUndefined();
    });

    it("librefmGetActiveAccount reports the connected username, or undefined", async () => {
      const librefmAccountStore = new AccountStore(inMemoryStorage());
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore,
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.librefmGetActiveAccount)).resolves.toBeUndefined();

      await librefmAccountStore.addAccount({ username: "alice", sessionKey: "sk-123" });

      await expect(invoke(IPC_CHANNELS.librefmGetActiveAccount)).resolves.toBe("alice");
    });
  });

  describe("ListenBrainz", () => {
    it("listenbrainzConnect validates the token, stores it, and makes it active", async () => {
      const listenbrainzAccountStore = new AccountStore(inMemoryStorage());
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      const validateToken = vi.fn().mockResolvedValue({ valid: true, username: "alice" });
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore,
        openUrl: vi.fn(),
        createListenBrainzClient: () => ({ validateToken }),
      });

      const result = await invoke(IPC_CHANNELS.listenbrainzConnect, "lb-token");

      expect(result).toEqual({ username: "alice" });
      expect(validateToken).toHaveBeenCalledWith("lb-token");
      await expect(listenbrainzAccountStore.getActiveAccount()).resolves.toEqual({
        username: "alice",
        sessionKey: "lb-token",
      });
    });

    it("listenbrainzConnect throws a friendly error for an invalid token", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      const validateToken = vi.fn().mockResolvedValue({ valid: false });
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
        createListenBrainzClient: () => ({ validateToken }),
      });

      await expect(invoke(IPC_CHANNELS.listenbrainzConnect, "bad-token")).rejects.toThrow(/valid/);
    });

    it("listenbrainzConnect rejects an empty token without calling validateToken", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      const validateToken = vi.fn();
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
        createListenBrainzClient: () => ({ validateToken }),
      });

      await expect(invoke(IPC_CHANNELS.listenbrainzConnect, "  ")).rejects.toThrow(/required/);
      expect(validateToken).not.toHaveBeenCalled();
    });

    it("listenbrainzDisconnect disconnects the active account", async () => {
      const listenbrainzAccountStore = new AccountStore(inMemoryStorage());
      await listenbrainzAccountStore.addAccount({ username: "alice", sessionKey: "lb-token" });
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore,
        openUrl: vi.fn(),
      });

      await invoke(IPC_CHANNELS.listenbrainzDisconnect);

      await expect(listenbrainzAccountStore.getActiveAccount()).resolves.toBeUndefined();
    });

    it("listenbrainzGetActiveAccount reports the connected username, or undefined", async () => {
      const listenbrainzAccountStore = new AccountStore(inMemoryStorage());
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore,
        openUrl: vi.fn(),
      });

      await expect(invoke(IPC_CHANNELS.listenbrainzGetActiveAccount)).resolves.toBeUndefined();

      await listenbrainzAccountStore.addAccount({ username: "alice", sessionKey: "lb-token" });

      await expect(invoke(IPC_CHANNELS.listenbrainzGetActiveAccount)).resolves.toBe("alice");
    });
  });

  describe("untrusted sender", () => {
    it("rejects every handler when senderFrame doesn't match expectedOrigin", async () => {
      const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
      wireSecondaryAuth({
        expectedOrigin: EXPECTED_ORIGIN,
        librefmAccountStore: new AccountStore(inMemoryStorage()),
        librefmAppCredentialsStore,
        resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
        listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
        openUrl: vi.fn(),
      });
      const untrustedEvent = { senderFrame: { url: "http://evil.example/" } };
      const handler = ipcMainHandlers.get(IPC_CHANNELS.librefmIsConfigured);

      await expect(async () => {
        if (!handler) throw new Error("handler missing");
        await handler(untrustedEvent);
      }).rejects.toThrow(/untrusted sender/);
    });
  });

  it("the returned cleanup function removes every registered handler", () => {
    const librefmAppCredentialsStore = new AppCredentialsStore(inMemoryStorage());
    const cleanup = wireSecondaryAuth({
      expectedOrigin: EXPECTED_ORIGIN,
      librefmAccountStore: new AccountStore(inMemoryStorage()),
      librefmAppCredentialsStore,
      resolveLibrefmCredentials: resolverFor(librefmAppCredentialsStore),
      listenbrainzAccountStore: new AccountStore(inMemoryStorage()),
      openUrl: vi.fn(),
    });

    cleanup();

    expect(ipcMainHandlers.has(IPC_CHANNELS.librefmLogin)).toBe(false);
    expect(ipcMainHandlers.has(IPC_CHANNELS.listenbrainzConnect)).toBe(false);
  });
});
