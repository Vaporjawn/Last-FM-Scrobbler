import electron from "electron";
import type { Logger } from "@lastfm-scrobbler/core";
import { wireAuth } from "../auth/wire-auth.js";
import { wireSecondaryAuth } from "../auth/wire-secondary-auth.js";
import { announceLoginFailure } from "./announce-login-failure.js";
import { announceLoginSuccess } from "./announce-login-success.js";
import { openExternalIfSafe } from "./open-external-if-safe.js";
import type { LastfmServices } from "./lastfm-services.js";
import type { SecretStores } from "./secret-stores.js";

const { app } = electron;

/** What `wireLoginServices` needs from the rest of startup. */
export interface WireLoginServicesOptions {
  readonly expectedOrigin: string;
  readonly logger: Logger;
  readonly secretStores: SecretStores;
  readonly lastfmServices: LastfmServices;
  readonly notificationIconOption: { readonly icon?: string };
  /** Marks the app as really quitting so the close-to-tray handler lets windows close. */
  readonly markQuitting: () => void;
}

/**
 * Wires the Last.fm login IPC (`wireAuth`) and the Libre.fm and ListenBrainz login IPC
 * (`wireSecondaryAuth`), including the "bring the app back to the front" and native
 * notification behaviour when a browser-based login finishes or fails.
 */
export function wireLoginServices(options: WireLoginServicesOptions): void {
  const { expectedOrigin, logger, secretStores, lastfmServices, notificationIconOption } = options;
  const { accountStore, appCredentialsStore } = secretStores;
  const { lastfmClient, resolvedCredentials, networkStatus } = lastfmServices;

  wireAuth({
    expectedOrigin,
    accountStore,
    client: lastfmClient,
    openUrl: openExternalIfSafe,
    credentialsSource: resolvedCredentials?.source,
    appCredentialsStore,
    ...(networkStatus ? { networkStatus } : {}),
    relaunch: () => {
      options.markQuitting();
      app.relaunch();
      app.exit(0);
    },
    onLoginSuccess: (username) => {
      announceLoginSuccess({
        logger,
        logLabel: "Login",
        username,
        notificationTitle: "Logged in",
        notificationBody: `You're now logged in to Last.fm Scrobbler as ${username}.`,
        notificationIconOption,
      });
    },
    onLoginFailed: (message) => {
      announceLoginFailure({
        logger,
        logLabel: "Login",
        message,
        notificationTitle: "Login failed",
        notificationIconOption,
      });
    },
  });
  wireSecondaryAuth({
    expectedOrigin,
    librefmAccountStore: secretStores.librefmAccountStore,
    librefmAppCredentialsStore: secretStores.librefmAppCredentialsStore,
    resolveLibrefmCredentials: secretStores.resolveLibrefmAppCredentials,
    listenbrainzAccountStore: secretStores.listenbrainzAccountStore,
    openUrl: openExternalIfSafe,
    onLibrefmLoginSuccess: (username) => {
      announceLoginSuccess({
        logger,
        logLabel: "Libre.fm login",
        username,
        notificationTitle: "Logged in to Libre.fm",
        notificationBody: `You're now connected to Libre.fm as ${username}.`,
        notificationIconOption,
      });
    },
    onLibrefmLoginFailed: (message) => {
      announceLoginFailure({
        logger,
        logLabel: "Libre.fm login",
        message,
        notificationTitle: "Libre.fm login failed",
        notificationIconOption,
      });
    },
  });
}
