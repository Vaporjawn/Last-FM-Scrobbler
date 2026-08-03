import { describe, expect, it } from "vitest";
import { AccountStore } from "../../src/auth/account-store.js";
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

describe("AccountStore", () => {
  it("starts with no accounts and no active account", async () => {
    const store = new AccountStore(createInMemoryStorage());
    expect(await store.listAccounts()).toEqual([]);
    expect(await store.getActiveAccount()).toBeUndefined();
  });

  it("adding the first account makes it active automatically", async () => {
    const store = new AccountStore(createInMemoryStorage());

    await store.addAccount({ username: "alice", sessionKey: "sk-alice" });

    expect(await store.getActiveAccount()).toEqual({
      username: "alice",
      sessionKey: "sk-alice",
    });
  });

  it("adding a second account does not change the active one", async () => {
    const store = new AccountStore(createInMemoryStorage());
    await store.addAccount({ username: "alice", sessionKey: "sk-alice" });

    await store.addAccount({ username: "bob", sessionKey: "sk-bob" });

    expect(await store.listAccounts()).toHaveLength(2);
    expect((await store.getActiveAccount())?.username).toBe("alice");
  });

  it("re-adding an existing username updates its session key in place", async () => {
    const store = new AccountStore(createInMemoryStorage());
    await store.addAccount({ username: "alice", sessionKey: "sk-old" });

    await store.addAccount({ username: "alice", sessionKey: "sk-new" });

    expect(await store.listAccounts()).toEqual([{ username: "alice", sessionKey: "sk-new" }]);
  });

  it("switches the active account explicitly", async () => {
    const store = new AccountStore(createInMemoryStorage());
    await store.addAccount({ username: "alice", sessionKey: "sk-alice" });
    await store.addAccount({ username: "bob", sessionKey: "sk-bob" });

    await store.setActiveAccount("bob");

    expect((await store.getActiveAccount())?.username).toBe("bob");
  });

  it("throws when switching to an account that was never added", async () => {
    const store = new AccountStore(createInMemoryStorage());
    await expect(store.setActiveAccount("nobody")).rejects.toThrow(/nobody/);
  });

  it("removing the active account promotes another remaining account", async () => {
    const store = new AccountStore(createInMemoryStorage());
    await store.addAccount({ username: "alice", sessionKey: "sk-alice" });
    await store.addAccount({ username: "bob", sessionKey: "sk-bob" });

    await store.removeAccount("alice");

    expect(await store.listAccounts()).toEqual([{ username: "bob", sessionKey: "sk-bob" }]);
    expect((await store.getActiveAccount())?.username).toBe("bob");
  });

  it("removing the last account leaves no active account", async () => {
    const store = new AccountStore(createInMemoryStorage());
    await store.addAccount({ username: "alice", sessionKey: "sk-alice" });

    await store.removeAccount("alice");

    expect(await store.getActiveAccount()).toBeUndefined();
    expect(await store.listAccounts()).toEqual([]);
  });

  it("persists accounts across a new AccountStore instance over the same storage", async () => {
    const storage = createInMemoryStorage();
    const first = new AccountStore(storage);
    await first.addAccount({ username: "alice", sessionKey: "sk-alice" });

    const second = new AccountStore(storage);

    expect(await second.listAccounts()).toEqual([{ username: "alice", sessionKey: "sk-alice" }]);
    expect((await second.getActiveAccount())?.username).toBe("alice");
  });

  describe("namespace", () => {
    it("keeps two namespaced instances over the same storage fully independent", async () => {
      const storage = createInMemoryStorage();
      const lastfm = new AccountStore(storage, { namespace: "lastfm:" });
      const librefm = new AccountStore(storage, { namespace: "librefm:" });

      await lastfm.addAccount({ username: "alice", sessionKey: "sk-lastfm-alice" });
      await librefm.addAccount({ username: "alice", sessionKey: "sk-librefm-alice" });
      await librefm.addAccount({ username: "bob", sessionKey: "sk-librefm-bob" });

      expect(await lastfm.listAccounts()).toEqual([{ username: "alice", sessionKey: "sk-lastfm-alice" }]);
      expect(await librefm.listAccounts()).toHaveLength(2);
      expect((await lastfm.getActiveAccount())?.sessionKey).toBe("sk-lastfm-alice");
      expect((await librefm.getActiveAccount())?.username).toBe("alice");

      await librefm.setActiveAccount("bob");

      expect((await librefm.getActiveAccount())?.username).toBe("bob");
      // The other namespace's active account is untouched by the switch above.
      expect((await lastfm.getActiveAccount())?.username).toBe("alice");
    });

    it("defaults to no namespace, matching this store's original on-disk key shape", async () => {
      const storage = createInMemoryStorage();
      const unnamespaced = new AccountStore(storage);
      await unnamespaced.addAccount({ username: "alice", sessionKey: "sk-alice" });

      expect(await storage.list()).toEqual(
        expect.arrayContaining(["account:alice", "__active_account__"]),
      );
    });
  });
});
