import { type AstNode } from "./ast-node.js";

export interface AndNode {
  readonly type: "and";
  readonly left: AstNode;
  readonly right: AstNode;
}
