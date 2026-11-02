import { isAuthorized, unauthorized } from '@/lib/auth';
import { getOpportunity, updateOpportunity } from '@/lib/db';
import { createOpportunityGmailDraft, isGmailConfigured } from '@/lib/gmail';
import { updateOpportunityApprovalMessage } from '@/lib/slack';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return unauthorized();
  if (!isGmailConfigured()) {
    return Response.json({ error: 'Gmail is not configured (run pnpm gmail:auth)' }, { status: 503 });
  }
  const { id } = await ctx.params;
  const opportunity = await getOpportunity(id);
  if (!opportunity || opportunity.status !== 'approved') {
    return Response.json({ error: 'Only approved opportunities get drafts' }, { status: 409 });
  }
  try {
    const gmailDraft = await createOpportunityGmailDraft(opportunity);
    const updated = await updateOpportunity(id, { gmailDraft, gmailError: null });
    if (updated?.slack) await updateOpportunityApprovalMessage(updated).catch(() => {});
    return Response.json({ gmailDraft });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateOpportunity(id, { gmailError: message });
    return Response.json({ error: message }, { status: 502 });
  }
}
