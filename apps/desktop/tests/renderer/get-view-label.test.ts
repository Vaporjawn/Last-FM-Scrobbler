import { describe, expect, it } from "vitest";
import { getViewLabel } from "../../src/renderer/src/components/get-view-label.js";
import type { ViewId } from "../../src/renderer/src/components/nav-items.js";

describe("getViewLabel", () => {
  it("labels the settings view with the settings item's own label", () => {
    expect(getViewLabel("settings")).toBe("Settings");
  });

  it("labels a regular navigation view with its sidebar label", () => {
    expect(getViewLabel("friends")).toBe("Friends");
  });

  it("falls back to the raw id for a view the sidebar does not list", () => {
    expect(getViewLabel("not-a-view" as ViewId)).toBe("not-a-view");
  });
});
