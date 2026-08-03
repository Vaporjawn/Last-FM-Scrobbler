import type { SecretStorage } from "./secret-storage.js";

export interface StoredAccount {
  readonly username: string;
  readonly sessionKey: string;
}

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

  constructor(storage: SecretStorage, options: AccountStoreOptions = {}) {
    this.storage = storage;
    this.namespace = options.namespace ?? "";
  }

  private accountKey(username: string): string {
    return `${this.namespace}${ACCOUNT_KEY_PREFIX}${username}`;
  }

  private get activeAccountKey(): string {
    return `${this.namespace}${ACTIVE_ACCOUNT_KEY}`;
  }

  async addAccount(account: StoredAccount): Promise<void> {
    const existing = await this.listAccounts();
    await this.storage.set(this.accountKey(account.username), JSON.stringify(account));

    if (existing.length === 0) {
      await this.storage.set(this.activeAccountKey, account.username);
    }
  }

  async removeAccount(username: string): Promise<void> {
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

  async getActiveAccount(): Promise<StoredAccount | undefined> {
    const activeUsername = await this.storage.get(this.activeAccountKey);
    if (!activeUsername) {
      return undefined;
    }
    const raw = await this.storage.get(this.accountKey(activeUsername));
    return raw ? (JSON.parse(raw) as StoredAccount) : undefined;
  }

  async setActiveAccount(username: string): Promise<void> {
    const raw = await this.storage.get(this.accountKey(username));
    if (!raw) {
      throw new Error(`AccountStore: no stored account named "${username}"`);
    }
    await this.storage.set(this.activeAccountKey, username);
  }
}
