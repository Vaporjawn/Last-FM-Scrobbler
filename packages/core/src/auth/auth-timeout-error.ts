/** Thrown by `AuthFlow.authenticate()` when the user never clicks "Allow Access" on
 * Last.fm's own authorization page within the configured poll window. */
export class AuthTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for the user to authorize this application on Last.fm");
    this.name = "AuthTimeoutError";
  }
}
