import { NUMERIC_FIELD_ACCESSORS, STRING_FIELD_ACCESSORS } from "./fields.js";
import type { FilterableTrack } from "./fields.js";
import type { AstNode, ComparisonNode } from "./parser.js";

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

function evaluateComparison(node: ComparisonNode, track: FilterableTrack): boolean {
  const numericAccessor = NUMERIC_FIELD_ACCESSORS[node.field];
  if (numericAccessor) {
    return evaluateNumeric(numericAccessor(track), node);
  }

  const stringAccessor = STRING_FIELD_ACCESSORS[node.field];
  const fieldValue = stringAccessor ? stringAccessor(track) : "";
  return evaluateString(fieldValue, node);
}

function evaluateNumeric(fieldValue: number | undefined, node: ComparisonNode): boolean {
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

function evaluateString(fieldValue: string, node: ComparisonNode): boolean {
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
