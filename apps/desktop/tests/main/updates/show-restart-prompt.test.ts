// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const dialog = vi.hoisted(() => ({ showMessageBox: vi.fn() }));

vi.mock("electron", () => ({ default: { dialog } }));

import { showRestartPrompt } from "../../../src/main/updates/show-restart-prompt.js";

describe("showRestartPrompt", () => {
  it("asks about the downloaded version on the given window", async () => {
    dialog.showMessageBox.mockResolvedValue({ response: 0 });
    const window = { tag: "window" } as never;

    await showRestartPrompt(window, "2.0.0");

    const [parent, options] = dialog.showMessageBox.mock.calls[0] as [
      unknown,
      { message: string; buttons: string[] },
    ];
    expect(parent).toBe(window);
    expect(options.message).toBe("Last.fm Scrobbler 2.0.0 has been downloaded.");
    expect(options.buttons).toEqual(["Restart Now", "Later"]);
  });

  it("resolves true only when the user chooses Restart Now", async () => {
    dialog.showMessageBox.mockResolvedValue({ response: 0 });
    await expect(showRestartPrompt({} as never, "2.0.0")).resolves.toBe(true);

    dialog.showMessageBox.mockResolvedValue({ response: 1 });
    await expect(showRestartPrompt({} as never, "2.0.0")).resolves.toBe(false);
  });
});
