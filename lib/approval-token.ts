/** Identifies one review card for one run. A later re-run gets a new token. */
export const approvalToken = (
  target: string,
  runId: string,
  kind: 'prospect' | 'opportunity' = 'prospect'
) => `${kind === 'opportunity' ? 'opportunity' : 'approval'}:${target}:${runId}`;

export type ParsedApprovalToken =
  | { kind: 'prospect'; domain: string; runId: string }
  | { kind: 'opportunity'; opportunityId: string; runId: string };

export function parseApprovalToken(token: string): ParsedApprovalToken | null {
  const match = /^(approval|opportunity):([^:]+):(.+)$/.exec(token);
  if (!match) return null;
  return match[1] === 'opportunity'
    ? { kind: 'opportunity', opportunityId: match[2], runId: match[3] }
    : { kind: 'prospect', domain: match[2], runId: match[3] };
}
