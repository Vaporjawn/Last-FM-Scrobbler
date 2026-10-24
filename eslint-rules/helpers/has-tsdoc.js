/** Line comments that tools put between a doc block and its declaration; they never count as the doc. */
const TOOLING_COMMENT = /^\s*(eslint|@ts-|prettier|istanbul|v8)/;

/**
 * Finds the TSDoc/JSDoc block attached to a node and returns its description (the text before
 * the first `@tag`), or `null` when the node has no doc block.
 *
 * @param {import("eslint").SourceCode} sourceCode The file's source code object.
 * @param {import("estree").Node} node The node whose leading comments to search.
 * @returns {string | null} The doc description, trimmed and joined onto one line, or `null`.
 */
export function readTsdocDescription(sourceCode, node) {
  const comments = sourceCode.getCommentsBefore(node);
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const comment = comments[index];
    if (comment.type === "Line" && TOOLING_COMMENT.test(comment.value)) {
      continue;
    }
    if (comment.type !== "Block" || !comment.value.startsWith("*")) {
      return null;
    }
    const text = comment.value
      .slice(1)
      .split("\n")
      .map((line) => line.replace(/^\s*\*? ?/, ""))
      .join(" ");
    return text.split(/@\w/)[0].trim();
  }
  return null;
}
