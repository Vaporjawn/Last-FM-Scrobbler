import type { SecretStorage } from "./secret-storage.js";

/**
 * One connected Last.fm-protocol account as `AccountStore` persists it (serialized to
 * JSON under the account's key): the username and the long-lived session key obtained
 * from the auth flow, which is what signs authenticated calls on the user's behalf.
 */
export interface StoredAccount {
  readonly username: string;
  readonly sessionKey: string;
}

/** Construction options for `AccountStore`. */
export interface AccountStoreOptions {
  /**
   * Prefixes every key this store writes to `storage` — lets multiple `AccountStore`
   * instances safely share a single underlying `SecretStorage` (the desktop app keeps
   * exactly one encrypted secrets file — see `ElectronSecretStorage`) without their
   * `"account:"`/`"__active_account__"` keys colliding, e.g. one instance for Last.fm
   * accounts and another for Libre.fm accounts (protocol-identical, see
   * `docs/adr/` — Libre.fm reuses `LastfmClient` itself via a different `baseUrl`).
   * Defaults to `""` (no prefix) — this is the original, pre-multi-service key shape,
   * kept as the default so existing Last.fm accounts on disk keep working with zero
   * migration for anyone who never touches the new namespace parameter.
   */
  readonly namespace?: string;
}

const ACCOUNT_KEY_PREFIX = "account:";
const ACTIVE_ACCOUNT_KEY = "__active_account__";

/**
 * Persists Last.fm-protocol accounts (one session key each) and tracks which one is
 * active, supporting the multi-account switching shown in the reference client's
 * Preferences → Accounts tab. Backed by a `SecretStorage` implementation the desktop
 * app supplies. See `AccountStoreOptions.namespace` for how more than one service
 * (Last.fm, Libre.fm) can share one `SecretStorage` safely.
 */
export class AccountStore {
  private readonly storage: SecretStorage;
  private readonly namespace: string;
  private pending: Promise<void> = Promise.resolve();

  /**
   * Creates a store over `storage`; nothing is read or written until a method is called.
   *
   * @param storage - Secret store the accounts are written to.
   * @param options - Optional key namespace; see `AccountStoreOptions.namespace`.
   */
  constructor(storage: SecretStorage, options: AccountStoreOptions = {}) {
    this.storage = storage;
    this.namespace = options.namespace ?? "";
  }

  /** Builds the storage key holding one account's JSON: namespace + `"account:"` + username. */
  private accountKey(username: string): string {
    return `${this.namespace}${ACCOUNT_KEY_PREFIX}${username}`;
  }

  /** The (namespaced) storage key whose value is the username of the active account. */
  private get activeAccountKey(): string {
    return `${this.namespace}${ACTIVE_ACCOUNT_KEY}`;
  }

  /**
   * Runs `operation` after every earlier mutation has finished. Each mutation below is a
   * read-then-write sequence spread across several awaits (list, then set; delete, then
   * re-pick the active account), so two overlapping calls used to interleave and leave
   * the store inconsistent — two "exclusive" accounts, or an active account pointing at
   * one that had just been removed. Funnelling them through one queue makes each whole
   * sequence atomic with respect to the others.
   */
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.pending.then(operation, operation);
    this.pending = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * Saves `account` (overwriting any stored account with the same username). If no
   * account existed before, it also becomes the active one; otherwise the active
   * account is left unchanged.
   */
  addAccount(account: StoredAccount): Promise<void> {
    return this.serialize(() => this.addAccountUnlocked(account));
  }

  /**
   * Deletes the named account. If it was the active one, the first remaining account
   * (in storage listing order) becomes active, or the active marker is cleared when
   * none are left.
   */
  removeAccount(username: string): Promise<void> {
    return this.serialize(() => this.removeAccountUnlocked(username));
  }

  /**
   * Makes `account` the one and only stored account and the active one, removing every
   * other — as a single atomic step. For services where this app allows at most one
   * connected account (Libre.fm, ListenBrainz): doing this as separate list/remove/add
   * calls let two overlapping connects each see an empty store and both add themselves.
   */
  connectExclusively(account: StoredAccount): Promise<void> {
    return this.serialize(async () => {
      for (const stored of await this.listAccounts()) {
        if (stored.username !== account.username) {
          await this.removeAccountUnlocked(stored.username);
        }
      }
      await this.addAccountUnlocked(account);
      await this.storage.set(this.activeAccountKey, account.username);
    });
  }

  /** Body of `addAccount`; callers must already hold the `serialize` queue. */
  private async addAccountUnlocked(account: StoredAccount): Promise<void> {
    const existing = await this.listAccounts();
    await this.storage.set(this.accountKey(account.username), JSON.stringify(account));

    if (existing.length === 0) {
      await this.storage.set(this.activeAccountKey, account.username);
    }
  }

  /** Body of `removeAccount`; callers must already hold the `serialize` queue. */
  private async removeAccountUnlocked(username: string): Promise<void> {
    await this.storage.delete(this.accountKey(username));

    const activeUsername = await this.storage.get(this.activeAccountKey);
    if (activeUsername === username) {
      const [nextActive] = await this.listAccounts();
      if (nextActive) {
        await this.storage.set(this.activeAccountKey, nextActive.username);
      } else {
        await this.storage.delete(this.activeAccountKey);
      }
    }
  }

  /**
   * Reads every account stored under this store's namespace, by scanning the storage
   * keys for the account prefix. Not queued, so it reflects whatever is on disk at the
   * moment it runs.
   */
  async listAccounts(): Promise<readonly StoredAccount[]> {
    const keys = await this.storage.list();
    const prefix = `${this.namespace}${ACCOUNT_KEY_PREFIX}`;
    const accounts: StoredAccount[] = [];
    for (const key of keys) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      const raw = await this.storage.get(key);
      if (raw) {
        accounts.push(JSON.parse(raw) as StoredAccount);
      }
    }
    return accounts;
  }

  /** The active account, or `undefined` when none is marked active or its record is missing. */
  async getActiveAccount(): Promise<StoredAccount | undefined> {
    const activeUsername = await this.storage.get(this.activeAccountKey);
    if (!activeUsername) {
      return undefined;
    }
    const raw = await this.storage.get(this.accountKey(activeUsername));
    return raw ? (JSON.parse(raw) as StoredAccount) : undefined;
  }

  /**
   * Switches the active account.
   *
   * @throws Error - When no stored account has that username (the active marker is not
   * changed in that case).
   */
  setActiveAccount(username: string): Promise<void> {
    return this.serialize(async () => {
      const raw = await this.storage.get(this.accountKey(username));
      if (!raw) {
        throw new Error(`AccountStore: no stored account named "${username}"`);
      }
      await this.storage.set(this.activeAccountKey, username);
    });
  }
}
