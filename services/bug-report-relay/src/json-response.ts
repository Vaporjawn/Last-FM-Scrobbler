/**
 * Builds a JSON `Response` with the given status. Every reply the relay sends, success
 * or failure, goes through this so the content type is always set.
 */
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
