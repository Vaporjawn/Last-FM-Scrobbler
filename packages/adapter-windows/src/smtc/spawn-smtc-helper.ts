import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { parseStreamLine } from "./parse-stream-line.js";
import type { NowPlayingPayload } from "./now-playing-payload.js";

export interface SmtcHelperHandle {
  /** Terminates the helper process. */
  stop(): void;
}

export interface SpawnSmtcHelperOptions {
  readonly helperPath: string;
  /** Called with the parsed payload, or `null` when the helper reports nothing playing. */
  readonly onEvent: (payload: NowPlayingPayload | null) => void;
  readonly onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  readonly onStderr?: (line: string) => void;
  /** Called when the process itself fails to spawn (missing/misplaced exe, wrong
   * architecture, blocked by AV, etc). Without a listener here, Node's `ChildProcess`
   * — an `EventEmitter` — throws on an unhandled `'error'` event by default, which
   * crashes the entire host (Electron main) process; this is the one lifecycle event
   * this helper has never actually been run/tested against in this sandbox (no
   * Windows toolchain available), making it the single highest-risk gap to leave
   * unhandled. */
  readonly onError?: (error: unknown) => void;
  /** Injectable for testing; defaults to `node:child_process`'s `spawn`. */
  readonly spawnImpl?: typeof nodeSpawn;
}

/**
 * Spawns the compiled `SmtcHelper.exe` and turns its newline-delimited JSON stdout into
 * parsed now-playing payloads. Unlike the macOS adapter, this runs the helper directly
 * (no trampoline process needed — SMTC has no equivalent of MediaRemote's entitlement
 * lockdown; see docs/adr/0009-windows-smtc-integration.md).
 */
export function spawnSmtcHelper(options: SpawnSmtcHelperOptions): SmtcHelperHandle {
  const spawnImpl = options.spawnImpl ?? nodeSpawn;

  const child = spawnImpl(options.helperPath, [], {
    stdio: ["ignore", "pipe", "pipe"],
  }) as ChildProcess;

  // Always attach a listener, even with no `onError` given, so a spawn failure never
  // crashes the host process by falling through to EventEmitter's unhandled-'error'
  // default (see the option's own docstring above for why this matters here
  // specifically). Mirrors `packages/adapter-macos`'s equivalent `child.on("error", ...)`.
  const onError = options.onError;
  child.on("error", (error: unknown) => {
    onError?.(error);
  });

  if (child.stdout) {
    const stdoutLines = createInterface({ input: child.stdout });
    stdoutLines.on("line", (line) => {
      const parsed = parseStreamLine(line);
      if (parsed !== undefined) {
        options.onEvent(parsed);
      }
    });
  }

  if (child.stderr && options.onStderr) {
    const onStderr = options.onStderr;
    const stderrLines = createInterface({ input: child.stderr });
    stderrLines.on("line", (line) => {
      onStderr(line);
    });
  }

  if (options.onExit) {
    child.on("exit", options.onExit);
  }

  return {
    stop(): void {
      child.kill();
    },
  };
}
