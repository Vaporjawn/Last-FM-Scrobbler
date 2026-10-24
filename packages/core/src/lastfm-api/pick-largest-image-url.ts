import { type LastfmImageJson } from "./lastfm-image-json.js";

/** Picks the largest non-empty image URL out of a Last.fm `image` array. Last.fm
 * returns an empty `#text` (not a missing entry) for every size when there's no real
 * image to serve, so this has to check for that rather than just taking the first
 * entry — an empty string is still "present". `undefined` if every size is empty, the
 * array is empty, or missing entirely. */
export function pickLargestImageUrl(
  images: readonly LastfmImageJson[] | undefined,
): string | undefined {
  if (!images) {
    return undefined;
  }
  const bySize = new Map(images.map((image) => [image.size, image["#text"]]));
  for (const size of ["mega", "extralarge", "large", "medium", "small"]) {
    const url = bySize.get(size);
    if (url) {
      return url;
    }
  }
  // Fallback for any size label not in the list above, in case Last.fm ever adds one.
  return images.find((image) => image["#text"])?.["#text"];
}
