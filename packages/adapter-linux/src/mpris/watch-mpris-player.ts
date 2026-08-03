import type { MessageBus } from "dbus-next";
import type { PlaybackState, TrackInfo, Unsubscribe } from "@lastfm-scrobbler/shared-types";
import { callDBusMethod } from "./call-dbus-method.js";
import { deriveSourceAppFromBusName } from "./derive-source-app-from-bus-name.js";
import { mapMetadataToTrackInfo } from "./map-metadata-to-track-info.js";
import { mapPlaybackStatus } from "./map-playback-status.js";
import { MPRIS_PATH, PLAYER_IFACE, PROPERTIES_IFACE } from "./mpris-dbus-names.js";
import { unwrapVariant } from "./unwrap-variant.js";

/** Coerces a value to a plain object, defaulting to `{}` for anything else (including arrays). */
function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Connects to one MPRIS player's `Player` interface at `busName`, fetches its current
 * state, and subscribes to further changes. Calls `onUpdate` once immediately with the
 * initial state and again on every `PropertiesChanged` signal that touches `Metadata`
 * or `PlaybackStatus`. Returns an `Unsubscribe` that stops listening (does not affect
 * the player itself).
 *
 * Throws if the player can't be reached (e.g. it closed between being discovered and
 * being watched) — the caller is responsible for treating that as "this player is
 * gone" rather than a fatal adapter error, since player lifecycle on a real desktop is
 * inherently racy.
 */
export async function watchMprisPlayer(
  bus: MessageBus,
  busName: string,
  onUpdate: (track: TrackInfo | null, state: PlaybackState) => void,
): Promise<Unsubscribe> {
  const sourceApp = deriveSourceAppFromBusName(busName);
  const obj = await bus.getProxyObject(busName, MPRIS_PATH);
  const properties = obj.getInterface(PROPERTIES_IFACE);

  const initial = (await callDBusMethod(properties, "GetAll", PLAYER_IFACE)) as Record<
    string,
    unknown
  >;
  let currentMetadata = asRecord(unwrapVariant(initial.Metadata));
  let currentStatus = asStringOrUndefined(unwrapVariant(initial.PlaybackStatus));

  const emit = (): void => {
    onUpdate(mapMetadataToTrackInfo(currentMetadata, sourceApp), mapPlaybackStatus(currentStatus));
  };
  emit();

  /** Per the D-Bus Properties spec, a player may report a property changed by listing
   * its name in `PropertiesChanged`'s third ("invalidated") argument instead of
   * inlining the new value in the second — typically for expensive-to-serialize
   * properties. The signal alone carries no new value in that case, so this re-fetches
   * via `GetAll` for whichever of our two fields of interest were invalidated. */
  async function refetchInvalidated(fields: readonly string[]): Promise<void> {
    try {
      const latest = (await callDBusMethod(properties, "GetAll", PLAYER_IFACE)) as Record<
        string,
        unknown
      >;
      if (fields.includes("Metadata")) {
        currentMetadata = asRecord(unwrapVariant(latest.Metadata));
      }
      if (fields.includes("PlaybackStatus")) {
        currentStatus = asStringOrUndefined(unwrapVariant(latest.PlaybackStatus));
      }
      emit();
    } catch {
      // The player may have vanished between the invalidation signal and this
      // refetch — same "player lifecycle on a real desktop is racy" tolerance this
      // whole module already applies elsewhere; not a fatal adapter error.
    }
  }

  const listener = (
    interfaceName: string,
    changed: Record<string, unknown>,
    invalidated: string[],
  ): void => {
    if (interfaceName !== PLAYER_IFACE) {
      return;
    }
    let changedRelevantField = false;
    if ("Metadata" in changed) {
      currentMetadata = asRecord(unwrapVariant(changed.Metadata));
      changedRelevantField = true;
    }
    if ("PlaybackStatus" in changed) {
      currentStatus = asStringOrUndefined(unwrapVariant(changed.PlaybackStatus));
      changedRelevantField = true;
    }

    const relevantInvalidated = invalidated.filter(
      (name) => name === "Metadata" || name === "PlaybackStatus",
    );
    if (relevantInvalidated.length > 0) {
      void refetchInvalidated(relevantInvalidated);
      return;
    }

    if (changedRelevantField) {
      emit();
    }
  };

  properties.on("PropertiesChanged", listener);
  return () => {
    properties.off("PropertiesChanged", listener);
  };
}
