import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { spawnSmtcHelper } from "../../src/smtc/spawn-smtc-helper.js";

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: (signal?: NodeJS.Signals) => boolean;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn(() => true);
  return child;
}

describe("spawnSmtcHelper", () => {
  it("spawns the helper executable directly with no arguments", () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);

    spawnSmtcHelper({
      helperPath: "C:\\app\\native-build\\SmtcHelper.exe",
      onEvent: () => undefined,
      spawnImpl,
    });

    expect(spawnImpl).toHaveBeenCalledWith(
      "C:\\app\\native-build\\SmtcHelper.exe",
      [],
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
    );
  });

  it("parses stdout lines: object payloads, literal null, and skips unparseable lines", async () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const events: unknown[] = [];

    spawnSmtcHelper({
      helperPath: "C:\\SmtcHelper.exe",
      onEvent: (event) => events.push(event),
      spawnImpl,
    });

    fakeChild.stdout.write(
      `${JSON.stringify({ title: "Song", sourceAppUserModelId: "App.exe" })}\n`,
    );
    fakeChild.stdout.write("garbage\n");
    fakeChild.stdout.write("null\n");
    fakeChild.stdout.end();

    await new Promise((resolve) => setImmediate(resolve));

    expect(events).toEqual([{ title: "Song", sourceAppUserModelId: "App.exe" }, null]);
  });

  it("calls onExit when the child process exits", () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const onExit = vi.fn();

    spawnSmtcHelper({
      helperPath: "C:\\SmtcHelper.exe",
      onEvent: () => undefined,
      onExit,
      spawnImpl,
    });

    fakeChild.emit("exit", 1, null);

    expect(onExit).toHaveBeenCalledWith(1, null);
  });

  it("stop() kills the child process", () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);

    const handle = spawnSmtcHelper({
      helperPath: "C:\\SmtcHelper.exe",
      onEvent: () => undefined,
      spawnImpl,
    });
    handle.stop();

    expect(fakeChild.kill).toHaveBeenCalled();
  });

  it("forwards stderr lines to onStderr when provided", async () => {
    const fakeChild = createFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fakeChild);
    const onStderr = vi.fn();

    spawnSmtcHelper({
      helperPath: "C:\\SmtcHelper.exe",
      onEvent: () => undefined,
      onStderr,
      spawnImpl,
    });

    fakeChild.stderr.write("SmtcHelper: System.Exception: boom\n");
    fakeChild.stderr.end();

    await new Promise((resolve) => setImmediate(resolve));

    expect(onStderr).toHaveBeenCalledWith("SmtcHelper: System.Exception: boom");
  });
});
