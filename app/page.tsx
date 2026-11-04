import { desc } from 'drizzle-orm';
import { AutoRefresh } from '@/components/auto-refresh';
import { ProspectsTable, type ProspectListItem } from '@/components/prospects-table';
import { RunPanel } from '@/components/run-panel';
import { db, schema } from '@/lib/db';
import { STATUS } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const renderedAt = Date.now();
  const p = schema.prospects;
  const [rows, allOpportunities] = await Promise.all([db()
    .select({
      domain: p.domain,
      runId: p.runId,
      status: p.status,
      fitScore: p.fitScore,
      updatedAt: p.updatedAt
    })
    .from(p)
    .orderBy(desc(p.updatedAt)), db().select().from(schema.opportunities).orderBy(desc(schema.opportunities.score))]);

  const currentOpportunities = allOpportunities.filter((opportunity) =>
    rows.some((row) => row.domain === opportunity.domain && row.runId === opportunity.runId)
  );
  const topOpportunity = new Map<string, (typeof currentOpportunities)[number]>();
  for (const opportunity of currentOpportunities) {
    if (!topOpportunity.has(opportunity.domain)) topOpportunity.set(opportunity.domain, opportunity);
  }

  const items: ProspectListItem[] = rows.map((r) => {
    const opportunity = topOpportunity.get(r.domain);
    return ({
    domain: r.domain,
    status: r.status,
    fitScore: opportunity?.score ?? r.fitScore,
    opportunityName: opportunity?.productName ?? null,
    updatedAt: r.updatedAt.toISOString()
  });
  });

  const running = items.some((i) => STATUS[i.status].group === 'running');

  return (
    <div className="space-y-6 sm:space-y-8">
      <AutoRefresh active={running} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-medium">Accounts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Research companies, rank Vercel product opportunities, and review every draft before anything is sent.
          </p>
        </div>
        <RunPanel />
      </div>

      <ProspectsTable items={items} renderedAt={renderedAt} />
    </div>
  );
}
