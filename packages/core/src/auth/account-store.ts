import type { SecretStorage } from "./secret-storage.js";

export interface StoredAccount {
  readonly username: string;
  readonly sessionKey: string;
}

const ACCOUNT_KEY_PREFIX = "account:";
const ACTIVE_ACCOUNT_KEY = "__active_account__";

function accountKey(username: string): string {
  return `${ACCOUNT_KEY_PREFIX}${username}`;
}

/**
 * Persists Last.fm accounts (one session key each) and tracks which one is active,
 * supporting the multi-account switching shown in the reference client's Preferences →
 * Accounts tab. Backed by a `SecretStorage` implementation the desktop app supplies.
 */
export class AccountStore {
  constructor(private readonly storage: SecretStorage) {}

  async addAccount(account: StoredAccount): Promise<void> {
    const existing = await this.listAccounts();
    await this.storage.set(accountKey(account.username), JSON.stringify(account));

    if (existing.length === 0) {
      await this.storage.set(ACTIVE_ACCOUNT_KEY, account.username);
    }
  }

  async removeAccount(username: string): Promise<void> {
    await this.storage.delete(accountKey(username));

    const activeUsername = await this.storage.get(ACTIVE_ACCOUNT_KEY);
    if (activeUsername === username) {
      const [nextActive] = await this.listAccounts();
      if (nextActive) {
        await this.storage.set(ACTIVE_ACCOUNT_KEY, nextActive.username);
      } else {
        await this.storage.delete(ACTIVE_ACCOUNT_KEY);
      }
    }
  }

  async listAccounts(): Promise<readonly StoredAccount[]> {
    const keys = await this.storage.list();
    const accounts: StoredAccount[] = [];
    for (const key of keys) {
      if (!key.startsWith(ACCOUNT_KEY_PREFIX)) {
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
    const activeUsername = await this.storage.get(ACTIVE_ACCOUNT_KEY);
    if (!activeUsername) {
      return undefined;
    }
    const raw = await this.storage.get(accountKey(activeUsername));
    return raw ? (JSON.parse(raw) as StoredAccount) : undefined;
  }

  async setActiveAccount(username: string): Promise<void> {
    const raw = await this.storage.get(accountKey(username));
    if (!raw) {
      throw new Error(`AccountStore: no stored account named "${username}"`);
    }
    await this.storage.set(ACTIVE_ACCOUNT_KEY, username);
  }
}
