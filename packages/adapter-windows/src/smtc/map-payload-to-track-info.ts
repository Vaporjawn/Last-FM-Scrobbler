import type { TrackInfo } from "@lastfm-scrobbler/shared-types";
import type { NowPlayingPayload } from "./now-playing-payload.js";

/**
 * Maps a raw `SmtcHelper` payload to a `TrackInfo`, or `null` when either mandatory
 * field this adapter relies on — `title` or `sourceAppUserModelId` — is missing. Unlike
 * macOS/MediaRemote, SMTC's `MediaProperties` has no field that's spec-guaranteed
 * non-null, so both are treated as mandatory defensively.
 */
export function mapPayloadToTrackInfo(payload: NowPlayingPayload): TrackInfo | null {
  const title = payload.title;
  const sourceApp = payload.sourceAppUserModelId;
  if (!title || !sourceApp) {
    return null;
  }

  const durationSec =
    typeof payload.durationSec === "number" && payload.durationSec > 0
      ? payload.durationSec
      : undefined;

  return {
    title,
    artist: payload.artist ?? "",
    ...(payload.album ? { album: payload.album } : {}),
    ...(payload.albumArtist ? { albumArtist: payload.albumArtist } : {}),
    ...(durationSec !== undefined ? { durationSec } : {}),
    sourceApp,
    isStream: durationSec === undefined,
  };
}
