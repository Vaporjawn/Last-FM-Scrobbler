/** Recursively walks `error.code` and, failing that, `error.cause` (Node's `fetch`/
 * undici nests the real connection error one or more `.cause` levels below the
 * `TypeError: fetch failed` it actually throws) looking for a string error code. */
export function findErrorCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || error === null || typeof error !== "object") {
    return undefined;
  }
  const withCode = error as { readonly code?: unknown; readonly cause?: unknown };
  if (typeof withCode.code === "string") {
    return withCode.code;
  }
  return findErrorCode(withCode.cause, depth + 1);
}
