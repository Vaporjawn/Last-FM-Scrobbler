/**
 * Runs `fetcher` once per item in `items`, allowing at most `limit` calls to be in
 * flight at the same time, and invoking `onSettled` with each item's own outcome as
 * soon as that individual call resolves or rejects — never gated behind the others.
 * Deliberately not built on `Promise.all`/`Promise.allSettled`, either of which would
 * only report *any* result once *every* call has finished: one item's rejection never
 * stops, delays, or otherwise affects any other item's fetch or settle callback.
 *
 * Concurrency is enforced with a small fixed pool of workers (`min(limit, items.length)`
 * of them): each worker claims one item at a time and immediately claims the next
 * unclaimed item once its current one settles, until every item has been claimed.
 *
 * Returns a promise that resolves once every item has settled. Callers that only care
 * about the incremental `onSettled` callbacks (the common case — driving independent
 * per-item state updates) can leave it unawaited; it exists mainly so tests can await
 * full completion.
 */
export function fetchEachWithLimit<Item, Result>(
  items: readonly Item[],
  fetcher: (item: Item) => Promise<Result>,
  limit: number,
  onSettled: (item: Item, result: PromiseSettledResult<Result>) => void,
): Promise<void> {
  // A single iterator shared by every worker below — each call to `.next()` hands out
  // the next unclaimed item (or signals `done`), which is exactly the "claim the next
  // item once mine settles" behavior a worker pool needs. Preferred over tracking a
  // shared numeric index and indexing into `items` manually: this project's
  // `noUncheckedIndexedAccess` types `items[i]` as `Item | undefined` regardless of
  // any bounds check, whereas `IteratorResult`'s `done`/`value` pair narrows `value`
  // to plain `Item` once `done` is `false`, with no unsafe access or assertion needed.
  const iterator = items[Symbol.iterator]();

  function runWorker(): Promise<void> {
    const next = iterator.next();
    if (next.done === true) {
      return Promise.resolve();
    }
    const item = next.value;
    return fetcher(item)
      .then((value): PromiseSettledResult<Result> => ({ status: "fulfilled", value }))
      .catch((reason: unknown): PromiseSettledResult<Result> => ({ status: "rejected", reason }))
      .then((result) => {
        onSettled(item, result);
        return runWorker();
      });
  }

  const workerCount = Math.max(0, Math.min(limit, items.length));
  return Promise.all(Array.from({ length: workerCount }, runWorker)).then(() => undefined);
}
