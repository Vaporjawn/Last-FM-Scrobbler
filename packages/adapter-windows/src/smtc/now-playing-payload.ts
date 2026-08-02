/**
 * Raw JSON shape emitted by the native `SmtcHelper` process, one object per line (or
 * the literal `null` when nothing is the current SMTC session) — see
 * `native/SmtcHelper/Program.cs`'s `NowPlayingSnapshot` for the producing side.
 */
export interface NowPlayingPayload {
  readonly title?: string | null;
  readonly artist?: string | null;
  readonly album?: string | null;
  readonly albumArtist?: string | null;
  /** Seconds. */
  readonly durationSec?: number | null;
  /** Seconds. */
  readonly elapsedSec?: number | null;
  /** The C# enum member name: "Closed" | "Opened" | "Changing" | "Stopped" | "Playing" | "Paused". */
  readonly playbackStatus?: string | null;
  /** Application User Model ID of the app that owns this session, e.g. "Spotify.exe". */
  readonly sourceAppUserModelId?: string | null;
}
