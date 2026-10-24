import util from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { restoreUtilIsError } from "../../src/mpris/restore-util-is-error.js";

interface UtilWithIsError {
  isError?: (value: unknown) => boolean;
}

describe("restoreUtilIsError", () => {
  const target = util as unknown as UtilWithIsError;
  const original = target.isError;
  /** Re-read on every call: control-flow analysis would otherwise narrow the property to `never` after a `delete`. */
  const isError = (value: unknown): boolean | undefined => target.isError?.(value);

  afterEach(() => {
    if (original === undefined) {
      delete target.isError;
    } else {
      target.isError = original;
    }
  });

  it("provides util.isError when the runtime has removed it", () => {
    delete target.isError;
    restoreUtilIsError();
    expect(typeof target.isError).toBe("function");
    expect(isError(new Error("x"))).toBe(true);
    expect(isError(new TypeError("x"))).toBe(true);
    expect(isError({ message: "not an error" })).toBe(false);
    expect(isError(null)).toBe(false);
    expect(isError("Error")).toBe(false);
  });

  it("recognises errors from another realm via their toString tag", () => {
    delete target.isError;
    restoreUtilIsError();
    const foreign = Object.create(null) as Record<symbol, unknown>;
    foreign[Symbol.toStringTag] = "Error";
    expect(isError(foreign)).toBe(true);
  });

  it("never overwrites an implementation the runtime still ships", () => {
    const sentinel = (): boolean => true;
    target.isError = sentinel;
    restoreUtilIsError();
    expect(target.isError).toBe(sentinel);
  });
});
