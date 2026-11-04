import { eq } from 'drizzle-orm';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { db, getOpportunities, getProspect, schema } from '@/lib/db';
import { markSuperseded } from '@/lib/slack';

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
