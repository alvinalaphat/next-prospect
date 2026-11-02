import { z } from 'zod';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { getOpportunity } from '@/lib/db';
import { applyOpportunityDecision } from '@/lib/opportunity-decision';

const bodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  by: z.string().min(1).default('dashboard'),
  editedDraft: z.object({ subject: z.string(), body: z.string() }).optional()
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) return unauthorized();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const opportunity = await getOpportunity(id);
  if (!opportunity?.approvalToken || opportunity.status !== 'awaiting_approval') {
    return Response.json({ error: 'Not awaiting approval' }, { status: 409 });
  }
  const result = await applyOpportunityDecision(opportunity.approvalToken, {
    ...parsed.data,
    via: 'dashboard'
  });
  if (!result.applied) return Response.json({ error: 'Decision was not applied' }, { status: 409 });
  return Response.json({ ok: true, gmailError: result.gmailError });
}
