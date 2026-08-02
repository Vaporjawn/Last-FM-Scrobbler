import { LastfmApiError } from "../lastfm-api/lastfm-error.js";
import type { LastfmSession } from "../lastfm-api/types.js";

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
/** Last.fm error code for "This token has not been authorized [yet]". */
const TOKEN_NOT_AUTHORIZED_CODE = 14;

export class AuthTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for the user to authorize this application on Last.fm");
    this.name = "AuthTimeoutError";
  }
}

/** The subset of `LastfmClient` the auth flow needs — kept narrow for easy testing. */
export interface AuthFlowClient {
  getAuthToken(): Promise<string>;
  buildAuthUrl(token: string): string;
  getSession(token: string): Promise<LastfmSession>;
}

export interface AuthFlowOptions {
  readonly client: AuthFlowClient;
  /** Opens the Last.fm authorization page — e.g. Electron's `shell.openExternal`. */
  readonly openUrl: (url: string) => void | Promise<void>;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
  readonly sleepImpl?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Drives Last.fm's desktop auth flow end to end: get a token, open the browser to
 * Last.fm's own authorization page, then silently poll until the user has clicked
 * "Allow Access" there — no manual token entry, no extra clicks in the app itself
 * beyond whatever the user does on Last.fm's own site.
 */
export class AuthFlow {
  private readonly client: AuthFlowClient;
  private readonly openUrl: (url: string) => void | Promise<void>;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(options: AuthFlowOptions) {
    this.client = options.client;
    this.openUrl = options.openUrl;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
    this.now = options.now ?? (() => Date.now());
  }

  async authenticate(): Promise<LastfmSession> {
    const token = await this.client.getAuthToken();
    await this.openUrl(this.client.buildAuthUrl(token));

    const deadline = this.now() + this.timeoutMs;

    for (;;) {
      try {
        return await this.client.getSession(token);
      } catch (error) {
        if (!(error instanceof LastfmApiError) || error.code !== TOKEN_NOT_AUTHORIZED_CODE) {
          throw error;
        }
        if (this.now() >= deadline) {
          throw new AuthTimeoutError();
        }
        await this.sleepImpl(this.pollIntervalMs);
      }
    }
  }
}
