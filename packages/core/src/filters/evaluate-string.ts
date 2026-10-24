import type { ComparisonNode } from "./comparison-node.js";

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
