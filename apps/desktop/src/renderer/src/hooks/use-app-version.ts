import { useEffect, useState } from "react";

/**
 * The running app's own version (`app.getVersion()`, via `window.appInfo`) — shown in
 * Settings → General. Returns `undefined` while loading, when `window.appInfo` isn't
 * present (e.g. component tests), or if the lookup fails — purely informational, so
 * there's nothing more specific a caller would do with a failure than just not
 * showing a version yet.
 */
export function useAppVersion(): string | undefined {
  const [version, setVersion] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!window.appInfo) {
      return;
    }
    let cancelled = false;

    window.appInfo
      .getVersion()
      .then((result) => {
        if (!cancelled) {
          setVersion(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersion(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
