import { expect } from "vitest";
import { axe } from "vitest-axe";

/**
 * Runs axe-core against an already-rendered, already-settled DOM subtree and
 * asserts it has no accessibility violations.
 *
 * Deliberately takes a `container` rather than wrapping `render()` itself
 * (e.g. a combined `renderAndCheckA11y(<Page />)`): every page component
 * under test here fetches data asynchronously, so callers first `await
 * screen.findByX(...)` until the real, loaded UI has settled and only then
 * call this — checking immediately post-render would mostly exercise a
 * transient loading spinner instead of the page's real accessibility
 * posture.
 */
export async function checkA11y(container: Element): Promise<void> {
  expect(await axe(container)).toHaveNoViolations();
}
