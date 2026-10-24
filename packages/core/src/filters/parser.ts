import { FilterSyntaxError } from "./filter-syntax-error.js";
import { isKnownField } from "./is-known-field.js";
import { isNumericField } from "./is-numeric-field.js";
import type { Token } from "./tokenizer.js";
import { type ComparisonOperator } from "./comparison-operator.js";
import { type AstNode } from "./ast-node.js";

const STRING_OPERATORS = new Set<ComparisonOperator>(["==", "!=", "matches", "contains"]);
const NUMERIC_OPERATORS = new Set<ComparisonOperator>(["==", "!=", "<", ">", "<=", ">="]);
const OPERATOR_IDENTS = new Set(["matches", "contains"]);
export class Parser {
  private position = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parseExpression(): AstNode {
    const node = this.parseOr();
    const trailing = this.peek();
    if (trailing.type !== "eof") {
      throw new FilterSyntaxError(`unexpected token "${trailing.value}"`);
    }
    return node;
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (this.isKeyword("or")) {
      this.advance();
      const right = this.parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseNot();
    while (this.isKeyword("and")) {
      this.advance();
      const right = this.parseNot();
      left = { type: "and", left, right };
    }
    return left;
  }

  private parseNot(): AstNode {
    if (this.isKeyword("not")) {
      this.advance();
      return { type: "not", operand: this.parseNot() };
    }
    return this.parsePrimary();
  }

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

  private advance(): Token {
    const token = this.peek();
    if (token.type !== "eof") {
      this.position += 1;
      return token;
    }
    throw new FilterSyntaxError("unexpected end of expression");
  }

  private isKeyword(keyword: string): boolean {
    const token = this.peek();
    return token.type === "ident" && token.value === keyword;
  }
}
