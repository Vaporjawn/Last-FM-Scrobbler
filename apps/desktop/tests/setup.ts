import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "vitest-axe/matchers";

// Registered explicitly rather than via `vitest-axe/extend-expect`: that entry calls
// `expect.extend(<ES module namespace object>)`, and the namespace object's extra keys
// leave `expect(...).rejects.toThrow(...)` failing with "Cannot read properties of
// undefined (reading 'indexOf')" for every test in the workspace (verified under npm,
// Node 22 and 24). The matcher's types are declared in tests/vitest-axe.d.ts.
expect.extend({ toHaveNoViolations });

// Explicit cleanup is required because tests import `afterEach` etc. from "vitest"
// rather than relying on Vitest's `globals: true` — Testing Library's automatic
// cleanup detection only engages when those hooks are available as true globals.
afterEach(() => {
  cleanup();
});
