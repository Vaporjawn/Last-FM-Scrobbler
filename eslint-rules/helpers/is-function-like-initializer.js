/**
 * Tells whether an expression is a function value: an arrow function or a function
 * expression, optionally wrapped in a TypeScript `as`/`satisfies`/non-null expression.
 *
 * @param {import("estree").Node | null | undefined} node The initializer to inspect.
 * @returns {boolean} True when the value is an arrow function or function expression.
 */
export function isFunctionLikeInitializer(node) {
  if (!node) {
    return false;
  }
  if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") {
    return isFunctionLikeInitializer(node.expression);
  }
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression";
}
