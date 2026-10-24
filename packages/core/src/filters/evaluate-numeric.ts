import type { ComparisonNode } from "./comparison-node.js";

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
