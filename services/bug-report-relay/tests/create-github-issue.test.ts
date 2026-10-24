import { describe, expect, it, vi } from "vitest";
import { createGitHubIssue } from "../src/create-github-issue.js";
import { GitHubIssueCreationError } from "../src/github-issue-creation-error.js";

const REPORT = { title: "Crash", body: "Details here." };

describe("createGitHubIssue", () => {
  it("falls back to an empty detail when the failure response body cannot be read", async () => {
    const unreadable = {
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error("stream already consumed")),
    } as unknown as Response;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(unreadable);

    const failure = await createGitHubIssue(REPORT, "pat", fetchImpl).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(GitHubIssueCreationError);
    expect((failure as GitHubIssueCreationError).status).toBe(500);
    expect((failure as GitHubIssueCreationError).message).toBe("GitHub API returned 500: ");
  });

  it("includes GitHub's own detail in the thrown error when the body is readable", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Bad credentials", { status: 401 }));

    await expect(createGitHubIssue(REPORT, "pat", fetchImpl)).rejects.toThrow(
      "GitHub API returned 401: Bad credentials",
    );
  });
});
