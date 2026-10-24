import { type AstNode } from "./ast-node.js";

/** AST node for `left and right`; `evaluate` matches it only when both sub-expressions match. */
export interface AndNode {
  readonly type: "and";
  readonly left: AstNode;
  readonly right: AstNode;
}
