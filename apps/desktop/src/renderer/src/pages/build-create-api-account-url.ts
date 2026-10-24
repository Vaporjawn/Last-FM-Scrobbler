/**
 * Pre-fills Last.fm's "create an API account" form via query string, so all the user
 * has to do is click "Submit" — no typing. **Best-effort, not independently
 * verified**: that form requires being logged in to Last.fm to view at all (Last.fm's
 * own login page handles that redirect before this URL is ever reached — nothing in
 * this app needs to broker it), and its real field `name` attributes couldn't be
 * inspected from here — `name`/`description`/`homepage` are a reasonable guess based
 * on the form's known labels (Application name / description / homepage), not a
 * confirmed contract. If these don't actually populate the form when tested live,
 * Last.fm uses different field names than guessed here; whoever notices should update
 * this against the real page source (view-source once logged in) rather than
 * re-guessing.
 */
export function buildCreateApiAccountUrl(): string {
  const url = new URL("https://www.last.fm/api/account/create");
  url.searchParams.set("name", "Last.fm Scrobbler");
  url.searchParams.set(
    "description",
    "Cross-platform desktop scrobbler — reads Now Playing from the OS media session " +
      "and submits scrobbles to Last.fm.",
  );
  url.searchParams.set("homepage", "https://github.com/Vaporjawn/Last-FM-Scrobbler");
  return url.toString();
}
