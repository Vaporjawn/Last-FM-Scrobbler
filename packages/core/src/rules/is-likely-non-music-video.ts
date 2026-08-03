/** Substrings matched case-insensitively against `TrackInfo.sourceApp` to decide
 * whether a play came from a general-purpose web browser (as opposed to a dedicated
 * music app like Spotify/Apple Music/VLC) — the population this heuristic exists to
 * narrow itself to, see `isLikelyNonMusicVideo`'s docstring. Deliberately substrings,
 * not exact matches: `sourceApp`'s exact shape differs per platform/adapter (macOS
 * bundle IDs like `"com.google.Chrome"`, Linux MPRIS bus-name suffixes like
 * `"firefox"`/`"chromium"` — see `adapter-linux/src/mpris/derive-source-app-from-bus-name.ts`,
 * Windows AUMIDs — unverified exact shape on this sandbox, see
 * `docs/modules/desktop.md`'s Windows caveats) but every one of them has been
 * observed/documented to contain one of these tokens somewhere. */
const BROWSER_SOURCE_APP_TOKENS = [
  "chrome",
  "chromium",
  "safari",
  "firefox",
  "edge",
  "brave",
  "opera",
  "vivaldi",
] as const;

/** Conservative default: comfortably longer than the overwhelming majority of real
 * songs (radio edits run 2-5 minutes; even long album tracks, extended mixes, and
 * classical movements rarely clear this) while still well short of typical long-form
 * video content (podcasts, talks, gameplay, video essays) this heuristic exists to
 * catch — see this module's own docstring for why duration is the only reliable
 * signal available at all. Exposed as `AppSettings.nonMusicVideoThresholdSec` (Settings
 * → Filter) for anyone who wants it tighter or looser than this default. */
export const DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC = 900; // 15 minutes

export interface LikelyNonMusicVideoInput {
  readonly sourceApp: string;
  /** Omitted (not just missing on `TrackInfo`) tracks — e.g. live radio streams with
   * no fixed length — are never flagged; there's no duration to threshold against,
   * and a stream is already excluded from scrobbling by other means when relevant
   * (see `Tracker`/`isEligibleForScrobble`). */
  readonly durationSec?: number;
}

export interface LikelyNonMusicVideoOptions {
  readonly thresholdSec?: number;
}

/**
 * Best-effort heuristic for "this is probably a long-form video, not a single music
 * track" — **not** a real YouTube-vs-YouTube-Music classifier, because no such
 * classifier is possible from the data this app actually has access to.
 *
 * Verified live (Playwright, real youtube.com and music.youtube.com pages, not
 * assumed): a regular YouTube video and a YouTube Music track expose **structurally
 * identical** `navigator.mediaSession.metadata` — both set `artist`/`title`/a single `artwork`
 * entry, and, critically, both set `album` to an empty string (not "present for
 * music, absent for video" as originally assumed — that assumption was checked
 * against real pages and found false before writing this). Since every platform
 * adapter in this app (`packages/adapter-macos`/`-windows`/`-linux`) only ever
 * receives whatever the browser forwards from that same Media Session API, there is
 * no field this app could read that reliably says "this is music" — the two are
 * indistinguishable at the metadata level, full stop.
 *
 * Duration is the one signal that *is* available and *does* correlate with the
 * actual complaint ("long YouTube videos getting scrobbled") — because
 * `isEligibleForScrobble`'s 240-second cap means even a two-hour video becomes
 * scrobble-eligible after just 4 minutes of playback, with nothing today stopping
 * that. Scoped to browser sources specifically (`sourceApp` containing a known
 * browser token — see `BROWSER_SOURCE_APP_TOKENS`) rather than applying to every
 * source: a genuinely long track in a dedicated music app (a DJ mix, a classical
 * movement, an ambient piece someone deliberately added to their library) is far
 * more likely to be real music than the same duration playing in a browser tab.
 */
export function isLikelyNonMusicVideo(
  input: LikelyNonMusicVideoInput,
  options: LikelyNonMusicVideoOptions = {},
): boolean {
  const { durationSec, sourceApp } = input;
  if (durationSec === undefined) {
    return false;
  }
  const thresholdSec = options.thresholdSec ?? DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC;
  if (durationSec < thresholdSec) {
    return false;
  }
  const sourceAppLower = sourceApp.toLowerCase();
  return BROWSER_SOURCE_APP_TOKENS.some((token) => sourceAppLower.includes(token));
}
