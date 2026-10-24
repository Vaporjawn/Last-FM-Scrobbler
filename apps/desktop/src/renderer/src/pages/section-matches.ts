/** Case-insensitive substring match against every non-empty candidate — used to
 * decide whether a section stays visible for the current search query. Empty query
 * always matches (nothing typed yet = show everything). */
export function sectionMatches(query: string, ...candidates: (string | undefined)[]): boolean {
  if (!query) {
    return true;
  }
  return candidates.some((candidate) => candidate?.toLowerCase().includes(query));
}
