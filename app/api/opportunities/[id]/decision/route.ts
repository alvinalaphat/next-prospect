import { isAuthorized, unauthorized } from '@/lib/auth';
import { getOpportunity } from '@/lib/db';
import { applyOpportunityDecision } from '@/lib/opportunity-decision';
import { approvalSchema } from '@/lib/types';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return unauthorized();
  const { id } = await ctx.params;
  const parsed = approvalSchema.safeParse({ by: 'dashboard', ...await request.json(), via: 'dashboard' });
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  if (parsed.data.decision === 'rejected' &&
    parsed.data.rejectionReasons.length === 0 && !parsed.data.rejectionContext) {
    return Response.json({ error: 'Select a reason or add context.' }, { status: 400 });
  }
  const opportunity = await getOpportunity(id);
  if (!opportunity?.approvalToken || opportunity.status !== 'awaiting_approval') {
    return Response.json({ error: 'Not awaiting approval' }, { status: 409 });
  }
  const result = await applyOpportunityDecision(opportunity.approvalToken, parsed.data);
  if (!result.applied) return Response.json({ error: 'Decision was not applied' }, { status: 409 });
  return Response.json({ ok: true, gmailError: result.gmailError });
}
