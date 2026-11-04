import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { AutoRefresh } from '@/components/auto-refresh';
import { Score, StatusBadge } from '@/components/badges';
import { Disclosure } from '@/components/disclosure';
import { OpportunityCards } from '@/components/opportunity-cards';
import { WorkflowRetryButton } from '@/components/workflow-retry-button';
import { contactActivityEvidence } from '@/lib/contact-activity';
import { getOpportunities, getProspect } from '@/lib/db';
import { STATUS } from '@/lib/format';
import { precedentEvidence } from '@/lib/grounding';
import { buyerRegionEvidence } from '@/lib/region';
import type { Research } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProspectPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const prospect = await getProspect(decodeURIComponent(domain));
  if (!prospect) notFound();
  const opportunities = prospect.runId
    ? await getOpportunities(prospect.domain, prospect.runId)
    : [];
  const detection = prospect.detection;
  const research = prospect.research;
  const ledger = [
    ...(prospect.evidence ?? []),
    ...precedentEvidence(research),
    ...opportunities.flatMap((opportunity) => [
      ...contactActivityEvidence(opportunity.contactActivity ?? []),
      ...buyerRegionEvidence(opportunity.contact, opportunity.id)
    ])
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
  const running = STATUS[prospect.status].group === 'running';
  const topScore = opportunities[0]?.score ?? prospect.fitScore;

  return (
    <div className="min-w-0 space-y-10 pb-8 sm:space-y-12">
      <AutoRefresh active={running} />

      <header className="w-full min-w-0 max-w-5xl space-y-6">
        <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="size-4" /> Accounts
        </Link>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{research?.companyName || prospect.domain}</h1>
              <StatusBadge status={prospect.status} />
            </div>
            <a
              href={detection?.finalUrl ?? `https://${prospect.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1.5 font-mono text-sm"
            >
              {prospect.domain} <ArrowUpRight className="size-3" />
            </a>
          </div>
          <dl className="flex gap-8 text-sm sm:justify-end">
            <Stat label="Product opportunities">
              <span className="font-mono text-lg tabular-nums">{opportunities.length}</span>
            </Stat>
            <Stat label="Top score">
              <Score value={topScore} thresholds={[35, 60]} suffix="/100" showRating={false} />
            </Stat>
          </dl>
        </div>
        {prospect.status === 'error' && prospect.error && (
          <div
            className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden rounded-lg border border-error/40 px-4 py-4 text-sm text-error sm:flex-row sm:items-start sm:justify-between"
            role="alert"
            style={{ boxSizing: 'border-box', maxWidth: 'min(64rem, calc(100vw - 2rem))' }}
          >
            <p
              className="min-w-0 leading-6"
              style={{ maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-all' }}
            >
              {prospect.error}
            </p>
            <WorkflowRetryButton domain={prospect.domain} />
          </div>
        )}
      </header>

      {research && hasCompanyContext(research) && <CompanyBackground research={research} />}

      <OpportunityCards opportunities={opportunities} ledger={ledger} />
    </div>
  );
}
function hasCompanyContext(research: Research) {
  return Boolean(research.summary.text || research.sizeSignals.length || research.news.length || research.whyNow.length || research.precedents?.length);
}

function CompanyBackground({ research }: { research: Research }) {
  return (
    <section aria-labelledby="company-background-title" className="max-w-5xl rounded-xl bg-hover p-5 sm:p-6">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Company context</p>
      <h2 id="company-background-title" className="mt-2 text-lg font-semibold tracking-tight">
        What to know about {research.companyName}
      </h2>
      {research.summary.text && (
        <p className="mt-3 max-w-3xl text-sm leading-6 sm:text-base">
          {research.summary.text} <Source url={research.summary.sourceUrl} />
        </p>
      )}
      <div className="mt-5 grid gap-2">
        <ResearchList title="Size and funding" items={research.sizeSignals} />
        <ResearchList
          title="Recent company signals"
          items={research.news.map((item) => ({ ...item, text: item.date ? `${item.date} — ${item.text}` : item.text }))}
        />
        <ResearchList title="Timing signals" items={research.whyNow} />
        <ResearchList
          title="Relevant Vercel customer precedent"
          noun="story"
          emptyText="No closely related Vercel customer story found."
          items={(research.precedents ?? []).map((precedent) => ({
            text: [
              `${precedent.companyName} is relevant because ${precedent.similarity}`,
              `Published outcome: ${precedent.outcome}`,
              precedent.products.length ? `Vercel products named: ${precedent.products.join(', ')}.` : ''
            ].filter(Boolean).join(' '),
            sourceUrl: precedent.sourceUrl
          }))}
        />
      </div>
    </section>
  );
}
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Source({ url }: { url: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-xs break-all underline decoration-dotted underline-offset-2">
      {host}
    </a>
  );
}

function ResearchList({
  title,
  items,
  noun = 'signal',
  emptyText = 'No public signals found.'
}: {
  title: string;
  items: { text: string; sourceUrl: string }[];
  noun?: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-background px-4 py-4">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-background px-4 sm:px-5">
      <Disclosure title={title} hint={`${items.length} ${noun}${items.length === 1 ? '' : 's'}`}>
        <ul className="space-y-4 text-sm">
          {items.map((item, index) => (
            <li key={index} className="leading-relaxed">
              {item.text} <Source url={item.sourceUrl} />
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
