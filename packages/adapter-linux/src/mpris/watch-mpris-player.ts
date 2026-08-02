import type { MessageBus } from "dbus-next";
import { mapMetadataToTrackInfo } from "./map-metadata-to-track-info.js";
import { mapPlaybackStatus } from "./map-playback-status.js";
import { deriveSourceAppFromBusName } from "./derive-source-app-from-bus-name.js";
import { callDBusMethod } from "./call-dbus-method.js";
import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

export const MPRIS_PATH = "/org/mpris/MediaPlayer2";
export const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";
export const PROPERTIES_IFACE = "org.freedesktop.DBus.Properties";

export type Unsubscribe = () => void;

/** Unwraps a dbus-next `Variant` if present; passes plain values through unchanged. */
export function unwrapVariant(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return value;
}

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

  const listener = (
    interfaceName: string,
    changed: Record<string, unknown>,
    _invalidated: string[],
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
    if (changedRelevantField) {
      emit();
    }
  };

  properties.on("PropertiesChanged", listener);
  return () => {
    properties.off("PropertiesChanged", listener);
  };
}
