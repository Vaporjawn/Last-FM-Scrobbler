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

  it("removing a non-active account leaves the active account untouched", async () => {
    const store = new AccountStore(createInMemoryStorage());
    await store.addAccount({ username: "alice", sessionKey: "sk-alice" });
    await store.addAccount({ username: "bob", sessionKey: "sk-bob" });

    await store.removeAccount("bob");

    expect(await store.listAccounts()).toEqual([{ username: "alice", sessionKey: "sk-alice" }]);
    expect((await store.getActiveAccount())?.username).toBe("alice");
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

  describe("tolerance of a storage backend with missing values", () => {
    it("skips a listed key whose value is missing when listing accounts", async () => {
      const storage = createInMemoryStorage();
      await storage.set(
        "account:alice",
        JSON.stringify({ username: "alice", sessionKey: "sk-alice" }),
      );
      // Simulate a key that shows up in list() (e.g. underlying storage enumerated it)
      // but whose value has since disappeared (deleted out from under a stale listing).
      const originalGet = storage.get.bind(storage);
      storage.get = (key: string) =>
        key === "account:ghost" ? Promise.resolve(undefined) : originalGet(key);
      const originalList = storage.list.bind(storage);
      storage.list = async () => [...(await originalList()), "account:ghost"];

      const store = new AccountStore(storage);

      expect(await store.listAccounts()).toEqual([{ username: "alice", sessionKey: "sk-alice" }]);
    });

    it("returns undefined when the active-account pointer references a missing record", async () => {
      const storage = createInMemoryStorage();
      const store = new AccountStore(storage);
      await store.addAccount({ username: "alice", sessionKey: "sk-alice" });
      // Corrupt storage directly: the active pointer still says "alice", but the
      // underlying account record for "alice" has been removed without going
      // through removeAccount (e.g. external tampering, a partial migration).
      await storage.delete("account:alice");

      expect(await store.getActiveAccount()).toBeUndefined();
    });
  });

  describe("namespace", () => {
    it("keeps two namespaced instances over the same storage fully independent", async () => {
      const storage = createInMemoryStorage();
      const lastfm = new AccountStore(storage, { namespace: "lastfm:" });
      const librefm = new AccountStore(storage, { namespace: "librefm:" });

      await lastfm.addAccount({ username: "alice", sessionKey: "sk-lastfm-alice" });
      await librefm.addAccount({ username: "alice", sessionKey: "sk-librefm-alice" });
      await librefm.addAccount({ username: "bob", sessionKey: "sk-librefm-bob" });

      expect(await lastfm.listAccounts()).toEqual([
        { username: "alice", sessionKey: "sk-lastfm-alice" },
      ]);
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

  describe("overlapping mutations", () => {
    /** Storage whose every call yields to the event loop first, so that overlapping
     * store operations genuinely interleave instead of each finishing synchronously. */
    function createSlowStorage(): SecretStorage {
      const inner = createInMemoryStorage();
      const yieldFirst = () => new Promise<void>((resolve) => setImmediate(resolve));
      return {
        get: async (key) => {
          await yieldFirst();
          return inner.get(key);
        },
        set: async (key, value) => {
          await yieldFirst();
          return inner.set(key, value);
        },
        delete: async (key) => {
          await yieldFirst();
          return inner.delete(key);
        },
        list: async () => {
          await yieldFirst();
          return inner.list();
        },
      };
    }

    it("connectExclusively leaves exactly one account, even when two connects overlap", async () => {
      const store = new AccountStore(createSlowStorage());

      await Promise.all([
        store.connectExclusively({ username: "first", sessionKey: "sk-1" }),
        store.connectExclusively({ username: "second", sessionKey: "sk-2" }),
      ]);

      const accounts = await store.listAccounts();
      expect(accounts.map((account) => account.username)).toEqual(["second"]);
      expect((await store.getActiveAccount())?.username).toBe("second");
    });

    it("connectExclusively replaces earlier accounts and keeps a re-connected one", async () => {
      const store = new AccountStore(createInMemoryStorage());
      await store.addAccount({ username: "old", sessionKey: "sk-old" });
      await store.addAccount({ username: "same", sessionKey: "sk-same-1" });

      await store.connectExclusively({ username: "same", sessionKey: "sk-same-2" });

      expect(await store.listAccounts()).toEqual([{ username: "same", sessionKey: "sk-same-2" }]);
      expect((await store.getActiveAccount())?.sessionKey).toBe("sk-same-2");
    });

    it("does not let a removal interleave with an add and strand the active account", async () => {
      const store = new AccountStore(createSlowStorage());
      await store.addAccount({ username: "alice", sessionKey: "sk-a" });
      await store.addAccount({ username: "bob", sessionKey: "sk-b" });

      await Promise.all([
        store.removeAccount("alice"),
        store.addAccount({ username: "carol", sessionKey: "sk-c" }),
        store.setActiveAccount("bob"),
      ]);

      const active = await store.getActiveAccount();
      const usernames = (await store.listAccounts()).map((account) => account.username).sort();
      expect(usernames).toEqual(["bob", "carol"]);
      expect(active?.username).toBe("bob");
    });

    it("keeps processing later mutations after an earlier one fails", async () => {
      const store = new AccountStore(createInMemoryStorage());

      const failing = store.setActiveAccount("nobody");
      const following = store.addAccount({ username: "alice", sessionKey: "sk-a" });

      await expect(failing).rejects.toThrow(/no stored account/);
      await expect(following).resolves.toBeUndefined();
      expect((await store.getActiveAccount())?.username).toBe("alice");
    });
  });
});
