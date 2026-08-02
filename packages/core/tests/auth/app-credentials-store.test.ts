import { describe, expect, it } from "vitest";
import { AppCredentialsStore } from "../../src/auth/app-credentials-store.js";
import type { SecretStorage } from "../../src/auth/secret-storage.js";

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

describe("AppCredentialsStore", () => {
  it("starts with no stored credentials", async () => {
    const store = new AppCredentialsStore(createInMemoryStorage());
    expect(await store.get()).toBeUndefined();
  });

  it("persists a saved key/secret pair", async () => {
    const store = new AppCredentialsStore(createInMemoryStorage());

    await store.set({ apiKey: "user-key", apiSecret: "user-secret" });

    expect(await store.get()).toEqual({ apiKey: "user-key", apiSecret: "user-secret" });
  });

  it("overwrites a previously saved pair", async () => {
    const store = new AppCredentialsStore(createInMemoryStorage());
    await store.set({ apiKey: "old-key", apiSecret: "old-secret" });

    await store.set({ apiKey: "new-key", apiSecret: "new-secret" });

    expect(await store.get()).toEqual({ apiKey: "new-key", apiSecret: "new-secret" });
  });

  it("clears a saved pair", async () => {
    const store = new AppCredentialsStore(createInMemoryStorage());
    await store.set({ apiKey: "user-key", apiSecret: "user-secret" });

    await store.clear();

    expect(await store.get()).toBeUndefined();
  });

  it("clearing when nothing was ever saved does not throw", async () => {
    const store = new AppCredentialsStore(createInMemoryStorage());
    await expect(store.clear()).resolves.not.toThrow();
  });

  it("persists across a new AppCredentialsStore instance over the same storage", async () => {
    const storage = createInMemoryStorage();
    const first = new AppCredentialsStore(storage);
    await first.set({ apiKey: "user-key", apiSecret: "user-secret" });

    const second = new AppCredentialsStore(storage);

    expect(await second.get()).toEqual({ apiKey: "user-key", apiSecret: "user-secret" });
  });
});
