import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Picks the widest of `candidateCount` progressively-shorter renderings that still
 * fits the space actually available to the returned `containerRef`'s element, instead
 * of letting CSS `text-overflow: ellipsis` silently cut an arbitrary string
 * mid-character. Motivating use: `PlaybackStatusChip`'s timestamp shrinking from
 * `"8/3/2026, 2:45:30 PM"` down to just `"2:45 PM"` as its row runs out of room — see
 * `format-timestamp-candidates.ts` for how those candidate strings are built.
 *
 * The caller owns the candidate strings themselves and is expected to render
 * `candidates[index]` inside the element `containerRef` is attached to, with
 * `whiteSpace: "nowrap"` on that element so its true (untruncated) content width is
 * actually measurable via `scrollWidth` rather than already having wrapped or
 * pre-truncated before this hook ever gets to look at it.
 *
 * Everything below reflects two real bugs found only by live-resizing an actual
 * `PlaybackStatusChip` in a real browser — jsdom-based component tests cannot catch
 * either (see "Real limitation" below) — not the original design, which looked
 * reasonable and passed every jsdom test before that.
 *
 * **Bug 1 — shrinking from an already-fitting state did nothing.** The original
 * design called `setIndex(0)` directly from the `ResizeObserver` callback. When
 * `index` is *already* `0` (the common case: plenty of room, showing the longest
 * candidate) and the container then shrinks, calling `setIndex(0)` again is a no-op as
 * far as React is concerned (the value didn't change), so React skips re-rendering
 * entirely, and the step-down effect never gets a chance to notice the container is
 * now too narrow. Fixed by routing through `resizeTick`, a plain incrementing counter
 * that's never idempotent — every detected resize bumps it to a genuinely new value,
 * guaranteeing a real re-render (and therefore a real re-run of the step-down effect,
 * which has no dependency array and so runs on every commit regardless of whether
 * `index` itself changed) even when the reset-to-`0` it triggers wouldn't have been a
 * real change on its own.
 *
 * **Bug 2 — growing back to a more detailed candidate often didn't happen at all.**
 * `containerRef`'s element (the label span holding the current candidate's text) only
 * auto-sizes to its own content — nothing stretches it to fill whatever room its
 * ancestor has. Shrinking the ancestor below that auto-size genuinely squeezes the
 * span smaller, which `ResizeObserver` correctly reports. But *growing* the ancestor
 * back doesn't force the span to grow along with it if the span was already
 * comfortably sized for its current (short) content with room to spare — the span's
 * own box never changes size, so `ResizeObserver`, which only fires on the *observed*
 * element's own size changing, never fires, and the label stays stuck on a shorter
 * candidate than the now-available space could actually fit. A `window` `resize`
 * listener is a second, independent source for the same `resizeTick` bump — window
 * resizes are the dominant real-world cause of a row's available space changing, and
 * unlike the span's own `ResizeObserver`, a `resize` event fires on every viewport
 * size change regardless of whether anything being observed happens to already have
 * slack. **Known, accepted gap**: this still won't catch a *sibling* element's content
 * changing length (e.g. a friend's username loading in shorter or longer than a
 * placeholder) independent of any window resize, while this element itself stays
 * comfortably sized either way — genuinely detecting that would need a
 * `ResizeObserver` on the actual constraining ancestor, which varies per call site
 * (`FriendListItem`/`ScrobbleListItem`/`ScrobbleDetailPage` each lay this out
 * differently) and isn't implemented here. Revisit if that turns out to matter in
 * practice.
 *
 * **Real limitation, not a rare edge case**: jsdom (this project's component-test
 * environment) implements neither `ResizeObserver` nor real layout —
 * `scrollWidth`/`clientWidth` both read `0` there, confirmed directly against jsdom
 * 30.0.1's own `window`, not assumed from its docs. Every effect below that depends on
 * `ResizeObserver` already guards against it being missing (skipping that effect
 * entirely rather than throwing), and the truncation check's `0 > 0` is always
 * `false`, so a component test using this hook always sees `index` stay `0` — the
 * longest candidate — no matter how narrow its container claims to be. That's an
 * honest reflection of what jsdom can prove, not a bug: both bugs above needed a real
 * browser to find and confirm fixed, the same category of gap this project already
 * documents for its CSP fix (see docs/modules/desktop.md's "the CSP silently blocked
 * every real Last.fm image").
 */
export function useShrinkToFitIndex(candidateCount: number): {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly index: number;
} {
  const containerRef = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  const [resizeTick, setResizeTick] = useState(0);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      setResizeTick((tick) => tick + 1);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleWindowResize = (): void => {
      setResizeTick((tick) => tick + 1);
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  useLayoutEffect(() => {
    setIndex(0);
    // Only `resizeTick` in this array, deliberately not `index`/`candidateCount` too —
    // this effect's entire job is reacting to a detected resize, not to `index`
    // changing for some other reason (which would risk re-triggering itself via its
    // own `setIndex(0)` call whenever that call happens to be a real change).
  }, [resizeTick]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    if (element.scrollWidth > element.clientWidth && index < candidateCount - 1) {
      setIndex(index + 1);
    }
  });

  return { containerRef, index };
}
