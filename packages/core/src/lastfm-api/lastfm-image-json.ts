/**
 * One entry of the `image` array Last.fm attaches to users, albums and artists: a size
 * label (e.g. `"small"`, `"extralarge"`) and the image URL, which Last.fm keys as
 * `"#text"`. The URL is an empty string when there is no image at that size.
 */
export interface LastfmImageJson {
  readonly size: string;
  readonly "#text": string;
}
