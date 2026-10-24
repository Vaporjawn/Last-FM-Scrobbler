/** Resolves after `ms` milliseconds using a real timer; the production `sleepImpl` for `AuthFlow`. */
export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
