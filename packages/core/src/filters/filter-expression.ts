import { evaluate } from "./evaluate.js";
import { parse } from "./parser.js";
import type { FilterableTrack } from "./fields.js";

export type { FilterableTrack } from "./fields.js";
export { FilterSyntaxError } from "./filter-syntax-error.js";

export interface CompiledFilter {
  test(track: FilterableTrack): boolean;
}

/**
 * Compiles a filter expression (see docs/adr/0005-multi-source-and-track-identity-policy.md)
 * into a reusable, pre-parsed matcher — parse once, evaluate many times as tracks change.
 *
 * Grammar: `field op value`, combined with `and` / `or` / `not` and parentheses.
 * String fields (artist, title, album, albumArtist, sourceApp) support `==`, `!=`,
 * `contains "text"`, and `matches /regex/flags`. The numeric field `durationSec`
 * supports `==`, `!=`, `<`, `>`, `<=`, `>=`.
 *
 * @throws FilterSyntaxError for invalid syntax, unknown fields, or an operator that
 *   doesn't apply to the given field's type.
 */
export function compileFilter(expression: string): CompiledFilter {
  const ast = parse(expression);
  return {
    test: (track: FilterableTrack) => evaluate(ast, track),
  };
}
