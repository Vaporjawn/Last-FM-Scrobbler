# 0005: Multi-source and track-identity policy

## Status

Accepted

## Context

foo_scrobbler_mac never had to handle more than one playback source, since it lived
inside exactly one player. Both MPRIS (multiple registered players) and SMTC (multiple
sessions) can report more than one active source at once. Separately, "duplicate
scrobble prevention" was on the original feature list, but nothing defined what makes
two plays "the same track" once metadata is coming from an OS media session instead of
foobar2000's own tag database.

## Decision

- **Multiple sources:** an adapter reports whichever session is actively `Playing` and
  most-recently-changed; if several are simultaneously `Playing`, the most recently
  *started* one wins. A "preferred source app" override is a reasonable future
  Preferences addition.
- **Track identity:** normalized `artist` + normalized `title` + `album` (if present),
  bucketed by the playback session's start time. "Normalized" means case-folded and
  whitespace-trimmed — good enough to dedup, not a MusicBrainz-grade match.
- **Filter DSL replaces Title Formatting:** foobar2000's Title Formatting language
  doesn't exist outside foobar2000. Replaced with a small expression syntax over the
  standard fields OS media sessions expose (`artist`, `title`, `album`, `albumArtist`,
  `durationSec`, `sourceApp`), e.g. `sourceApp == "firefox" or title matches /^Ad: /`.
  This also replaces the reference client's "excluded directories" preference (we don't
  scan a local library, so exclusion is by source app / filter expression instead of
  filesystem path).

## Consequences

- No filesystem access is required anywhere in the scrobbling pipeline.
- The filter DSL's grammar still needs to be designed in detail when `packages/core`'s
  `filters` module is actually implemented — this ADR fixes the *fields* it operates
  over, not the full syntax.
