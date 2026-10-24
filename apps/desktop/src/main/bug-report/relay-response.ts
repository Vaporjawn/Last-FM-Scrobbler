/** The relay's reply to an accepted bug report: the GitHub issue it filed on the user's behalf. */
export interface RelayResponse {
  readonly issueUrl: string;
  readonly issueNumber: number;
}
