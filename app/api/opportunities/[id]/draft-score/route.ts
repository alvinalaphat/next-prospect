import { start } from 'workflow/api';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { getOpportunity } from '@/lib/db';
import { workflowScoreDraft } from '@/workflows/draft-score';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) return Response.json({ error: 'Opportunity not found' }, { status: 404 });
  return Response.json({ score: opportunity.draft?.draftScore ?? null });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return unauthorized();

  const { id } = await ctx.params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) return Response.json({ error: 'Opportunity not found' }, { status: 404 });
  if (!opportunity.draft) return Response.json({ error: 'Draft not found' }, { status: 409 });
  if (opportunity.draft.draftScore != null) {
    return Response.json({ score: opportunity.draft.draftScore });
  }

  const run = await start(workflowScoreDraft, [id]);
  return Response.json({ runId: run.runId }, { status: 202 });
}
