import type { ComparisonNode } from "./comparison-node.js";

/**
 * Applies a string operator (`==`, `!=`, `matches`, `contains`) to a track's field
 * value. Comparisons are case-sensitive unless the regex carries the `i` flag. Returns
 * `false` when the node's value has the wrong type for the operator or the operator is
 * not a string one, rather than throwing.
 */
export function evaluateString(fieldValue: string, node: ComparisonNode): boolean {
  switch (node.operator) {
    case "==":
      return typeof node.value === "string" && fieldValue === node.value;
    case "!=":
      return typeof node.value === "string" && fieldValue !== node.value;
    case "matches":
      return node.value instanceof RegExp && node.value.test(fieldValue);
    case "contains":
      return typeof node.value === "string" && fieldValue.includes(node.value);
    default:
      return false;
  }
}
