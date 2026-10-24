import { type AstNode } from "./ast-node.js";

/** AST node for `left or right`; `evaluate` matches it when either sub-expression matches. */
export interface OrNode {
  readonly type: "or";
  readonly left: AstNode;
  readonly right: AstNode;
}
