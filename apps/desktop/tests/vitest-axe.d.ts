import type { AxeMatchers } from "vitest-axe/matchers";

/**
 * Registers vitest-axe's `toHaveNoViolations` matcher on the `vitest` module that
 * *this* workspace resolves.
 *
 * `vitest-axe/extend-expect` augments `vitest` itself, but under an npm install the
 * augmentation can land on a different copy of `vitest` than the one the tests import
 * (npm hoists differently than pnpm/bun), which left `tsc` reporting that the matcher
 * does not exist. Declaring it here ties the typing to the project's own resolution.
 */
/* eslint-disable @typescript-eslint/no-empty-object-type -- declaration merging requires empty-bodied interfaces that only extend */
declare module "vitest" {
  interface Assertion extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
