/**
 * Returns the node a doc comment is attached to. For a declaration inside an `export`
 * statement the comment sits before the `export` keyword, so the export statement is the
 * node to inspect.
 *
 * @param {import("estree").Node & { parent?: import("estree").Node }} node A declaration.
 * @returns {import("estree").Node} The declaration, or its enclosing export statement.
 */
export function getDocumentedNode(node) {
  const parent = node.parent;
  if (
    parent &&
    (parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration")
  ) {
    return parent;
  }
  return node;
}
