import { type ComparisonOperator } from "./comparison-operator.js";

/**
 * Leaf AST node for a single `field operator value` test. The parser guarantees `field`
 * is a known track field and that `value` has the type the operator needs: a number for
 * numeric fields, a `RegExp` for `matches`, a string otherwise.
 */
export interface ComparisonNode {
  readonly type: "comparison";
  readonly field: string;
  readonly operator: ComparisonOperator;
  readonly value: string | number | RegExp;
}
