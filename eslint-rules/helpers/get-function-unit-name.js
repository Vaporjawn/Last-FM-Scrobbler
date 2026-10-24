import { isFunctionLikeInitializer } from "./is-function-like-initializer.js";

/**
 * Names the function-like unit a declaration introduces, or `null` when it introduces none.
 * A unit is a function declaration, a class, or a variable initialised with an arrow or
 * function expression. Type-only constructs, overload signatures and ordinary constants are
 * not units.
 *
 * @param {import("estree").Node} declaration A declaration, already unwrapped from any `export`.
 * @returns {string | null} The declared name (`"default"` when anonymous), or `null`.
 */
export function getFunctionUnitName(declaration) {
  if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
    return declaration.id ? declaration.id.name : "default";
  }
  if (declaration.type === "VariableDeclaration") {
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === "Identifier" && isFunctionLikeInitializer(declarator.init)) {
        return declarator.id.name;
      }
    }
  }
  return null;
}
