import { desc } from 'drizzle-orm';
import { AutoRefresh } from '@/components/auto-refresh';
import { ProspectsTable, type ProspectListItem } from '@/components/prospects-table';
import { RunPanel } from '@/components/run-panel';
import { db, schema } from '@/lib/db';
import { STATUS } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const p = schema.prospects;
  const rows = await db()
    .select({
      domain: p.domain,
      status: p.status,
      host: p.host,
      detection: p.detection,
      nextjsConfidence: p.nextjsConfidence,
      perfScore: p.perfScore,
      perf: p.perf,
      fitScore: p.fitScore,
      angle: p.angle,
      research: p.research,
      updatedAt: p.updatedAt
    })
    .from(p)
    .orderBy(desc(p.updatedAt));

  const items: ProspectListItem[] = rows.map((r) => ({
    domain: r.domain,
    status: r.status,
    host: r.host,
    cdn: r.detection?.host.cdn ?? null,
    router: r.detection?.nextjs.router ?? null,
    nextjsConfidence: r.nextjsConfidence,
    perfScore: r.perfScore,
    lcpMs: r.perf?.mobile.field.lcpMs ?? r.perf?.mobile.lab.lcpMs ?? null,
    ttfbMs: r.perf?.mobile.field.ttfbMs ?? r.perf?.mobile.lab.ttfbMs ?? null,
    fitScore: r.fitScore,
    angle: r.angle,
    stakeholder: r.research?.likelyBuyer?.name
      ? {
          name: r.research.likelyBuyer.name,
          title: r.research.likelyBuyer.title ?? null,
          linkedinUrl: r.research.likelyBuyer.linkedinUrl ?? null,
          email: r.research.buyerEmail?.address ?? null
        }
      : null,
    updatedAt: r.updatedAt.toISOString()
  }));

  const count = (f: (i: ProspectListItem) => boolean) => items.filter(f).length;
  const stats = [
    { label: 'Checked', hint: 'Sites you have run', value: items.length },
    {
      label: 'Off Vercel',
      hint: 'Next.js, hosted somewhere else',
      value: count((i) => (i.nextjsConfidence ?? 0) >= 50 && i.host !== 'vercel')
    },
    { label: 'On Vercel', hint: 'Already a customer, so skipped', value: count((i) => i.status === 'vercel_customer') },
    { label: 'Needs review', hint: 'Drafts waiting on you', value: count((i) => i.status === 'awaiting_approval') },
    { label: 'Approved', hint: 'Drafts you accepted', value: count((i) => i.status === 'approved') }
  ];
  const running = items.some((i) => STATUS[i.status].group === 'running');

  return (
    <div className="space-y-6 sm:space-y-8">
      <AutoRefresh active={running} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-medium">Prospects</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Paste sites to research. You approve every draft before anything is sent.
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

      <ProspectsTable items={items} />
    </div>
  );
}
