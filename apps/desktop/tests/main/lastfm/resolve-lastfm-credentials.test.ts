import { describe, expect, it, vi } from "vitest";
import { AppCredentialsStore } from "@lastfm-scrobbler/core";
import { resolveLastfmCredentials } from "../../../src/main/lastfm/resolve-lastfm-credentials.js";
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

describe("resolveLastfmCredentials", () => {
  it("uses credentials baked into the build when no environment variables are set", async () => {
    const appCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await appCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLastfmCredentials({
      env: {},
      baked: { apiKey: "baked-key", apiSecret: "baked-secret" },
      appCredentialsStore,
    });

    expect(resolved).toEqual({
      apiKey: "baked-key",
      apiSecret: "baked-secret",
      source: "environment",
    });
  });

  it("lets explicit environment variables override baked credentials", async () => {
    const resolved = await resolveLastfmCredentials({
      env: { LASTFM_API_KEY: "env-key", LASTFM_API_SECRET: "env-secret" },
      baked: { apiKey: "baked-key", apiSecret: "baked-secret" },
    });

    expect(resolved?.apiKey).toBe("env-key");
  });

  it("reads the baked pair from the BAKED_* variables a production build inlines", async () => {
    vi.stubEnv("BAKED_LASTFM_API_KEY", "inlined-key");
    vi.stubEnv("BAKED_LASTFM_API_SECRET", "inlined-secret");
    try {
      const resolved = await resolveLastfmCredentials({ env: {} });
      expect(resolved).toEqual({
        apiKey: "inlined-key",
        apiSecret: "inlined-secret",
        source: "environment",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ignores a half-baked pair (key without secret)", async () => {
    vi.stubEnv("BAKED_LASTFM_API_KEY", "inlined-key");
    vi.stubEnv("BAKED_LASTFM_API_SECRET", "");
    try {
      expect(await resolveLastfmCredentials({ env: {} })).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("prefers environment variables when both are set", async () => {
    const appCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await appCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLastfmCredentials({
      env: { LASTFM_API_KEY: "env-key", LASTFM_API_SECRET: "env-secret" },
      appCredentialsStore,
    });

    expect(resolved).toEqual({
      apiKey: "env-key",
      apiSecret: "env-secret",
      source: "environment",
    });
  });

  it("falls back to a user-supplied key when environment variables aren't set", async () => {
    const appCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await appCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLastfmCredentials({ env: {}, appCredentialsStore });

    expect(resolved).toEqual({
      apiKey: "user-key",
      apiSecret: "user-secret",
      source: "user-supplied",
    });
  });

  it("falls back to a user-supplied key when only one environment variable is set", async () => {
    const appCredentialsStore = new AppCredentialsStore(createInMemoryStorage());
    await appCredentialsStore.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const resolved = await resolveLastfmCredentials({
      env: { LASTFM_API_KEY: "env-key" },
      appCredentialsStore,
    });

    expect(resolved?.source).toBe("user-supplied");
  });

  it("returns undefined when neither source has credentials", async () => {
    const appCredentialsStore = new AppCredentialsStore(createInMemoryStorage());

    const resolved = await resolveLastfmCredentials({ env: {}, appCredentialsStore });

    expect(resolved).toBeUndefined();
  });

  it("returns undefined when there's no app credentials store and no env vars", async () => {
    const resolved = await resolveLastfmCredentials({ env: {} });

    expect(resolved).toBeUndefined();
  });

  it("reads LASTFM_API_KEY/LASTFM_API_SECRET from the real process environment by default", async () => {
    vi.stubEnv("LASTFM_API_KEY", "process-key");
    vi.stubEnv("LASTFM_API_SECRET", "process-secret");
    try {
      await expect(resolveLastfmCredentials()).resolves.toEqual({
        apiKey: "process-key",
        apiSecret: "process-secret",
        source: "environment",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
