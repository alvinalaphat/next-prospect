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

  const count = (f: (i: ProspectListItem) => boolean) => items.filter(f).length;
  const stats = [
    { label: 'Accounts', hint: 'Companies researched', value: items.length },
    {
      label: 'Opportunities',
      hint: 'Current product conversations',
      value: currentOpportunities.length
    },
    { label: 'Expansion', hint: 'Existing Vercel footprint', value: currentOpportunities.filter((o) => o.salesMotion === 'expansion').length },
    { label: 'Needs review', hint: 'Drafts waiting on you', value: currentOpportunities.filter((o) => o.status === 'awaiting_approval').length },
    { label: 'Approved', hint: 'Product opportunities accepted', value: currentOpportunities.filter((o) => o.status === 'approved').length }
  ];
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

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s, index) => (
          <div
            key={s.label}
            className={`bg-background px-4 py-4 ${index === stats.length - 1 ? 'col-span-2 sm:col-span-2 xl:col-span-1' : ''}`}
          >
            <dt className="text-sm font-medium">{s.label}</dt>
            <dd className="mt-2 font-mono text-2xl tabular-nums">{s.value}</dd>
            <p className="text-muted-foreground mt-1 text-xs leading-normal">{s.hint}</p>
          </div>
        ))}
      </dl>

      <ProspectsTable items={items} renderedAt={renderedAt} />
    </div>
  );
}
