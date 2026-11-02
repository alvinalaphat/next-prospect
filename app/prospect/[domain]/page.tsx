import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { AutoRefresh } from '@/components/auto-refresh';
import { Score, StatusBadge } from '@/components/badges';
import { Disclosure } from '@/components/disclosure';
import { OpportunityCards } from '@/components/opportunity-cards';
import { getOpportunities, getProspect } from '@/lib/db';
import { HOST_LABEL, ms, RATING_TONE, relativeTime, STATUS } from '@/lib/format';
import { rate } from '@/lib/psi';
import type { Detection, EvidenceItem, PerfResult, Research } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProspectPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const prospect = await getProspect(decodeURIComponent(domain));
  if (!prospect) notFound();
  const opportunities = await getOpportunities(prospect.domain, prospect.runId);

  const detection = prospect.detection;
  const research = prospect.research;
  const ledger = prospect.evidence ?? [];
  const running = STATUS[prospect.status].group === 'running';
  const topScore = opportunities[0]?.score ?? prospect.fitScore;

  return (
    <div className="min-w-0 space-y-10 pb-8 sm:space-y-12">
      <AutoRefresh active={running} />

      <header className="max-w-5xl space-y-6">
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
          <div className="rounded-lg border border-error/40 px-4 py-4 text-sm text-error" role="alert">
            {prospect.error}
          </div>
        )}
      </header>

      {research && hasCompanyContext(research) && <CompanyBackground research={research} />}

      <OpportunityCards opportunities={opportunities} ledger={ledger} />

      {(prospect.perf || detection || ledger.length > 0) && (
        <section aria-labelledby="supporting-evidence-title" className="max-w-5xl">
          <h2 id="supporting-evidence-title" className="text-lg font-semibold tracking-tight">Supporting evidence</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Technical checks and source receipts. Open these when you need to verify a recommendation.
          </p>
          <div className="mt-5 grid gap-3">
            {prospect.perf && (
              <DisclosureSurface>
                <Disclosure title="Real-user speed" hint={speedHint(prospect.perf.mobile, prospect.perf.desktop)}>
                  <div className="mb-4 flex justify-end">
                    <a
                      className="text-muted-foreground hover:text-foreground text-xs"
                      href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(detection?.finalUrl ?? `https://${prospect.domain}/`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open PageSpeed <ArrowUpRight className="ml-1 inline size-3" />
                    </a>
                  </div>
                  <VitalsTable mobile={prospect.perf.mobile} desktop={prospect.perf.desktop} />
                  <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    Real-user values are the CrUX 75th percentile{prospect.perf.mobile.field.scope === 'origin' ? ' for the whole site' : ''}. Lab values come from one Lighthouse run.
                  </p>
                </Disclosure>
              </DisclosureSurface>
            )}

            {detection && (
              <DisclosureSurface>
                <Disclosure title="Stack detection" hint={detectionHint(detection, prospect.host)}>
                  <p className="text-muted-foreground mb-4 text-xs break-all">
                    Checked {relativeTime(detection.fetchedAt)} · GET {detection.fetchedUrl} → {detection.status ?? '—'}
                    {detection.finalUrl && detection.finalUrl !== detection.fetchedUrl && ` → ${detection.finalUrl}`}
                    {detection.outcome !== 'ok' && ` · ${detection.outcome}`}
                  </p>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <SignalList title="Next.js" signals={detection.nextjs.signals} />
                    <SignalList title="Hosting" signals={detection.host.signals.map((signal) => ({ ...signal, label: `${signal.label} → ${signal.host}` }))} />
                  </div>
                  {(detection.dns.cname.length > 0 || detection.dns.a.length > 0) && (
                    <div className="text-muted-foreground mt-5 font-mono text-xs break-all">
                      {detection.dns.cname.map((cname) => <div key={cname}>CNAME {cname}</div>)}
                      {detection.dns.a.map((address) => <div key={address}>A {address}</div>)}
                    </div>
                  )}
                  <div className="mt-5 rounded-lg bg-background px-4">
                    <Disclosure title="Response headers" hint={`${Object.keys(detection.headers).length} headers`}>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-hover p-4 font-mono text-xs">
                        {Object.entries(detection.headers).map(([key, value]) => `${key}: ${value}`).join('\n')}
                      </pre>
                    </Disclosure>
                  </div>
                </Disclosure>
              </DisclosureSurface>
            )}

            {ledger.length > 0 && (
              <DisclosureSurface>
                <Disclosure id="evidence-ledger" title="Source receipts" hint={`${ledger.length} sources behind the recommendations`}>
                  <p className="text-muted-foreground mb-4 text-xs">Every generated claim must point to one of these records.</p>
                  <ul className="space-y-4">
                    {ledger.map((evidence) => <LedgerRow key={evidence.id} e={evidence} />)}
                  </ul>
                </Disclosure>
              </DisclosureSurface>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function hasCompanyContext(research: Research) {
  return Boolean(research.summary.text || research.sizeSignals.length || research.news.length || research.whyNow.length);
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
      </div>
    </section>
  );
}

function DisclosureSurface({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-hover px-4 sm:px-5">{children}</div>;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function speedHint(mobile: PerfResult, desktop: PerfResult) {
  return `Mobile LCP ${ms(mobile.field.lcpMs)}, server ${ms(mobile.field.ttfbMs)}. Desktop LCP ${ms(desktop.field.lcpMs)}, server ${ms(desktop.field.ttfbMs)}.`;
}

function detectionHint(detection: Detection, host: string | null) {
  const router = detection.nextjs.router === 'app' ? 'App Router' : detection.nextjs.router === 'pages' ? 'Pages Router' : 'Next.js';
  const confidence = Math.round(detection.nextjs.confidence * 100);
  const hostName = host && host in HOST_LABEL ? HOST_LABEL[host as keyof typeof HOST_LABEL] : host;
  const cdn = detection.host.cdn && detection.host.cdn in HOST_LABEL ? HOST_LABEL[detection.host.cdn] : null;
  return `${router}, ${confidence}% match. Hosted on ${hostName ?? 'an unknown host'}${cdn ? `, behind ${cdn}` : ''}.`;
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

function ResearchList({ title, items }: { title: string; items: { text: string; sourceUrl: string }[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-background px-4 py-4">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">No public signals found.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-background px-4 sm:px-5">
      <Disclosure title={title} hint={`${items.length} ${items.length === 1 ? 'signal' : 'signals'}`}>
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

function SignalList({ title, signals }: { title: string; signals: { id: string; label: string; match: string }[] }) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">{title}</h3>
      {signals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No signals matched.</p>
      ) : (
        <ul className="space-y-3">
          {signals.map((signal) => (
            <li key={signal.id} className="text-sm">
              <div>{signal.label}</div>
              <code className="text-muted-foreground block truncate font-mono text-xs" title={signal.match}>{signal.match}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VitalsTable({ mobile, desktop }: { mobile: PerfResult; desktop: PerfResult }) {
  const rows: { label: string; metric: 'lcpMs' | 'inpMs' | 'clsScore' | 'ttfbMs'; fmt: (n: number | null) => string }[] = [
    { label: 'LCP', metric: 'lcpMs', fmt: ms },
    { label: 'INP', metric: 'inpMs', fmt: ms },
    { label: 'CLS', metric: 'clsScore', fmt: (n) => (n == null ? '—' : n.toFixed(2)) },
    { label: 'TTFB', metric: 'ttfbMs', fmt: ms }
  ];
  const cell = (result: PerfResult, row: (typeof rows)[number], kind: 'field' | 'lab') => {
    const value = kind === 'field' ? result.field[row.metric] : row.metric === 'inpMs' ? null : result.lab[row.metric];
    const rating = rate(row.metric, value);
    const color = rating ? { green: 'text-positive', amber: 'text-warning', red: 'text-error' }[RATING_TONE[rating]] : 'text-muted-foreground';
    const label = rating ? { good: 'Good', 'needs-improvement': 'Needs improvement', poor: 'Poor' }[rating] : null;
    return (
      <td className="px-2 py-3 text-right align-top sm:px-4">
        <span className="font-mono tabular-nums">{row.fmt(value)}</span>
        {label && <span className={`mt-0.5 block text-xs leading-snug sm:mt-0 sm:ml-2 sm:inline ${color}`}>{label}</span>}
      </td>
    );
  };
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th />
            <th colSpan={2} className="px-4 pb-3 text-right font-medium">Mobile</th>
            <th colSpan={2} className="px-4 pb-3 text-right font-medium">Desktop</th>
          </tr>
          <tr className="border-b">
            <th />
            <th className="px-4 py-3 text-right font-normal">field</th>
            <th className="px-4 py-3 text-right font-normal">lab</th>
            <th className="px-4 py-3 text-right font-normal">field</th>
            <th className="px-4 py-3 text-right font-normal">lab</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.metric}>
              <td className="py-3 pr-4 font-medium">{row.label}</td>
              {cell(mobile, row, 'field')}
              {cell(mobile, row, 'lab')}
              {cell(desktop, row, 'field')}
              {cell(desktop, row, 'lab')}
            </tr>
          ))}
          <tr>
            <td className="py-3 pr-4 font-medium">Score</td>
            <td colSpan={2} className="px-4 py-3 text-right"><Score value={mobile.score} thresholds={[50, 90]} /></td>
            <td colSpan={2} className="px-4 py-3 text-right"><Score value={desktop.score} thresholds={[50, 90]} /></td>
          </tr>
        </tbody>
      </table>
      {(mobile.error || desktop.error) && <p className="text-warning mt-3 text-xs">PageSpeed: {mobile.error ?? desktop.error}</p>}
    </div>
  );
}

function LedgerRow({ e }: { e: EvidenceItem }) {
  return (
    <li id={`ev-${e.id}`} className="scroll-mt-20 rounded-lg target:bg-background target:ring-2 target:ring-warning">
      <code className="text-muted-foreground font-mono text-xs">{e.id}</code>
      <div className="text-sm leading-relaxed">
        <span className="text-muted-foreground">{e.label}:</span> <span className="break-words">{e.value}</span>{' '}
        {e.url && <Source url={e.url} />}
      </div>
    </li>
  );
}
