import { type AstNode } from "./ast-node.js";

export interface OrNode {
  readonly type: "or";
  readonly left: AstNode;
  readonly right: AstNode;
}
