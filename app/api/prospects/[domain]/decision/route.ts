import { z } from 'zod';
import { applyDecision } from '@/lib/decision';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { getProspect } from '@/lib/db';

const bodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  by: z.string().min(1).default('dashboard'),
  editedDraft: z.object({ subject: z.string(), body: z.string() }).optional()
});

/** POST /api/prospects/:domain/decision — approve/reject from the dashboard. */
export async function POST(request: Request, ctx: { params: Promise<{ domain: string }> }) {
  if (!isAuthorized(request)) return unauthorized();
  const { domain } = await ctx.params;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });

  const prospect = await getProspect(domain);
  if (!prospect?.approvalToken || prospect.status !== 'awaiting_approval') {
    return Response.json({ error: 'Not awaiting approval' }, { status: 409 });
  }

  const result = await applyDecision(prospect.approvalToken, { ...parsed.data, via: 'dashboard' });
  if (!result.applied) {
    const error = result.reason === 'already_decided' ? 'Already decided' : 'Not awaiting approval';
    return Response.json({ error }, { status: 409 });
  }

  return Response.json({ ok: true, gmailError: result.gmailError });
}
