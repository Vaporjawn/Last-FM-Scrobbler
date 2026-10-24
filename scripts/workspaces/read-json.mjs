import { readFileSync } from "node:fs";

/**
 * Reads and parses a JSON file. Throws if the file is missing or is not valid JSON.
 *
 * @param {string} path Absolute path of the file to read.
 * @returns {any} The parsed JSON value.
 */
export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
