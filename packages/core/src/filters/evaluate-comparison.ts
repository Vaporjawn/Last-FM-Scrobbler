import type { FilterableTrack } from "./filterable-track.js";
import { NUMERIC_FIELD_ACCESSORS } from "./numeric-field-accessors.js";
import type { ComparisonNode } from "./comparison-node.js";
import { STRING_FIELD_ACCESSORS } from "./string-field-accessors.js";
import { evaluateNumeric } from "./evaluate-numeric.js";
import { evaluateString } from "./evaluate-string.js";

export function evaluateComparison(node: ComparisonNode, track: FilterableTrack): boolean {
  const numericAccessor = NUMERIC_FIELD_ACCESSORS[node.field];
  if (numericAccessor) {
    return evaluateNumeric(numericAccessor(track), node);
  }

  const stringAccessor = STRING_FIELD_ACCESSORS[node.field];
  const fieldValue = stringAccessor ? stringAccessor(track) : "";
  return evaluateString(fieldValue, node);
}
