/**
 * Operators a filter expression can apply to a field. `==`, `!=`, `matches` and
 * `contains` are valid on string fields; `==`, `!=`, `<`, `>`, `<=` and `>=` on numeric
 * ones (the parser rejects other pairings).
 */
export type ComparisonOperator = "==" | "!=" | "matches" | "contains" | "<" | ">" | "<=" | ">=";
