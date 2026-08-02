/**
 * Result of an async hook action (`useAuth().login()`, `useTrackActions().toggleLove()`,
 * etc.) that never rejects — every one of these hooks catches its own errors into a
 * persisted `error` state field for rendering, *and* returns this discriminated union
 * so a caller can react to the outcome immediately, in the same tick, without racing a
 * stale closure over that `error` state.
 *
 * Why not just re-read the hook's `error` field after awaiting the call? Because the
 * caller's own render — and therefore whatever local variable it destructured `error`
 * into — is fixed for the lifetime of the event handler closure that's currently
 * running; the hook's internal `setError(...)` schedules a *future* re-render with a
 * *new* closure, which the code that's mid-`await` right now can never see. Returning
 * the message directly sidesteps that entirely.
 */
export interface ActionSuccess {
  readonly success: true;
}

export interface ActionFailure {
  readonly success: false;
  readonly error: string;
}

export type ActionResult = ActionSuccess | ActionFailure;

export function ok(): ActionSuccess {
  return { success: true };
}

export function fail(error: unknown): ActionFailure {
  return { success: false, error: error instanceof Error ? error.message : String(error) };
}
