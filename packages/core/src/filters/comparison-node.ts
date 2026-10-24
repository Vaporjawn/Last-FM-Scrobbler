import { type ComparisonOperator } from "./comparison-operator.js";

export interface ComparisonNode {
  readonly type: "comparison";
  readonly field: string;
  readonly operator: ComparisonOperator;
  readonly value: string | number | RegExp;
}
