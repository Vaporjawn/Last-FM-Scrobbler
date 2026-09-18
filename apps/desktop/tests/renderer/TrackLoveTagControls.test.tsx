import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LastfmDataApi } from "../../src/shared/lastfm-api.js";
import { SnackbarProvider } from "../../src/renderer/src/contexts/SnackbarProvider.js";
import { TrackLoveTagControls } from "../../src/renderer/src/components/shared/TrackLoveTagControls.js";

/** `TrackLoveTagControls` fires snackbars via `useSnackbar()` on love/unlove/addTags —
 * a real `SnackbarProvider` (not present in a bare `render`) is needed for those to
 * actually render and be assertable. */
function renderWithSnackbar(): ReturnType<typeof render> {
  return render(
    <SnackbarProvider>
      <TrackLoveTagControls artist="Crumb" track="Ghostride" />
    </SnackbarProvider>,
  );
}

function installFakeLastfmApi(overrides: Partial<LastfmDataApi> = {}): LastfmDataApi {
  const api: LastfmDataApi = {
    getRecentTracks: vi.fn().mockResolvedValue([]),
    getTopArtists: vi.fn().mockResolvedValue([]),
    getTopTracks: vi.fn().mockResolvedValue([]),
    getTopAlbums: vi.fn().mockResolvedValue([]),
    getFriends: vi.fn().mockResolvedValue([]),
    getUserInfo: vi.fn().mockResolvedValue({ username: "someuser" }),
    getLovedTracksCount: vi.fn().mockResolvedValue(0),
    getArtistInfo: vi.fn().mockResolvedValue({ name: "Crumb", listeners: 0, playCount: 0 }),
    getSimilarArtists: vi.fn().mockResolvedValue([]),
    getTopTags: vi.fn().mockResolvedValue([]),
    getTrackInfo: vi.fn().mockResolvedValue({
      artist: "Crumb",
      track: "Ghostride",
      listeners: 0,
      playCount: 0,
      loved: false,
      url: "https://www.last.fm/music/Crumb/_/Ghostride",
    }),
    loveTrack: vi.fn().mockResolvedValue(undefined),
    unloveTrack: vi.fn().mockResolvedValue(undefined),
    addTags: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  Object.defineProperty(window, "lastfm", { value: api, configurable: true });
  return api;
}

describe("TrackLoveTagControls", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "lastfm");
  });

  it("adds tags and closes the popover on success", async () => {
    const addTags = vi.fn().mockResolvedValue(undefined);
    installFakeLastfmApi({ addTags });
    renderWithSnackbar();

    fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
    const input = await screen.findByPlaceholderText("tags, separated, by commas");
    fireEvent.change(input, { target: { value: "mellow, guitar" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(addTags).toHaveBeenCalledWith("Crumb", "Ghostride", ["mellow", "guitar"]);
    });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("tags, separated, by commas")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Tags added.")).toBeInTheDocument();
  });

  it("submits the tag popover when Enter is pressed in the field, not just by clicking Add", async () => {
    // A real Enter keypress in a text <input> triggers a browser's native "implicit
    // form submission" — dispatching a `submit` event on the field's enclosing
    // <form> — which jsdom doesn't implement as a default action for simulated keydown
    // events (see https://github.com/jsdom/jsdom/issues/3117). So this exercises that
    // same mechanism directly instead of simulating the keypress itself: proving both
    // that the field now sits inside a real <form> (it didn't before this fix — Enter
    // did nothing) and that submitting it invokes the same add-tags flow as clicking
    // "Add" does.
    const addTags = vi.fn().mockResolvedValue(undefined);
    installFakeLastfmApi({ addTags });
    renderWithSnackbar();

    fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
    const input = await screen.findByPlaceholderText("tags, separated, by commas");
    fireEvent.change(input, { target: { value: "mellow, guitar" } });

    const form = input.closest("form");
    if (!form) {
      throw new Error("Expected the tag input to be wrapped in a <form>.");
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(addTags).toHaveBeenCalledWith("Crumb", "Ghostride", ["mellow", "guitar"]);
    });
  });

  it("keeps the popover open with the typed input intact when addTags fails", async () => {
    // Regression test: handleAddTags used to close the popover (discarding whatever
    // the user had typed) unconditionally, even on failure — a transient error (e.g.
    // a network blip) forced a full retype to try again instead of leaving the
    // popover open with the input the user already entered.
    installFakeLastfmApi({ addTags: vi.fn().mockRejectedValue(new Error("network error")) });
    renderWithSnackbar();

    fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
    const input = await screen.findByPlaceholderText("tags, separated, by commas");
    fireEvent.change(input, { target: { value: "mellow, guitar" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("network error")).toBeInTheDocument();
    // The popover — and the user's typed input — must still be there.
    expect(screen.getByPlaceholderText("tags, separated, by commas")).toHaveValue("mellow, guitar");
  });

  it("toggles loved state and shows a snackbar on love/unlove", async () => {
    const loveTrack = vi.fn().mockResolvedValue(undefined);
    installFakeLastfmApi({ loveTrack });
    renderWithSnackbar();

    fireEvent.click(screen.getByRole("button", { name: "Love this track" }));

    await waitFor(() => {
      expect(loveTrack).toHaveBeenCalledWith("Crumb", "Ghostride");
    });
    expect(await screen.findByText("Loved.")).toBeInTheDocument();
  });
});
