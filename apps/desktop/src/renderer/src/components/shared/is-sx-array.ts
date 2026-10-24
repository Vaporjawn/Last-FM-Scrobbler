import type { SxProps, Theme } from "@mui/material/styles";

/**
 * A hand-written type guard, not a bare `Array.isArray(value)` check inline — the
 * built-in `Array.isArray` overload in `lib.es5.d.ts` always narrows its true branch
 * to a bare `any[]`, which would leak an implicit `any` into the spread this guards
 * below. Narrows to `SxProps<Theme>`'s own array member (via `Extract`, not a
 * hand-reconstructed element type — see the `as SxProps<Theme>` below for why that's
 * not worth chasing) — a predicate's asserted type has to be a subtype of its
 * parameter's, which a bare `readonly unknown[]` isn't.
 */
export function isSxArray(
  value: SxProps<Theme> | undefined,
): value is Extract<SxProps<Theme>, readonly unknown[]> {
  return Array.isArray(value);
}
