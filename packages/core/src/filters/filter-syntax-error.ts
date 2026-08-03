/** Thrown by `tokenize`/`parse` for a malformed filter expression, and by `parse` for
 * a well-formed one that references an unknown field or an operator that doesn't apply
 * to that field's type — see `compileFilter`'s docstring for the grammar this is
 * validating against. */
export class FilterSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterSyntaxError";
  }
}
