/** Identifies the review card for one run. A later re-run gets a new token. */
export const approvalToken = (domain: string, runId: string) => `approval:${domain}:${runId}`;

export function parseApprovalToken(token: string): { domain: string; runId: string } | null {
  const match = /^approval:([^:]+):(.+)$/.exec(token);
  if (!match) return null;
  return { domain: match[1], runId: match[2] };
}
