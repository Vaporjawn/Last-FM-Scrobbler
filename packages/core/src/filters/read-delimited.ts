import { FilterSyntaxError } from "./filter-syntax-error.js";

/** Reads a delimiter-terminated literal body starting at `start` (just past the opening
 * delimiter), supporting `\<delimiter>` and `\\` as escapes so the literal can contain
 * its own delimiter (e.g. a regex matching a URL needs a literal `/`: `/^https:\/\//`)
 * or a literal backslash. Any other backslash sequence (e.g. `\d`, `\s` inside a regex
 * body) is left completely untouched — it's not this lexer's escape to interpret, it's
 * regex syntax that `parser.ts` passes straight into `new RegExp(...)`. */
export function readDelimited(
  input: string,
  start: number,
  delimiter: string,
): { text: string; next: number } {
  let j = start;
  let text = "";
  let char = input[j];
  while (char !== undefined && char !== delimiter) {
    const next = input[j + 1];
    if (char === "\\" && (next === delimiter || next === "\\")) {
      text += next;
      j += 2;
      char = input[j];
      continue;
    }
    text += char;
    j += 1;
    char = input[j];
  }
  if (char === undefined) {
    throw new FilterSyntaxError(`unterminated ${delimiter === '"' ? "string" : "regex"} literal`);
  }
  return { text, next: j + 1 };
}
