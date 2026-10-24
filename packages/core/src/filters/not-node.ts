import { type AstNode } from "./ast-node.js";

export interface NotNode {
  readonly type: "not";
  readonly operand: AstNode;
}
