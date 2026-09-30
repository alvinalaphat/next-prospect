import { z } from 'zod';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { getProspect } from '@/lib/db';
import { approvalHook } from '@/workflows/outbound/hooks';

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
  if (!prospect?.approvalToken) {
    return Response.json({ error: 'Not awaiting approval' }, { status: 409 });
  }

  await approvalHook.resume(prospect.approvalToken, { ...parsed.data, via: 'dashboard' });
  return Response.json({ ok: true });
}
