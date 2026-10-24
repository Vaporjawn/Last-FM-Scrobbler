import type { TrackInfo } from "@lastfm-scrobbler/shared-types";
import { type NowPlayingPayload } from "./now-playing-payload.js";

/** Converts one raw payload into a `TrackInfo`, or `undefined` for an invalid/empty one. */
export function toTrackInfo(payload: NowPlayingPayload): TrackInfo | undefined {
  if (!payload.title) {
    return undefined;
  }
  // `!== undefined` isn't enough here: the vendored native adapter's diff protocol
  // legitimately emits a JSON `null` for a field that momentarily disappears while
  // the track identity stays the same (see stream.m's `createDiff`, which sets a
  // removed key to `NSNull`) — `duration`/`elapsedTime` are not among the fields it
  // preserves across polls, so a `{"duration":null}` diff is a real, observed shape,
  // not a hypothetical one. Passing `null` through as `durationSec` would violate the
  // `number | undefined` `TrackInfo` contract, so this only accepts a real number.
  const durationSec = typeof payload.duration === "number" ? payload.duration : undefined;
  return {
    title: payload.title,
    artist: payload.artist ?? "",
    ...(payload.album !== undefined ? { album: payload.album } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
    sourceApp: payload.bundleIdentifier ?? "unknown",
    isStream: Boolean(payload.radioStationIdentifier ?? payload.radioStationHash),
  };
}
