export interface RealNameAndLocationSource {
  readonly realName?: string;
  readonly location?: string;
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
  const parts = [source.realName, source.location].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
