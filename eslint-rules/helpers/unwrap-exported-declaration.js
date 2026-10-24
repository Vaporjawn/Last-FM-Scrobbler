/**
 * Returns the declaration an `export` statement wraps, or the statement itself when it is
 * not an export. Lets the structure rules treat `export function f() {}` and
 * `function f() {}` identically.
 *
 * @param {import("estree").Node} statement A top-level statement.
 * @returns {import("estree").Node} The wrapped declaration, or `statement` unchanged.
 */
export function unwrapExportedDeclaration(statement) {
  if (
    (statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration") &&
    statement.declaration
  ) {
    return statement.declaration;
  }
  return statement;
}
