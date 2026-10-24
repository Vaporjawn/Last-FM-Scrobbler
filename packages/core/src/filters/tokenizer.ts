import { FilterSyntaxError } from "./filter-syntax-error.js";
import { readDelimited } from "./read-delimited.js";

/**
 * Lexical categories produced by `tokenize`. Keywords (`and`, `or`, `not`) and the word
 * operators (`matches`, `contains`) are not separate types: they arrive as `ident`.
 */
export type TokenType =
  "ident" | "string" | "regex" | "number" | "op" | "lparen" | "rparen" | "eof";
/**
 * One lexed unit of a filter expression. `value` is the unescaped text (string/regex
 * bodies without their delimiters, numbers as written, empty for `eof`).
 */
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
    // `charAt` always yields a string ("" past the end), never `undefined`, so no
    // unreachable bounds guard is needed under `noUncheckedIndexedAccess`.
    const ch = input.charAt(i);

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
      while (j < input.length && /[0-9.]/.test(input.charAt(j))) {
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
      while (j < input.length && IDENT_CHAR.test(input.charAt(j))) {
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
