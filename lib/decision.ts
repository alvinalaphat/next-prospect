import { and, eq, sql } from 'drizzle-orm';
import { parseApprovalToken } from '@/lib/approval-token';
import { db, getProspect, schema, upsertProspect } from '@/lib/db';
import { createGmailDraft, isGmailConfigured } from '@/lib/gmail';
import { markSuperseded, updateApprovalMessage } from '@/lib/slack';
import type { Approval } from '@/lib/types';

export type DecisionResult =
  | { applied: true; gmailError: string | null }
  | { applied: false; reason: 'invalid_token' | 'not_awaiting' | 'already_decided' | 'stale' };

/**
 * Record Approve / Reject for the run that posted this token, then create a
 * Gmail draft when the decision is an approval. A second click, or a click on
 * a card from an older run, does not overwrite the current prospect.
 */
export async function applyDecision(
  token: string,
  approval: Approval,
  clickedCard?: { channel: string; ts: string } | null
): Promise<DecisionResult> {
  const parsed = parseApprovalToken(token);
  if (!parsed || parsed.kind !== 'prospect') return { applied: false, reason: 'invalid_token' };

  const current = await getProspect(parsed.domain);
  if (!current?.draft) return { applied: false, reason: 'not_awaiting' };

  const draft =
    approval.decision === 'approved' && approval.editedDraft
      ? { ...current.draft, ...approval.editedDraft, editedBy: approval.by }
      : current.draft;

  const updated = await db()
    .update(schema.prospects)
    .set({
      status: approval.decision,
      approval,
      draft,
      approvalToken: null,
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(schema.prospects.domain, parsed.domain),
        eq(schema.prospects.approvalToken, token),
        eq(schema.prospects.status, 'awaiting_approval')
      )
    )
    .returning();

  const row = updated[0];
  if (!row) {
    await noteStaleCard(parsed.domain, approval, clickedCard);
    const again = await getProspect(parsed.domain);
    const replaced = again?.approvalToken != null && again.approvalToken !== token;
    return { applied: false, reason: replaced ? 'stale' : 'already_decided' };
  }

  let prospect = row;
  let gmailError: string | null = null;
  if (approval.decision === 'approved' && isGmailConfigured() && !prospect.gmailDraft) {
    try {
      const gmailDraft = await createGmailDraft(prospect);
      await upsertProspect(parsed.domain, { gmailDraft, gmailError: null });
      prospect = { ...prospect, gmailDraft, gmailError: null };
    } catch (err) {
      gmailError = err instanceof Error ? err.message : String(err);
      await upsertProspect(parsed.domain, { gmailError });
      prospect = { ...prospect, gmailError };
    }
  }

  if (prospect.slack) {
    await updateApprovalMessage(prospect).catch((err) => console.warn('slack update failed', err));
  }
  return { applied: true, gmailError };
}

async function noteStaleCard(
  domain: string,
  approval: Approval,
  clickedCard?: { channel: string; ts: string } | null
) {
  if (!clickedCard) return;
  const current = await getProspect(domain);
  const sameCard =
    current?.slack?.channel === clickedCard.channel && current.slack.ts === clickedCard.ts;
  if (sameCard) return;
  const verb = approval.decision === 'approved' ? 'approval' : 'rejection';
  await markSuperseded(
    clickedCard,
    domain,
    `Your ${verb} wasn't applied: this domain was re-run. Decide on the newer card.`
  ).catch((err) => console.warn('supersede failed', err));
}
