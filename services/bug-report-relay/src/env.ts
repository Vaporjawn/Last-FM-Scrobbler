export interface Env {
  /** Classic PAT with the `public_repo` scope (this repo's own explicit choice — see
   * docs/adr/0004-anonymous-bug-report-relay.md; a fine-grained PAT scoped to just this
   * repo's `issues:write` would be narrower, but classic is what's actually in use).
   * `public_repo` itself already covers every public repo the token's owner can access,
   * not just this one — narrower than full `repo` scope (which also reaches private
   * repos), but broader than a repo-scoped fine-grained PAT would be. Set via
   * `wrangler secret put GITHUB_PAT`, never committed and never shipped inside the
   * distributed desktop app. */
  readonly GITHUB_PAT: string;
}
