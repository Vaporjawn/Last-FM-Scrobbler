import type { JSX } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useShrinkToFitIndex } from "../../src/renderer/src/hooks/use-shrink-to-fit-index.js";

// This codebase deliberately has no dedicated hook test files for most hooks (see
// use-now-playing.test.ts's own note) — useShrinkToFitIndex gets one because its
// step-down cascade is genuinely hook-internal state machinery that jsdom's own
// defaults can't exercise at all: jsdom has neither a real ResizeObserver nor real
// layout (scrollWidth/clientWidth both hardcode 0 there — confirmed directly against
// jsdom 30.0.1's own window, see this hook's own docstring), so every *other*
// component test in this project that happens to render something using this hook
// only ever proves "index stays 0 and nothing crashes," never the actual shrinking
// behavior. A fake ResizeObserver plus manually-stubbed scrollWidth/clientWidth on
// the test element are what make the real algorithm testable here at all — except for
// the window-resize-driven "grow back" path, which jsdom's real (not faked)
// window.addEventListener/dispatchEvent can exercise directly, no stubbing needed.

type ResizeCallback = () => void;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeCallback;

  constructor(callback: ResizeCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {
    // Real ResizeObserver.observe(target) matters for which element it watches;
    // this fake is triggered manually by the tests below instead, so it's a no-op.
  }

  unobserve(): void {
    // Same no-op reasoning as observe() above.
  }

  disconnect(): void {
    // Same no-op reasoning as observe() above.
  }

  trigger(): void {
    this.callback();
  }
}

/** Simulated candidate "widths" (character counts, treated 1:1 as pixels) for a
 * 4-candidate progression, decreasing — standing in for real strings of decreasing
 * length like `formatTimestampCandidates`' output; the exact numbers don't matter,
 * only that each is shorter than the last. */
const CANDIDATE_LENGTHS = [200, 140, 90, 50];

function TestHarness({ availableWidth }: { readonly availableWidth: number }): JSX.Element {
  const { containerRef, index } = useShrinkToFitIndex(CANDIDATE_LENGTHS.length);
  const text = "x".repeat(CANDIDATE_LENGTHS[index] ?? 0);

  return (
    <span
      // A new function identity every render means React detaches and reattaches
      // this ref on every render (not just mount) — deliberately, so the stubbed
      // scrollWidth/clientWidth below always reflect the *current* render's
      // availableWidth and currently-rendered candidate text, not a stale snapshot
      // from whenever the node first mounted.
      ref={(node) => {
        containerRef.current = node;
        if (node) {
          Object.defineProperty(node, "scrollWidth", {
            configurable: true,
            get: () => node.textContent.length,
          });
          Object.defineProperty(node, "clientWidth", {
            configurable: true,
            value: availableWidth,
          });
        }
      }}
      data-testid="harness"
    >
      {text}
    </span>
  );
}

describe("useShrinkToFitIndex", () => {
  afterEach(() => {
    FakeResizeObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it("stays at index 0 when the longest candidate already fits", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    render(<TestHarness availableWidth={250} />);

    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(200));
  });

  it("steps down through candidates until one actually fits", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    // 200 (index 0) and 140 (index 1) both exceed 100; 90 (index 2) fits.
    render(<TestHarness availableWidth={100} />);

    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(90));
  });

  it("settles on the shortest candidate rather than looping forever if nothing fits", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    render(<TestHarness availableWidth={10} />);

    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(50));
  });

  it("grows back to a longer candidate once a real resize gives it more room", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    const { rerender } = render(<TestHarness availableWidth={100} />);
    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(90));

    rerender(<TestHarness availableWidth={250} />);
    // A prop change alone doesn't shrink/grow the index — only a *detected resize* on
    // the observed element does (see the hook's own docstring for why: the step-down
    // effect only ever increments). Firing the fake observer's callback is what
    // stands in for a real ResizeObserver noticing the container actually got wider.
    act(() => {
      FakeResizeObserver.instances.at(0)?.trigger();
    });

    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(200));
  });

  it("still shrinks to fit on first render even when ResizeObserver isn't available", () => {
    // No vi.stubGlobal("ResizeObserver", ...) here — this is jsdom's real default
    // (undefined), the actual environment every other component test in this project
    // already runs under. The step-down effect that does the actual shrinking doesn't
    // depend on ResizeObserver at all (only the *grow-back-when-space-increases*
    // effect does — see the next test) — it re-measures on every commit regardless,
    // which is what still correctly lands on the shortest fitting candidate here.
    expect(() => {
      render(<TestHarness availableWidth={10} />);
    }).not.toThrow();

    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(50));
  });

  it("cannot grow back to a longer candidate from a mere rerender without ResizeObserver or a window resize", () => {
    // Same "grows back" scenario as the earlier test, but without stubbing
    // ResizeObserver and without dispatching a window resize event either (see the
    // next test for that) — demonstrates concretely what's actually lost without
    // either mechanism: a prop-driven rerender alone never resets the index, even
    // though a real, real-world container resize did happen (the rerender to a wider
    // availableWidth).
    const { rerender } = render(<TestHarness availableWidth={100} />);
    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(90));

    rerender(<TestHarness availableWidth={250} />);

    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(90));
  });

  it("grows back to a longer candidate on a window resize event, even without ResizeObserver", () => {
    // No vi.stubGlobal("ResizeObserver", ...) — this is the second, independent
    // trigger for the same resizeTick counter (see the hook's own "Bug 2" docstring
    // section): a real window `resize` event is dispatched by jsdom's own real
    // `window.addEventListener`/`dispatchEvent` (unlike ResizeObserver, a genuine DOM
    // API jsdom fully implements), so — unlike every other test in this file — this
    // one exercises real, unstubbed browser-API behavior, not a fake standing in for
    // one jsdom can't provide.
    const { rerender } = render(<TestHarness availableWidth={100} />);
    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(90));

    rerender(<TestHarness availableWidth={250} />);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByTestId("harness")).toHaveTextContent("x".repeat(200));
  });
});
