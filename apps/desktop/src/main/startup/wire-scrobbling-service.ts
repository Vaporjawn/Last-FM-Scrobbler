import { gateScrobblingEnabled } from "../scrobbling/gate-scrobbling-enabled.js";
import { wireScrobbling } from "../scrobbling/wire-scrobbling.js";
import type { createSettingsStore } from "../settings/settings-store.js";
import { createLibrefmClientGetter } from "./create-librefm-client-getter.js";
import { createListenbrainzClientGetter } from "./create-listenbrainz-client-getter.js";
import { createScrobbleFailureNotifier } from "./create-scrobble-failure-notifier.js";
import { createScrobbledNotifier } from "./create-scrobbled-notifier.js";
import type { LastfmServices } from "./lastfm-services.js";
import type { ScrobblingService } from "./scrobbling-service.js";
import type { SecretStores } from "./secret-stores.js";

/** What `wireScrobblingService` needs from the rest of startup. */
export interface WireScrobblingServiceOptions {
  readonly secretStores: SecretStores;
  readonly lastfmServices: LastfmServices;
  readonly settingsStore: ReturnType<typeof createSettingsStore>;
  readonly notificationIconOption: { readonly icon?: string };
}

/**
 * Wires scrobbling to Last.fm, Libre.fm and ListenBrainz and returns the callbacks the main
 * window's `Tracker` should call, already gated on `AppSettings.scrobblingEnabled`. Returns
 * an empty service when secure storage is unavailable.
 */
export function wireScrobblingService(options: WireScrobblingServiceOptions): ScrobblingService {
  const { secretStores, lastfmServices, settingsStore, notificationIconOption } = options;
  const { accountStore, scrobbleQueue, networkStatus, lastfmClient, createSessionClient } =
    lastfmServices;

  // Gated on accountStore alone (secure storage being available at all), not also on
  // lastfmClient/createSessionClient — those two require *Last.fm* credentials
  // specifically, but scrobbling should still run when only Libre.fm and/or
  // ListenBrainz end up connected and Last.fm has none configured. accountStore and
  // librefmAccountStore/listenbrainzAccountStore all share one safeStorage instance,
  // so they're either all defined or all undefined together — this one check stands
  // in for "is secure storage available" generally, not just for Last.fm.
  if (!(accountStore && scrobbleQueue && networkStatus)) {
    return {};
  }

  const scrobbling = wireScrobbling({
    queue: scrobbleQueue,
    networkStatus,
    ...(lastfmClient && createSessionClient ? { accountStore, createSessionClient } : {}),
    additionalServices: [
      { id: "librefm", getClient: createLibrefmClientGetter(secretStores) },
      { id: "listenbrainz", getClient: createListenbrainzClientGetter(secretStores) },
    ],
    onScrobbled: createScrobbledNotifier(settingsStore, notificationIconOption),
    onScrobbleFailed: createScrobbleFailureNotifier(settingsStore, notificationIconOption),
  });

  // Gates both callbacks on AppSettings.scrobblingEnabled, read fresh on every
  // event — see gate-scrobbling-enabled.ts's own docstring for why this lives here,
  // right at the seam between wireNowPlaying's Tracker callbacks and wireScrobbling's
  // enqueue/updateNowPlaying calls, rather than baked into the CompiledFilter below
  // (which can't be swapped after startup — this setting needs to be, with no
  // restart).
  const gatedScrobbling = gateScrobblingEnabled({
    onScrobbleEligible: scrobbling.onScrobbleEligible,
    // Pushes a real-time "now playing" update to Last.fm on every new track — see
    // wire-scrobbling.ts's ScrobblingHandle.onTrackChanged docstring for why this is
    // separate from onScrobbleEligible above (different timeline, best-effort).
    onTrackChanged: (event) => {
      void scrobbling.onTrackChanged(event);
    },
    isScrobblingEnabled: () => settingsStore.get().scrobblingEnabled,
  });

  return {
    onScrobbleEligible: gatedScrobbling.onScrobbleEligible,
    onTrackChanged: gatedScrobbling.onTrackChanged,
    stop: () => {
      scrobbling.stop();
      scrobbleQueue.close();
    },
  };
}
