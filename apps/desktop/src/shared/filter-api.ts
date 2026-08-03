/** Result of validating a filter expression — mirrors `ActionResult`'s
 * success/failure shape but named for what it actually returns here rather than
 * reused generically, since `valid`/`error` read more clearly at each of this API's
 * call sites than a generic `success`/`error` would. */
export interface FilterValidationResult {
  readonly valid: boolean;
  /** Present only when `valid` is `false` — a `FilterSyntaxError`'s message. */
  readonly error?: string;
}

/**
 * The renderer-facing filter-expression validation API the preload script exposes via
 * `contextBridge.exposeInMainWorld("filter", ...)`. A separate surface rather than a
 * `settings.*` method — validating an expression is a pure, side-effect-free check
 * ("would this compile?"), unrelated to reading or writing persisted `AppSettings`.
 *
 * Compiling happens in the main process rather than the renderer because
 * `@lastfm-scrobbler/core`'s bundled output (`packages/core/dist/index.js`, built by
 * tsup as a single file) pulls in `better-sqlite3` (a native Node addon, via
 * `ScrobbleQueue`) at module scope — importing even one unrelated named export like
 * `compileFilter` from that package into a Vite-bundled renderer would try to bundle
 * `better-sqlite3` for the browser too, which can't work. See
 * `main/filters/wire-filter-validation.ts` for the real implementation.
 */
export interface FilterApi {
  /** Never rejects — a syntax error is reported via `FilterValidationResult.error`,
   * not a thrown/rejected promise. */
  validate(expression: string): Promise<FilterValidationResult>;
}
