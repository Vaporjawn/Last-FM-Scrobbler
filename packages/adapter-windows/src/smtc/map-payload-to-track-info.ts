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
    // SMTC has no dedicated "this is a live stream/radio" field the way macOS's
    // MediaRemote does (`radioStationIdentifier`/`radioStationHash`) — deriving this
    // from "no duration reported" used to misclassify an ordinary track queried
    // before `TimelineProperties` populates as a stream, while the exact same content
    // on macOS was correctly `isStream: false`. Without a real signal to key off,
    // `false` is the honest default: "duration unknown" and "is a stream" are two
    // distinct concepts that shouldn't be conflated just because this adapter has no
    // explicit indicator yet (mirrors packages/adapter-linux's identical fix).
    isStream: false,
  };
}
