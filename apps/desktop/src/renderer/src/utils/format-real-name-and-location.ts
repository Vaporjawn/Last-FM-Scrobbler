export interface RealNameAndLocationSource {
  readonly realName?: string;
  readonly location?: string;
}

/**
 * `true` for a field that's actually worth displaying — present, and not just the
 * literal word "none" (case-insensitive, surrounding whitespace ignored). Last.fm
 * doesn't validate either field's freeform text (see `Friend.location`'s docstring),
 * and confirmed live: some accounts have literally typed "None" into their location
 * rather than leaving it unset, which otherwise rendered as an unhelpful, seemingly
 * system-generated "None" right in the friends list — every *other* unset field on
 * this type is simply omitted, so a real, if unusually-typed, "None" reads as
 * inconsistent (worse than showing nothing) rather than as genuine user content.
 */
function isMeaningful(part: string | undefined): part is string {
  // Early `return false` on `undefined`, not a `Boolean(part) && ...` one-liner — a
  // function-call truthiness check doesn't narrow `part`'s type for TypeScript the
  // way a direct comparison does, so `Boolean(part) && part.trim()` left `part`
  // typed as `string | undefined` one line after supposedly having just confirmed
  // it wasn't. An early return does narrow correctly for everything after it.
  if (part === undefined) {
    return false;
  }
  // Also excludes an empty-after-trim string (not just "none") — an all-whitespace
  // or empty `part` is exactly as uninformative as an explicit "none" would be, and
  // the original pre-"none"-filtering code (a bare `Boolean(part)` check) already
  // excluded it; this preserves that.
  const normalized = part.trim().toLowerCase();
  return normalized !== "" && normalized !== "none";
}

/**
 * Combines `realName` and `location` onto one line ("Real Name · Location"), rather
 * than a separate line per field — falls back to whichever one is actually present,
 * and to `undefined` (no line at all) when neither is. Shared between `FriendListItem`
 * (a `Friend`) and `ProfilePage`'s account card (a `UserProfile`) — both types happen
 * to shape these two fields identically, so this takes a minimal structural source
 * rather than either concrete type, and works for both without either needing to
 * import the other's type.
 */
export function formatRealNameAndLocation(source: RealNameAndLocationSource): string | undefined {
  const parts = [source.realName, source.location].filter(isMeaningful);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
