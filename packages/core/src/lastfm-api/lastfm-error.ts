/** Thrown for any Last.fm API response of the form `{ error, message }`. */
export class LastfmApiError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "LastfmApiError";
    this.code = code;
  }
}
