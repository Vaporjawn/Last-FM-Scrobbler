export class FilterSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterSyntaxError";
  }
}
