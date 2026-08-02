import { createHash } from "node:crypto";

const UNSIGNED_PARAMS = new Set(["format", "callback"]);

/**
 * Computes a Last.fm `api_sig` per https://www.last.fm/api/authspec: sort every
 * parameter (except `format`/`callback`) alphabetically by name, concatenate as
 * `<name><value>` pairs, append the shared secret, and MD5-hash the result.
 */
export function signRequest(params: Readonly<Record<string, string>>, secret: string): string {
  const names = Object.keys(params)
    .filter((name) => !UNSIGNED_PARAMS.has(name))
    .sort();

  const concatenated = names.map((name) => `${name}${params[name]}`).join("");
  return createHash("md5")
    .update(concatenated + secret, "utf8")
    .digest("hex");
}
