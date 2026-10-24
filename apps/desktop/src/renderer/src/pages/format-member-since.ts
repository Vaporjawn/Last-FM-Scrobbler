/** "Member since March 2003" — built with the platform's own `Intl.DateTimeFormat`
 * rather than a date-formatting dependency; this app has none, and one label doesn't
 * warrant introducing one. */
export function formatMemberSince(registeredAtUnixSeconds: number): string {
  const date = new Date(registeredAtUnixSeconds * 1000);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}
