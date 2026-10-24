import {
  combineFilters,
  compileFilter,
  FilterSyntaxError,
  isLikelyNonMusicVideo,
  type CompiledFilter,
  type Logger,
} from "@lastfm-scrobbler/core";

/** The two settings that decide which tracks the exclusion filter drops. */
export interface CompileFilterExpressionOptions {
  /** `AppSettings.filterExpression`; empty or `undefined` means no custom filter. */
  readonly filterExpression: string | undefined;
  /** `AppSettings.skipNonMusicVideos`: also drop long browser-sourced plays. */
  readonly skipNonMusicVideos: boolean;
}

/**
 * Compiles `Tracker`'s exclusion filter from `AppSettings.filterExpression` and
 * `AppSettings.skipNonMusicVideos` combined (excluded by *either*, not both — see
 * `combineFilters`) — `undefined` when neither is active, whether because both
 * settings are unset/off or because the expression failed to compile. An invalid
 * expression is logged as a warning rather than crashing the tracker or blocking
 * startup — Settings → Filter validates before saving (see
 * `main/filters/wire-filter-validation.ts`), but this is the last line of defense
 * against a value edited by hand in settings.json outside the app.
 */
export function compileFilterExpression(
  options: CompileFilterExpressionOptions,
  logger: Logger,
): CompiledFilter | undefined {
  const filters: CompiledFilter[] = [];

  if (options.filterExpression) {
    try {
      filters.push(compileFilter(options.filterExpression));
    } catch (error) {
      const message = error instanceof FilterSyntaxError ? error.message : String(error);
      logger.warn(`Settings → Filter: invalid expression, ignoring it — ${message}`);
    }
  }

  if (options.skipNonMusicVideos) {
    // See isLikelyNonMusicVideo's docstring for the full reasoning — a browser-sourced
    // play longer than DEFAULT_NON_MUSIC_VIDEO_THRESHOLD_SEC, most often a long-form
    // YouTube video rather than an actual song.
    filters.push({ test: (track) => isLikelyNonMusicVideo(track) });
  }

  return filters.length > 0 ? combineFilters(filters) : undefined;
}
