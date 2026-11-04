import { inArray } from 'drizzle-orm';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { parseDomains } from '@/lib/domains';
import { markSuperseded } from '@/lib/slack';

const MAX_DOMAINS = 250;

/** Delete several accounts and their cascading opportunity data in one operation. */
export async function DELETE(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null) as { domains?: unknown } | null;
  if (!Array.isArray(body?.domains)) {
    return Response.json({ error: 'domains must be an array' }, { status: 400 });
  }

  const { domains, invalid } = parseDomains(body.domains.map(String).join('\n'));
  if (invalid.length > 0) {
    return Response.json({ error: 'One or more domains are invalid', invalid }, { status: 400 });
  }
  if (domains.length === 0) return Response.json({ error: 'No valid domains' }, { status: 400 });
  if (domains.length > MAX_DOMAINS) {
    return Response.json({ error: `Max ${MAX_DOMAINS} domains per batch` }, { status: 400 });
  }

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET) {
    const opportunities = await db()
      .select({ domain: schema.opportunities.domain, slack: schema.opportunities.slack })
      .from(schema.opportunities)
      .where(inArray(schema.opportunities.domain, domains));
    await Promise.all(
      opportunities
        .filter((opportunity): opportunity is typeof opportunity & {
          slack: { channel: string; ts: string };
        } => !!opportunity.slack)
        .map((opportunity) =>
          markSuperseded(
            opportunity.slack,
            opportunity.domain,
            'This account was deleted from NextProspect.'
          ).catch(() => {})
        )
    );
  }

  const deleted = await db()
    .delete(schema.prospects)
    .where(inArray(schema.prospects.domain, domains))
    .returning({ domain: schema.prospects.domain });
  const deletedDomains = deleted.map((row) => row.domain);
  const deletedSet = new Set(deletedDomains);

  return Response.json({
    deleted: deletedDomains,
    missing: domains.filter((domain) => !deletedSet.has(domain))
  });
}
