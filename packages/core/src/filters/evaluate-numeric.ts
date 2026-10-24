import type { ComparisonNode } from "./comparison-node.js";

/**
 * Applies a numeric operator to a track's field value. Returns `false` for every
 * operator (including `!=`) when the value is unknown (`undefined`), so a track with no
 * duration is never matched or excluded by a duration filter; also `false` when the
 * node's value is not a number or the operator is not a numeric one.
 */
export function evaluateNumeric(fieldValue: number | undefined, node: ComparisonNode): boolean {
  if (fieldValue === undefined || typeof node.value !== "number") {
    return false;
  }
  switch (node.operator) {
    case "==":
      return fieldValue === node.value;
    case "!=":
      return fieldValue !== node.value;
    case "<":
      return fieldValue < node.value;
    case ">":
      return fieldValue > node.value;
    case "<=":
      return fieldValue <= node.value;
    case ">=":
      return fieldValue >= node.value;
    default:
      return false;
  }
}
