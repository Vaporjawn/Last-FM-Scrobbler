import { FilterSyntaxError } from "./filter-syntax-error.js";

export type TokenType =
  "ident" | "string" | "regex" | "number" | "op" | "lparen" | "rparen" | "eof";

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  /** Only set for `type: "regex"` tokens. */
  readonly flags?: string;
}

const TWO_CHAR_OPERATORS = new Set(["==", "!=", "<=", ">="]);
const IDENT_START = /[A-Za-z_]/;
const IDENT_CHAR = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

/** Lexes a raw filter expression string into a flat `Token[]` (identifiers, string/
 * regex/number literals, operators, parens), terminated by an `eof` token — the input
 * `parse` consumes to build the AST `evaluate` walks. Throws `FilterSyntaxError` on any
 * character sequence it doesn't recognize. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (ch === undefined) {
      break;
    }

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i += 1;
      continue;
    }

    if (ch === '"') {
      const result = readDelimited(input, i + 1, '"');
      tokens.push({ type: "string", value: result.text });
      i = result.next;
      continue;
    }

    if (ch === "/") {
      const body = readDelimited(input, i + 1, "/");
      let j = body.next;
      let flags = "";
      let flagChar = input[j];
      while (flagChar !== undefined && /[a-z]/i.test(flagChar)) {
        flags += flagChar;
        j += 1;
        flagChar = input[j];
      }
      tokens.push({ type: "regex", value: body.text, flags });
      i = j;
      continue;
    }

    if (DIGIT.test(ch)) {
      let j = i;
      let dotCount = 0;
      while (j < input.length && /[0-9.]/.test(input[j] ?? "")) {
        if (input[j] === ".") {
          dotCount += 1;
        }
        j += 1;
      }
      const value = input.slice(i, j);
      // A second `.` means this isn't a valid decimal (e.g. "1.2.3") — without this
      // check the token was accepted as-is and `Number(value)` silently produced `NaN`
      // downstream in `parser.ts`'s `parseValue`, and `NaN !== x`/`NaN == x` are always
      // `true`/`false` respectively regardless of the field's real value, so a typo'd
      // numeric literal silently matched (or excluded) every track instead of raising a
      // syntax error the user could notice and fix.
      if (dotCount > 1) {
        throw new FilterSyntaxError(`invalid number literal "${value}"`);
      }
      tokens.push({ type: "number", value });
      i = j;
      continue;
    }

    if ("=!<>".includes(ch)) {
      const two = input.slice(i, i + 2);
      if (TWO_CHAR_OPERATORS.has(two)) {
        tokens.push({ type: "op", value: two });
        i += 2;
        continue;
      }
      if (ch === "<" || ch === ">") {
        tokens.push({ type: "op", value: ch });
        i += 1;
        continue;
      }
      throw new FilterSyntaxError(`unexpected character "${ch}"`);
    }

    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < input.length && IDENT_CHAR.test(input[j] ?? "")) {
        j += 1;
      }
      tokens.push({ type: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }

    throw new FilterSyntaxError(`unexpected character "${ch}"`);
  }

  tokens.push({ type: "eof", value: "" });
  return tokens;
}

/** Reads a delimiter-terminated literal body starting at `start` (just past the opening
 * delimiter), supporting `\<delimiter>` and `\\` as escapes so the literal can contain
 * its own delimiter (e.g. a regex matching a URL needs a literal `/`: `/^https:\/\//`)
 * or a literal backslash. Any other backslash sequence (e.g. `\d`, `\s` inside a regex
 * body) is left completely untouched — it's not this lexer's escape to interpret, it's
 * regex syntax that `parser.ts` passes straight into `new RegExp(...)`. */
function readDelimited(
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
