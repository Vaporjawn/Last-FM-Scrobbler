import type { FilterableTrack } from "./filterable-track.js";
import type { AstNode } from "./ast-node.js";
import { evaluateComparison } from "./evaluate-comparison.js";

/** Recursively evaluates a parsed filter expression AST (see `parse`) against one
 * track, applying `and`/`or`/`not` combinators over leaf field comparisons. */
export function evaluate(node: AstNode, track: FilterableTrack): boolean {
  switch (node.type) {
    case "and":
      return evaluate(node.left, track) && evaluate(node.right, track);
    case "or":
      return evaluate(node.left, track) || evaluate(node.right, track);
    case "not":
      return !evaluate(node.operand, track);
    case "comparison":
      return evaluateComparison(node, track);
  }
}
