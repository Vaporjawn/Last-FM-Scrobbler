/** Pattern-matched against a raw `sourceApp` value — order matters where patterns could
 * both match (e.g. `\bchrome\b` before a hypothetical broader browser pattern). */
const KNOWN_SOURCE_APPS: readonly { readonly pattern: RegExp; readonly name: string }[] = [
  { pattern: /apple.?music|com\.apple\.music/i, name: "Apple Music" },
  { pattern: /spotify/i, name: "Spotify" },
  { pattern: /itunes/i, name: "iTunes" },
  { pattern: /\bvlc\b/i, name: "VLC" },
  { pattern: /rhythmbox/i, name: "Rhythmbox" },
  { pattern: /foobar/i, name: "foobar2000" },
  { pattern: /firefox/i, name: "Firefox" },
  { pattern: /\bchrome\b/i, name: "Chrome" },
  { pattern: /safari/i, name: "Safari" },
  { pattern: /\bedge\b/i, name: "Edge" },
];

/**
 * `TrackInfo.sourceApp` is a raw, platform-specific identifier (a macOS bundle ID, a
 * Windows AUMID, or an MPRIS bus name on Linux — see `packages/shared-types`) — not
 * something to show a user as-is. This maps the common cases to a friendly display
 * name for the "Scrobbling from …" header, falling back to the raw value for anything
 * unrecognized rather than hiding it.
 */
export function resolveSourceAppName(sourceApp: string): string {
  const known = KNOWN_SOURCE_APPS.find(({ pattern }) => pattern.test(sourceApp));
  return known ? known.name : sourceApp;
}
