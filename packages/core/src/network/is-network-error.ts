/** Node/undici connection-level error codes that mean "the request never reached a
 * server at all" — as opposed to a server responding with an error, which is an
 * application-level failure (see this file's own docstring below). */
const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ECONNRESET",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

/** Recursively walks `error.code` and, failing that, `error.cause` (Node's `fetch`/
 * undici nests the real connection error one or more `.cause` levels below the
 * `TypeError: fetch failed` it actually throws) looking for a string error code. */
function findErrorCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || error === null || typeof error !== "object") {
    return undefined;
  }
  const withCode = error as { readonly code?: unknown; readonly cause?: unknown };
  if (typeof withCode.code === "string") {
    return withCode.code;
  }
  return findErrorCode(withCode.cause, depth + 1);
}

/**
 * True only for a genuine connectivity-level failure — DNS, connection refused,
 * timeout, connection reset — as opposed to an application-level failure where a
 * request actually reached a server and got a real (if unwanted) response, e.g.
 * `LastfmApiError`/`ListenBrainzError`/`AuthTimeoutError`. Only the former should ever
 * flip `NetworkStatusMonitor`'s `online` flag to `false` — see that module's docstring.
 *
 * Node's `fetch` (undici-backed) throws a bare `TypeError: fetch failed` for a
 * connection-level failure, with the real errno-style code nested under `.cause` (one
 * or more levels deep) rather than on the top-level error itself — see `findErrorCode`.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = findErrorCode(error);
  if (code !== undefined) {
    return NETWORK_ERROR_CODES.has(code);
  }
  return error.name === "TypeError" && error.message === "fetch failed";
}
