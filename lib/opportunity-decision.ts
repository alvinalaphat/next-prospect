import { and, eq, sql } from 'drizzle-orm';
import { parseApprovalToken } from '@/lib/approval-token';
import { db, getOpportunities, getOpportunity, schema, updateOpportunity, upsertProspect } from '@/lib/db';
import { createOpportunityGmailDraft, isGmailConfigured } from '@/lib/gmail';
import { updateOpportunityApprovalMessage } from '@/lib/slack';
import type { Approval } from '@/lib/types';

export type OpportunityDecisionResult =
  | { applied: true; gmailError: string | null }
  | { applied: false; reason: 'invalid_token' | 'not_awaiting' | 'already_decided' | 'stale' };

export async function applyOpportunityDecision(
  token: string,
  decision: Approval
): Promise<OpportunityDecisionResult> {
  const parsed = parseApprovalToken(token);
  if (!parsed || parsed.kind !== 'opportunity') return { applied: false, reason: 'invalid_token' };
  const current = await getOpportunity(parsed.opportunityId);
  if (!current?.draft) return { applied: false, reason: 'not_awaiting' };
  const draft =
    decision.decision === 'approved' && decision.editedDraft
      ? { ...current.draft, ...decision.editedDraft, editedBy: decision.by }
      : current.draft;
  const rows = await db()
    .update(schema.opportunities)
    .set({
      status: decision.decision,
      decision,
      draft,
      approvalToken: null,
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(schema.opportunities.id, parsed.opportunityId),
        eq(schema.opportunities.approvalToken, token),
        eq(schema.opportunities.status, 'awaiting_approval')
      )
    )
    .returning();
  let opportunity = rows[0];
  if (!opportunity) {
    const again = await getOpportunity(parsed.opportunityId);
    return {
      applied: false,
      reason: again?.approvalToken && again.approvalToken !== token ? 'stale' : 'already_decided'
    };
  }

  let gmailError: string | null = null;
  if (decision.decision === 'approved' && isGmailConfigured() && !opportunity.gmailDraft) {
    try {
      const gmailDraft = await createOpportunityGmailDraft(opportunity);
      await updateOpportunity(opportunity.id, { gmailDraft, gmailError: null });
      opportunity = { ...opportunity, gmailDraft, gmailError: null };
    } catch (error) {
      gmailError = error instanceof Error ? error.message : String(error);
      await updateOpportunity(opportunity.id, { gmailError });
      opportunity = { ...opportunity, gmailError };
    }
  }
  if (opportunity.slack) {
    await updateOpportunityApprovalMessage(opportunity).catch((error) =>
      console.warn('slack opportunity update failed', error)
    );
  }
  const siblings = await getOpportunities(opportunity.domain, opportunity.runId);
  if (siblings.every((item) => item.status === 'approved' || item.status === 'rejected')) {
    await upsertProspect(opportunity.domain, {
      status: siblings.some((item) => item.status === 'approved') ? 'approved' : 'rejected'
    });
  }
  return { applied: true, gmailError };
}
