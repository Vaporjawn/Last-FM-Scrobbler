import { describe, expect, it, vi } from "vitest";
import { AppCredentialsStore } from "@lastfm-scrobbler/core";
import { resolveLibrefmCredentials } from "../../../src/main/auth/resolve-librefm-credentials.js";
import type { SecretStorage } from "@lastfm-scrobbler/core";

function createInMemoryStorage(): SecretStorage {
  const map = new Map<string, string>();
  return {
    get(key) {
      return Promise.resolve(map.get(key));
    },
    set(key, value) {
      map.set(key, value);
      return Promise.resolve();
    },
    delete(key) {
      map.delete(key);
      return Promise.resolve();
    },
    list() {
      return Promise.resolve([...map.keys()]);
    },
  };
}

describe("resolveLibrefmCredentials", () => {
  it("uses credentials baked into the build when no environment variables are set", async () => {
    const librefmAppCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await librefmAppCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLibrefmCredentials({
      env: {},
      baked: { apiKey: "baked-key", apiSecret: "baked-secret" },
      librefmAppCredentialsStore,
    });

    expect(resolved).toEqual({
      apiKey: "baked-key",
      apiSecret: "baked-secret",
      source: "environment",
    });
  });

  it("reads the baked pair from the BAKED_* variables a production build inlines", async () => {
    vi.stubEnv("BAKED_LIBREFM_API_KEY", "inlined-key");
    vi.stubEnv("BAKED_LIBREFM_API_SECRET", "inlined-secret");
    try {
      const resolved = await resolveLibrefmCredentials({ env: {} });
      expect(resolved?.apiKey).toBe("inlined-key");
      expect(resolved?.source).toBe("environment");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("prefers environment variables when both are set", async () => {
    const librefmAppCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await librefmAppCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLibrefmCredentials({
      env: { LIBREFM_API_KEY: "env-key", LIBREFM_API_SECRET: "env-secret" },
      librefmAppCredentialsStore,
    });

    expect(resolved).toEqual({
      apiKey: "env-key",
      apiSecret: "env-secret",
      source: "environment",
    });
  });

  it("falls back to a user-supplied key when environment variables aren't set", async () => {
    const librefmAppCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await librefmAppCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLibrefmCredentials({ env: {}, librefmAppCredentialsStore });

    expect(resolved).toEqual({
      apiKey: "user-key",
      apiSecret: "user-secret",
      source: "user-supplied",
    });
  });

  it("falls back to a user-supplied key when only one environment variable is set", async () => {
    const librefmAppCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await librefmAppCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLibrefmCredentials({
      env: { LIBREFM_API_KEY: "env-key" },
      librefmAppCredentialsStore,
    });

    expect(resolved?.source).toBe("user-supplied");
  });

  it("returns undefined when neither source has credentials", async () => {
    const librefmAppCredentialsStore = new AppCredentialsStore(createInMemoryStorage());

    const resolved = await resolveLibrefmCredentials({ env: {}, librefmAppCredentialsStore });

    expect(resolved).toBeUndefined();
  });

  it("returns undefined when there's no app credentials store and no env vars", async () => {
    const resolved = await resolveLibrefmCredentials({ env: {} });

    expect(resolved).toBeUndefined();
  });
});
