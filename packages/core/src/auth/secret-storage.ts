/**
 * Minimal key-value secret store `AccountStore` persists Last.fm session keys through.
 * Deliberately abstract — `packages/core` has zero OS dependencies (see
 * docs/adr/0002-typescript-engine.md), so the desktop app supplies a real
 * implementation backed by Electron's `safeStorage` (OS keychain). Note the caveat in
 * docs/modules/desktop.md: `safeStorage` depends on a system keyring on Linux that
 * minimal window-manager setups can lack — the desktop-side implementation is
 * responsible for surfacing that, not this interface.
 */
export interface SecretStorage {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<readonly string[]>;
}
