/** Thrown by `AuthFlow.authenticate()` when the user never clicks "Allow Access" on
 * Last.fm's own authorization page within the configured poll window. */
export class AuthTimeoutError extends Error {
  /** Sets the fixed message and the `AuthTimeoutError` name so callers can recognise it. */
  constructor() {
    super("Timed out waiting for the user to authorize this application on Last.fm");
    this.name = "AuthTimeoutError";
  }
}
