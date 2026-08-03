import { useCallback, useEffect, useState } from "react";
import type { ActionResult } from "./action-result.js";
import { fail } from "./fail.js";
import { ok } from "./ok.js";

export interface UseTrackActionsResult {
  /**
   * Reflects `initialLoved` (see below) plus any clicks made in this session. For the
   * currently-playing track, callers have no real signal to pass (that needs
   * `track.getInfo` with a username, which isn't wired up) and this starts `false`, a
   * best-effort guess rather than a value read from Last.fm.
   */
  readonly loved: boolean;
  readonly submitting: boolean;
  readonly error: string | undefined;
  readonly toggleLove: () => Promise<ActionResult>;
  readonly addTags: (tags: readonly string[]) => Promise<ActionResult>;
}

const NOT_AVAILABLE = "Nothing is playing right now.";

/**
 * Wraps `window.lastfm`'s `loveTrack`/`unloveTrack`/`addTags` (see
 * `src/shared/lastfm-api.ts`) for whichever track is passed in — typically the
 * currently-playing one, or one row of a track list. All three reject when no account
 * is logged in; callers surface `error` rather than this hook throwing. Inert (methods
 * no-op) when `artist`/`track` are undefined (nothing playing) or `window.lastfm`
 * isn't present.
 *
 * @param initialLoved Seeds `loved` — pass real per-track data when the caller has it
 * (e.g. `RecentTrack.loved` from `user.getRecentTracks`'s `extended=1` mode, on the
 * Scrobbles page). Defaults to `false`, the best-effort guess used for the
 * currently-playing track, which has no such signal available.
 */
export function useTrackActions(
  artist: string | undefined,
  track: string | undefined,
  initialLoved = false,
): UseTrackActionsResult {
  const [loved, setLoved] = useState(initialLoved);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // A new track (or fresh data for the same one) resets to whatever the caller now
  // knows to be true, rather than an inherited guess from whatever track this hook was
  // previously bound to.
  useEffect(() => {
    setLoved(initialLoved);
    setError(undefined);
  }, [artist, track, initialLoved]);

  const toggleLove = useCallback(async (): Promise<ActionResult> => {
    if (!artist || !track || !window.lastfm) {
      return fail(NOT_AVAILABLE);
    }
    const next = !loved;
    setSubmitting(true);
    setError(undefined);
    try {
      if (next) {
        await window.lastfm.loveTrack(artist, track);
      } else {
        await window.lastfm.unloveTrack(artist, track);
      }
      setLoved(next);
      return ok();
    } catch (submitError) {
      const result = fail(submitError);
      setError(result.error);
      return result;
    } finally {
      setSubmitting(false);
    }
  }, [artist, track, loved]);

  const addTags = useCallback(
    async (tags: readonly string[]): Promise<ActionResult> => {
      if (!artist || !track || !window.lastfm || tags.length === 0) {
        return fail(NOT_AVAILABLE);
      }
      setSubmitting(true);
      setError(undefined);
      try {
        await window.lastfm.addTags(artist, track, tags);
        return ok();
      } catch (submitError) {
        const result = fail(submitError);
        setError(result.error);
        return result;
      } finally {
        setSubmitting(false);
      }
    },
    [artist, track],
  );

  return { loved, submitting, error, toggleLove, addTags };
}
