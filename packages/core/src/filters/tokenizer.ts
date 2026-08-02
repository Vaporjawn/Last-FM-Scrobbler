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
      while (j < input.length && /[0-9.]/.test(input[j] ?? "")) {
        j += 1;
      }
      tokens.push({ type: "number", value: input.slice(i, j) });
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

function readDelimited(
  input: string,
  start: number,
  delimiter: string,
): { text: string; next: number } {
  let j = start;
  let text = "";
  let char = input[j];
  while (char !== undefined && char !== delimiter) {
    text += char;
    j += 1;
    char = input[j];
  }
  if (char === undefined) {
    throw new FilterSyntaxError(`unterminated ${delimiter === '"' ? "string" : "regex"} literal`);
  }
  return { text, next: j + 1 };
}
