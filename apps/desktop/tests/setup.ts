import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Explicit cleanup is required because tests import `afterEach` etc. from "vitest"
// rather than relying on Vitest's `globals: true` — Testing Library's automatic
// cleanup detection only engages when those hooks are available as true globals.
afterEach(() => {
  cleanup();
});
