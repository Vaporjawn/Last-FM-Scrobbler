import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

// Real integration smoke test against the vendored, compiled MediaRemoteAdapter
// pipeline — no mocks. Only meaningful on macOS with the framework actually built
// (`npm run build:native`), and CI has no guarantee anything is playing, so this only
// asserts the pipeline produces *some* well-formed `type: "data"` event, not specific
// track metadata. See VENDORED.md and docs/adr/0008-macos-mediaremote-entitlement.md
// for what this is actually exercising and why it can't be a plain unit test.
const packageDir = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = join(packageDir, "vendor/mediaremote-adapter/bin/mediaremote-adapter.pl");
const frameworkPath = join(packageDir, "native-build/MediaRemoteAdapter.framework");
const canRun = process.platform === "darwin" && existsSync(frameworkPath);

describe.skipIf(!canRun)("mediaremote-adapter (real pipeline)", () => {
  it("streams at least one well-formed now-playing event", async () => {
    const child = spawn("/usr/bin/perl", [scriptPath, frameworkPath, "stream"]);
    const lines = createInterface({ input: child.stdout });

    try {
      const firstEvent = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("no output from mediaremote-adapter within 10s"));
        }, 10_000);

        lines.on("line", (line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          clearTimeout(timeout);
          resolve(JSON.parse(trimmed));
        });

        child.on("error", (error: unknown) => {
          clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });

      expect(firstEvent).toMatchObject({ type: "data" });
    } finally {
      lines.close();
      child.kill();
    }
  }, 15_000);
});
