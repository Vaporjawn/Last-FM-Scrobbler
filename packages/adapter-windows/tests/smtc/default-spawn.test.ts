import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { createWindowsPlaybackSource } from "../../src/smtc/create-windows-playback-source.js";
import { spawnSmtcHelper } from "../../src/smtc/spawn-smtc-helper.js";

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: () => boolean;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn(() => true);
  return child;
}

describe("default child_process.spawn", () => {
  it("spawnSmtcHelper falls back to node:child_process's spawn", () => {
    const child = createFakeChild();
    spawnMock.mockReturnValueOnce(child);

    spawnSmtcHelper({ helperPath: "C:\\SmtcHelper.exe", onEvent: () => undefined });

    expect(spawnMock).toHaveBeenCalledWith("C:\\SmtcHelper.exe", [], expect.any(Object));
  });

  it("createWindowsPlaybackSource falls back to node:child_process's spawn", () => {
    spawnMock.mockClear();
    spawnMock.mockReturnValueOnce(createFakeChild());
    const source = createWindowsPlaybackSource({
      resolveHelperPathImpl: () => ({ helperPath: "C:\\SmtcHelper.exe", helperBuilt: true }),
    });

    source.onTrackChanged(() => undefined);

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
