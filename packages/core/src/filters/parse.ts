import { tokenize } from "./tokenizer.js";
import { type AstNode } from "./ast-node.js";
import { Parser } from "./parser.js";

/** Parses a filter expression string into an `AstNode` tree, via `tokenize` followed
 * by the private recursive-descent `Parser` below. Throws `FilterSyntaxError` for
 * invalid syntax, unknown fields, or an operator that doesn't apply to a field's type —
 * see `compileFilter`'s docstring for the full grammar. */
export function parse(expression: string): AstNode {
  return new Parser(tokenize(expression)).parseExpression();
}
