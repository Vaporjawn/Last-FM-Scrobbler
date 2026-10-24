/** Thrown by `tokenize`/`parse` for a malformed filter expression, and by `parse` for
 * a well-formed one that references an unknown field or an operator that doesn't apply
 * to that field's type — see `compileFilter`'s docstring for the grammar this is
 * validating against. */
export class FilterSyntaxError extends Error {
  /**
   * Creates the error with the given message and the name `FilterSyntaxError`.
   *
   * @param message - Description of what is wrong with the expression (e.g. the offending token or field). */
  constructor(message: string) {
    super(message);
    this.name = "FilterSyntaxError";
  }
}
