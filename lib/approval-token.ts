/** Identifies one review card for one run. A later re-run gets a new token. */
export const approvalToken = (
  opportunityId: string,
  runId: string
) => `opportunity:${opportunityId}:${runId}`;

export type ParsedApprovalToken = { opportunityId: string; runId: string };

export function parseApprovalToken(token: string): ParsedApprovalToken | null {
  const match = /^opportunity:([^:]+):(.+)$/.exec(token);
  if (!match) return null;
  return { opportunityId: match[1], runId: match[2] };
}
