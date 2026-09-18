import { describe, expect, it, vi } from "vitest";
import { fetchEachWithLimit } from "../../src/renderer/src/hooks/fetch-each-with-limit.js";

/** Resolves after `ms` real milliseconds — used to keep a fetch "in flight" long enough
 * for concurrency to be observable, without the complexity of fake-timer/microtask
 * coordination for a handful of very short waits. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("fetchEachWithLimit", () => {
  it("never runs more than `limit` fetches concurrently", async () => {
    const items = Array.from({ length: 12 }, (_, index) => index);
    let inFlight = 0;
    let maxInFlight = 0;

    await fetchEachWithLimit(
      items,
      async (item) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(5);
        inFlight--;
        return item;
      },
      4,
      () => undefined,
    );

    expect(maxInFlight).toBe(4);
  });

  it("invokes onSettled with each item's fulfilled result", async () => {
    const settled: Record<string, unknown> = {};

    await fetchEachWithLimit(
      ["a", "b", "c"],
      (item) => Promise.resolve(`${item}-value`),
      2,
      (item, result) => {
        settled[item] = result;
      },
    );

    expect(settled).toEqual({
      a: { status: "fulfilled", value: "a-value" },
      b: { status: "fulfilled", value: "b-value" },
      c: { status: "fulfilled", value: "c-value" },
    });
  });

  it("reports one item's rejection without affecting the others' fulfilled results", async () => {
    const settled: Record<string, unknown> = {};

    await fetchEachWithLimit(
      ["ok1", "fail", "ok2"],
      (item) => (item === "fail" ? Promise.reject(new Error("boom")) : Promise.resolve(item)),
      3,
      (item, result) => {
        settled[item] = result;
      },
    );

    expect(settled.ok1).toEqual({ status: "fulfilled", value: "ok1" });
    expect(settled.ok2).toEqual({ status: "fulfilled", value: "ok2" });
    expect(settled.fail).toEqual({ status: "rejected", reason: new Error("boom") });
  });

  it("settles a faster item before a slower one, not gated behind the slowest (no Promise.all)", async () => {
    const order: string[] = [];

    await fetchEachWithLimit(
      ["slow", "fast"],
      async (item) => {
        await delay(item === "slow" ? 20 : 1);
        return item;
      },
      2,
      (item) => {
        order.push(item);
      },
    );

    expect(order).toEqual(["fast", "slow"]);
  });

  it("does nothing for an empty item list", async () => {
    const onSettled = vi.fn();

    await fetchEachWithLimit([], () => Promise.resolve("unused"), 4, onSettled);

    expect(onSettled).not.toHaveBeenCalled();
  });
});
