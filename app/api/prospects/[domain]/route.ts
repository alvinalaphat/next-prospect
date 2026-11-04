import { eq } from 'drizzle-orm';
import { getRun } from 'workflow/api';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { cancelProspectRun, db, expireOpportunities, getOpportunities, getProspect, schema } from '@/lib/db';
import { markSuperseded } from '@/lib/slack';

/** Cancel the durable run for an account that is still in flight. */
export async function PATCH(request: Request, ctx: { params: Promise<{ domain: string }> }) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (body?.action !== 'cancel') {
    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const { domain } = await ctx.params;
  const prospect = await getProspect(domain);
  if (!prospect) return Response.json({ error: 'Account not found' }, { status: 404 });
  if (!prospect.runId) {
    return Response.json({ error: 'This account does not have a workflow run to cancel' }, { status: 409 });
  }

  const run = getRun(prospect.runId);
  const runStatus = await run.status;
  if (runStatus === 'pending' || runStatus === 'running') await run.cancel();
  else if (runStatus !== 'cancelled') {
    return Response.json({ error: 'This workflow run has already finished' }, { status: 409 });
  }

  if (!(await cancelProspectRun(domain, prospect.runId))) {
    return Response.json({ error: 'This account now belongs to a different workflow run' }, { status: 409 });
  }
  await expireOpportunities(domain, prospect.runId);
  return Response.json({ ok: true });
}

/** Delete an account and its opportunities. The foreign key cascades safely. */
export async function DELETE(request: Request, ctx: { params: Promise<{ domain: string }> }) {
  if (!isAuthorized(request)) return unauthorized();
  const { domain } = await ctx.params;
  const prospect = await getProspect(domain);
  if (!prospect) return Response.json({ error: 'Account not found' }, { status: 404 });

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET) {
    const opportunities = await getOpportunities(domain);
    await Promise.all(
      [prospect.slack, ...opportunities.map((opportunity) => opportunity.slack)]
        .filter((slack): slack is { channel: string; ts: string } => !!slack)
        .map((slack) =>
          markSuperseded(slack, domain, 'This account was deleted from NextProspect.').catch(() => {})
        )
    );
  }

  await db().delete(schema.prospects).where(eq(schema.prospects.domain, domain));
  return Response.json({ ok: true });
}
