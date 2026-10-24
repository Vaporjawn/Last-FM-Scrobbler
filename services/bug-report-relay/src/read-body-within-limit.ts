/** Largest request body accepted. The fields' own limits (`parse-bug-report-request.ts`)
 * add up to about 260k characters, which is at most a bit over 1 MiB as UTF-8; anything
 * bigger cannot be a valid report and is not read any further. */
const MAX_REQUEST_BYTES = 1_048_576;

/**
 * Reads the request body as text, giving up as soon as it exceeds `MAX_REQUEST_BYTES`
 * rather than buffering whatever the client chooses to send. `undefined` means "too big".
 * Checks the declared `content-length` first (cheap, rejects honest oversize clients
 * without reading anything), then counts what actually arrives, since the header can be
 * absent (chunked uploads) or simply wrong.
 */
export async function readBodyWithinLimit(request: Request): Promise<string | undefined> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    return undefined;
  }
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    received += value.byteLength;
    if (received > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return undefined;
    }
    text += decoder.decode(value, { stream: true });
  }
}
