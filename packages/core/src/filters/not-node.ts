import { type AstNode } from "./ast-node.js";

/** AST node for `not operand`; `evaluate` negates the result of the wrapped sub-expression. */
export interface NotNode {
  readonly type: "not";
  readonly operand: AstNode;
}
