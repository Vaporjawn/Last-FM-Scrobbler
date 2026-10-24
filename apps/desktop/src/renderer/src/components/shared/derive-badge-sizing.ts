/**
 * `size * 0.25 + 2` for the star's `fontSize` and `fontSize / 11` for its padding —
 * chosen because that's the exact line through this component's two original call
 * sites (14px icon / 1px padding at a 48px avatar in `FriendListItem`, 22px icon /
 * 2px padding at an 80px avatar in `ProfilePage`), so both keep their current
 * appearance pixel-for-pixel while a future third avatar size gets a badge that's
 * proportionally consistent with both rather than a guessed one-off value.
 */
export function deriveBadgeSizing(avatarSize: number): { fontSize: number; padding: number } {
  const fontSize = avatarSize * 0.25 + 2;
  return { fontSize, padding: fontSize / 11 };
}
