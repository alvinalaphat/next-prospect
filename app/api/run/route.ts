import { inArray } from 'drizzle-orm';
import { start } from 'workflow/api';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { db, schema, upsertProspect } from '@/lib/db';
import { parseDomains } from '@/lib/domains';
import type { ProspectStatus } from '@/lib/types';
import { workflowOutbound } from '@/workflows/outbound';

const IN_FLIGHT: ProspectStatus[] = [
  'queued',
  'detecting',
  'measuring',
  'researching',
  'qualifying',
  'drafting',
  'awaiting_approval'
];
const STAGGER_SECONDS = 4;
const MAX_DOMAINS = 250;

/**
 * POST /api/run — start one durable workflow per domain.
 * Body: JSON { domains: string[], force?: boolean } or a raw CSV / list.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const contentType = request.headers.get('content-type') ?? '';
  let input: string;
  let force = false;
  if (contentType.includes('application/json')) {
    const body = await request.json();
    input = Array.isArray(body.domains) ? body.domains.join('\n') : String(body.domains ?? '');
    force = body.force === true;
  } else {
    input = await request.text();
  }

  const { domains, invalid } = parseDomains(input);
  if (domains.length === 0) return Response.json({ error: 'No valid domains', invalid }, { status: 400 });
  if (domains.length > MAX_DOMAINS) {
    return Response.json({ error: `Max ${MAX_DOMAINS} domains per batch` }, { status: 400 });
  }

  // Don't start a second run for a domain that's mid-flight or awaiting approval.
  const existing = await db()
    .select({ domain: schema.prospects.domain, status: schema.prospects.status })
    .from(schema.prospects)
    .where(inArray(schema.prospects.domain, domains));
  const busy = new Set(
    existing.filter((p) => !force && IN_FLIGHT.includes(p.status)).map((p) => p.domain)
  );

  const batch = new Date().toISOString();
  const started: { domain: string; runId: string }[] = [];
  let i = 0;
  for (const domain of domains) {
    if (busy.has(domain)) continue;
    await upsertProspect(domain, {
      status: 'queued',
      batch,
      error: null,
      approval: null,
      approvalToken: null,
      slack: null
    });
    const run = await start(workflowOutbound, [domain, i * STAGGER_SECONDS]);
    await upsertProspect(domain, { runId: run.runId });
    started.push({ domain, runId: run.runId });
    i++;
  }

  return Response.json({ batch, started, skippedInFlight: [...busy], invalid });
}
