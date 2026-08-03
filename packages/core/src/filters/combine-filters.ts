import type { CompiledFilter } from "./filter-expression.js";
import type { FilterableTrack } from "./filterable-track.js";

/**
 * Combines multiple `CompiledFilter`s (e.g. a user-written expression from Settings →
 * Filter, plus the built-in `isLikelyNonMusicVideo` heuristic — see
 * `main/index.ts`'s `compileFilterExpression`) into one, with OR semantics: a track is
 * excluded if it matches *any* of them. This is what "exclude" composability should
 * mean here — each filter is an independent reason to drop a track, not a condition
 * that must hold alongside every other one (AND semantics would make each additional
 * filter exclude *less*, the opposite of what turning more exclusion rules on should
 * do).
 *
 * Returns a filter that matches nothing when `filters` is empty, so callers don't need
 * a separate `filters.length === 0 ? undefined : combineFilters(filters)` guard unless
 * they specifically want to avoid handing `Tracker` a filter at all when there's
 * nothing to combine (see `main/index.ts`, which does want that — a `filter: undefined`
 * skips the check entirely rather than paying for a `.test()` call that can never
 * match).
 */
export function combineFilters(filters: readonly CompiledFilter[]): CompiledFilter {
  return {
    test: (track: FilterableTrack) => filters.some((filter) => filter.test(track)),
  };
}
