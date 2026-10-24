import { FilterSyntaxError } from "./filter-syntax-error.js";
import { isKnownField } from "./is-known-field.js";
import { isNumericField } from "./is-numeric-field.js";
import type { Token } from "./tokenizer.js";
import { type ComparisonOperator } from "./comparison-operator.js";
import { type AstNode } from "./ast-node.js";

const STRING_OPERATORS = new Set<ComparisonOperator>(["==", "!=", "matches", "contains"]);
const NUMERIC_OPERATORS = new Set<ComparisonOperator>(["==", "!=", "<", ">", "<=", ">="]);
const OPERATOR_IDENTS = new Set(["matches", "contains"]);
/**
 * Recursive-descent parser turning the `Token[]` from `tokenize` into an `AstNode`
 * tree. Precedence, loosest to tightest: `or`, `and`, `not`, then a parenthesised group
 * or a single `field operator value` comparison. `and` / `or` are left-associative.
 * Every failure is reported as a `FilterSyntaxError`.
 */
export class Parser {
  private position = 0;

  /**
   * Creates a parser positioned at the first token; call `parseExpression` to run it.
   *
   * @param tokens - Output of `tokenize`; must end with an `eof` token.
   */
  constructor(private readonly tokens: readonly Token[]) {}

  /**
   * Parses the whole token stream as one expression.
   *
   * @throws FilterSyntaxError - On any grammar error, or when tokens remain after a
   * complete expression (e.g. a stray `)`).
   */
  parseExpression(): AstNode {
    const node = this.parseOr();
    const trailing = this.peek();
    if (trailing.type !== "eof") {
      throw new FilterSyntaxError(`unexpected token "${trailing.value}"`);
    }
    return node;
  }

  /** Parses `and`-groups joined by `or` into a left-nested chain of `or` nodes. */
  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (this.isKeyword("or")) {
      this.advance();
      const right = this.parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  /** Parses `not`-terms joined by `and` into a left-nested chain; binds tighter than `or`. */
  private parseAnd(): AstNode {
    let left = this.parseNot();
    while (this.isKeyword("and")) {
      this.advance();
      const right = this.parseNot();
      left = { type: "and", left, right };
    }
    return left;
  }

  /** Parses an optional `not` prefix; recurses so `not not x` is accepted. */
  private parseNot(): AstNode {
    if (this.isKeyword("not")) {
      this.advance();
      return { type: "not", operand: this.parseNot() };
    }
    return this.parsePrimary();
  }

  /** Parses a parenthesised sub-expression, or else a single comparison. */
  private parsePrimary(): AstNode {
    if (this.peek().type === "lparen") {
      this.advance();
      const node = this.parseOr();
      const closing = this.advance();
      if (closing.type !== "rparen") {
        throw new FilterSyntaxError('expected ")"');
      }
      return node;
    }
    return this.parseComparison();
  }

  /**
   * Parses `field operator value`, checking that the field exists and that the operator
   * suits the field's type (numeric fields take comparison operators, string fields take
   * `==`, `!=`, `matches` and `contains`) before reading the value.
   */
  private parseComparison(): AstNode {
    const fieldToken = this.advance();
    if (fieldToken.type !== "ident") {
      throw new FilterSyntaxError(`unexpected token "${fieldToken.value}"`);
    }
    const field = fieldToken.value;
    if (!isKnownField(field)) {
      throw new FilterSyntaxError(`unknown field "${field}"`);
    }

    const operator = this.parseOperator();
    const numericField = isNumericField(field);
    if (numericField && !NUMERIC_OPERATORS.has(operator)) {
      throw new FilterSyntaxError(
        `operator "${operator}" is not valid for numeric field "${field}"`,
      );
    }
    if (!numericField && !STRING_OPERATORS.has(operator)) {
      throw new FilterSyntaxError(`operator "${operator}" is not valid for field "${field}"`);
    }

    const value = this.parseValue(operator, numericField, field);
    return { type: "comparison", field, operator, value };
  }

  /**
   * Consumes the operator token: either a symbol token (`==`, `<`, ...) or one of the
   * word operators `matches` / `contains`, which the tokenizer emits as plain identifiers.
   */
  private parseOperator(): ComparisonOperator {
    const token = this.advance();
    if (token.type === "op") {
      return token.value as ComparisonOperator;
    }
    if (token.type === "ident" && OPERATOR_IDENTS.has(token.value)) {
      return token.value as ComparisonOperator;
    }
    throw new FilterSyntaxError(`unexpected token "${token.value}"`);
  }

  /**
   * Consumes the right-hand side and converts it to the type `operator` and the field
   * need: a compiled `RegExp` for `matches` (which demands a regex literal), a `number`
   * for numeric fields, otherwise a string literal.
   *
   * @throws FilterSyntaxError - When the token kind does not fit; an invalid regex body
   * makes `new RegExp` throw its own `SyntaxError` instead.
   */
  private parseValue(
    operator: ComparisonOperator,
    numericField: boolean,
    field: string,
  ): string | number | RegExp {
    const token = this.advance();

    if (operator === "matches") {
      if (token.type !== "regex") {
        throw new FilterSyntaxError('"matches" requires a regex literal, e.g. /pattern/flags');
      }
      return new RegExp(token.value, token.flags);
    }

    if (numericField) {
      if (token.type !== "number") {
        throw new FilterSyntaxError(`field "${field}" requires a numeric value`);
      }
      return Number(token.value);
    }

    if (token.type !== "string") {
      throw new FilterSyntaxError(`field "${field}" requires a string value, e.g. "text"`);
    }
    return token.value;
  }

  /** Returns the current token without consuming it. */
  private peek(): Token {
    const token = this.tokens[this.position];
    /* v8 ignore start -- @preserve
     * Defensive: `tokenize` always appends a trailing "eof" token and `advance()`
     * never moves `position` past it, so `token` is always defined here. The guard
     * exists only to satisfy `noUncheckedIndexedAccess`. */
    if (!token) {
      throw new FilterSyntaxError("unexpected end of expression");
    }
    /* v8 ignore stop -- @preserve */
    return token;
  }

  /**
   * Consumes and returns the current token.
   *
   * @throws FilterSyntaxError - If only the `eof` token is left, i.e. the expression
   * ended where more input was required.
   */
  private advance(): Token {
    const token = this.peek();
    if (token.type !== "eof") {
      this.position += 1;
      return token;
    }
    throw new FilterSyntaxError("unexpected end of expression");
  }

  /** Whether the current token is the identifier `keyword` (`and`, `or` or `not`); consumes nothing. */
  private isKeyword(keyword: string): boolean {
    const token = this.peek();
    return token.type === "ident" && token.value === keyword;
  }
}
