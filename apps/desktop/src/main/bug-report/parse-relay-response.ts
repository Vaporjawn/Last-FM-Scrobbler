import { type RelayResponse } from "./relay-response.js";

/** Narrows the relay's reply to the two fields this app uses. The link in it is later
 * shown to the user and opened, so it must be an https URL — whatever the relay (or
 * something impersonating it) sends back. */
export function parseRelayResponse(payload: unknown): RelayResponse {
  if (typeof payload === "object" && payload !== null) {
    const { issueUrl, issueNumber } = payload as Record<string, unknown>;
    if (typeof issueUrl === "string" && typeof issueNumber === "number") {
      try {
        if (new URL(issueUrl).protocol === "https:") {
          return { issueUrl, issueNumber };
        }
      } catch {
        // Not a URL at all — falls through to the error below.
      }
    }
  }
  throw new Error("The bug report relay sent back a response this app could not understand.");
}
