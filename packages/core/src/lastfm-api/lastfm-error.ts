/** Thrown for any Last.fm API response of the form `{ error, message }`. */
export class LastfmApiError extends Error {
  readonly code: number;

  /**
   * Creates the error from the `{ error, message }` pair of a Last.fm error response.
   *
   * @param code - Last.fm's numeric error code (e.g. 14 for a token not yet authorized).
   * @param message - Last.fm's own error message.
   */
  constructor(code: number, message: string) {
    super(message);
    this.name = "LastfmApiError";
    this.code = code;
  }
}
