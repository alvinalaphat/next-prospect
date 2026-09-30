import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Mail, TriangleAlert } from 'lucide-react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { AutoRefresh } from '@/components/auto-refresh';
import { HostBadge, Pill, Score, StatusBadge } from '@/components/badges';
import { ApprovalBar } from '@/components/approval-bar';
import { Citations } from '@/components/citations';
import { CopyButton } from '@/components/copy-button';
import { GmailDraftButton } from '@/components/gmail-draft-button';
import { getProspect } from '@/lib/db';
import { ms, RATING_TONE, relativeTime, STATUS } from '@/lib/format';
import { rate } from '@/lib/psi';
import type { EvidenceItem, PerfResult, Research } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProspectPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const p = await getProspect(decodeURIComponent(domain));
  if (!p) notFound();

  const d = p.detection;
  const q = p.qualification;
  const r = p.research;
  const draft = p.draft;
  const ledger = p.evidence ?? [];
  const running = STATUS[p.status].group === 'running';

  return (
    <div className="space-y-8">
      <AutoRefresh active={running} />

      <div className="space-y-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> Prospects
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{r?.companyName || p.domain}</h1>
              <StatusBadge status={p.status} />
            </div>
            <a
              href={d?.finalUrl ?? `https://${p.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 font-mono text-sm"
            >
              {p.domain} <ArrowUpRight className="size-3" />
            </a>
          </div>
          <dl className="flex gap-6 text-sm">
            <Stat label="Host">
              <HostBadge host={p.host} cdn={d?.host.cdn} />
            </Stat>
            <Stat label="Next.js">
              <span className="font-mono">{p.nextjsConfidence ?? '—'}%</span>
              {d?.nextjs.router && <span className="text-muted-foreground ml-1">{d.nextjs.router}</span>}
            </Stat>
            <Stat label="Perf (mobile)">
              <Score value={p.perfScore} thresholds={[50, 90]} />
            </Stat>
            <Stat label="Fit">
              <Score value={p.fitScore} thresholds={[35, 60]} suffix="/100" />
            </Stat>
          </dl>
        </div>
        {p.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {p.error}
          </div>
        )}
        {p.approval && (
          <p className="text-muted-foreground text-sm">
            {STATUS[p.status].label} by <span className="text-foreground">{p.approval.by}</span> via {p.approval.via}
            {p.approval.editedDraft && ' (with edits)'}.
          </p>
        )}
        {p.status === 'approved' && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            {p.gmailDraft ? (
              <>
                <Mail className="size-4" />
                <span>
                  Gmail draft created {relativeTime(p.gmailDraft.createdAt)}
                  {!p.gmailDraft.to && <span className="text-muted-foreground"> · no recipient (no published email). Add one in Gmail.</span>}
                </span>
                <a href={p.gmailDraft.url} target="_blank" rel="noreferrer" className="ml-auto font-medium underline underline-offset-4">
                  Open in Gmail ↗
                </a>
              </>
            ) : (
              <>
                <Mail className="text-muted-foreground size-4" />
                <span className="text-muted-foreground">{p.gmailError ?? 'No Gmail draft yet.'}</span>
                <div className="ml-auto">
                  <GmailDraftButton domain={p.domain} label={p.gmailError ? 'Retry Gmail draft' : 'Create Gmail draft'} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {p.status === 'awaiting_approval' && draft && <ApprovalBar domain={p.domain} draft={draft} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {r && <StakeholderCard research={r} />}

          {q && (
            <Section title="Qualification" aside={<Pill tone={q.verdict === 'qualified' ? 'green' : q.verdict === 'nurture' ? 'amber' : 'neutral'}>{q.verdict}</Pill>}>
              <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                <div className="text-muted-foreground text-xs uppercase tracking-wide">Strongest angle</div>
                <div className="mt-1 font-medium">{q.strongestAngle.label}</div>
                <p className="text-muted-foreground mt-1 text-sm">{q.strongestAngle.explanation}</p>
                <Citations ids={q.strongestAngle.citations} ledger={ledger} />
              </div>
              <p className="mt-4 text-sm leading-relaxed">{q.reasoning}</p>
              <ul className="mt-4 space-y-2">
                {q.claims.map((c, i) => (
                  <li key={i} className="text-sm">
                    {c.text} <Citations ids={c.citations} ledger={ledger} inline />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {draft && (
            <Section
              title="Draft email"
              aside={<CopyButton text={`Subject: ${draft.subject}\n\n${draft.body}`} />}
            >
              {draft.editedBy && <p className="text-muted-foreground mb-2 text-xs">Edited by {draft.editedBy}</p>}
              <div className="rounded-md border">
                <div className="border-b px-4 py-2 text-sm">
                  <span className="text-muted-foreground">To: </span>
                  {draft.to ? (
                    <>
                      {draft.to.name}
                      {draft.to.email ? (
                        <span className="text-muted-foreground font-mono text-xs"> &lt;{draft.to.email}&gt;</span>
                      ) : (
                        <span className="text-muted-foreground text-xs"> (no published email)</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">no verified stakeholder</span>
                  )}
                </div>
                <div className="border-b px-4 py-2 text-sm">
                  <span className="text-muted-foreground">Subject: </span>
                  {draft.subject}
                  {draft.subjectOptions && draft.subjectOptions.filter((o) => o !== draft.subject).length > 0 && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      Alternatives:{' '}
                      {draft.subjectOptions
                        .filter((o) => o !== draft.subject)
                        .map((o) => `“${o}”`)
                        .join(' · ')}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</div>
              </div>
              <Citations ids={draft.emailCitations} ledger={ledger} />
              {draft.warnings.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {draft.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-6 mb-2 text-sm font-medium">Rep talking points</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {draft.talkingPoints.map((t, i) => (
                  <li key={i}>
                    {t.text} <Citations ids={t.citations} ledger={ledger} inline />
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {r && (
            <Section title="Research">
              {r.summary.text && (
                <p className="text-sm leading-relaxed">
                  {r.summary.text} <Source url={r.summary.sourceUrl} />
                </p>
              )}
              <ResearchList title="Size & funding" items={r.sizeSignals} />
              <ResearchList title="Recent news" items={r.news.map((n) => ({ ...n, text: n.date ? `${n.date} — ${n.text}` : n.text }))} />
              <ResearchList title="Why now" items={r.whyNow} />
            </Section>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {p.perf && (
            <Section title="Core Web Vitals" aside={<a className="text-muted-foreground hover:text-foreground text-xs" href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(d?.finalUrl ?? `https://${p.domain}/`)}`} target="_blank" rel="noreferrer">PageSpeed ↗</a>}>
              <VitalsTable mobile={p.perf.mobile} desktop={p.perf.desktop} />
              <p className="text-muted-foreground mt-2 text-xs">
                Field = real-user CrUX p75{p.perf.mobile.field.scope === 'origin' ? ' (origin-level)' : ''}. Lab = one Lighthouse run. INP only exists in field data.
              </p>
            </Section>
          )}

          {d && (
            <Section title="Detection evidence" aside={<span className="text-muted-foreground text-xs">{relativeTime(d.fetchedAt)}</span>}>
              <div className="text-muted-foreground mb-3 text-xs">
                GET {d.fetchedUrl} → {d.status ?? '—'} {d.finalUrl && d.finalUrl !== d.fetchedUrl && `→ ${d.finalUrl}`}
                {d.outcome !== 'ok' && <Pill className="ml-2">{d.outcome}</Pill>}
              </div>
              <SignalList title={`Next.js · ${Math.round(d.nextjs.confidence * 100)}% confidence`} signals={d.nextjs.signals} />
              <SignalList title="Hosting" signals={d.host.signals.map((s) => ({ ...s, label: `${s.label} → ${s.host}` }))} />
              {(d.dns.cname.length > 0 || d.dns.a.length > 0) && (
                <div className="mt-4">
                  <h3 className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">DNS</h3>
                  <div className="font-mono text-xs break-all">
                    {d.dns.cname.map((c) => <div key={c}>CNAME {c}</div>)}
                    {d.dns.a.map((a) => <div key={a}>A {a}</div>)}
                  </div>
                </div>
              )}
              <details className="mt-4">
                <summary className="text-muted-foreground cursor-pointer text-xs">Response headers</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-50 p-2 font-mono text-[11px] dark:bg-zinc-900">
                  {Object.entries(d.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                </pre>
              </details>
            </Section>
          )}

          {ledger.length > 0 && (
            <Section title="Evidence ledger" aside={<span className="text-muted-foreground text-xs">{ledger.length} items</span>}>
              <p className="text-muted-foreground mb-3 text-xs">Every claim above must cite one of these ids. Unknown ids are rejected in code.</p>
              <ul className="space-y-2">
                {ledger.map((e) => (
                  <LedgerRow key={e.id} e={e} />
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function StakeholderCard({ research: r }: { research: Research }) {
  const b = r.likelyBuyer;
  return (
    <Section
      title="Key stakeholder"
      aside={<span className="text-muted-foreground text-xs">verify before sending</span>}
    >
      {b.name ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-medium">{b.name}</div>
              <div className="text-muted-foreground text-sm">{b.title ?? b.role}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.linkedinUrl && (
                <a
                  href={b.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm"
                >
                  <LinkedInIcon className="size-3.5 text-[#0a66c2]" /> LinkedIn
                </a>
              )}
              {r.buyerEmail && (
                <a
                  href={`mailto:${r.buyerEmail.address}`}
                  className="hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs"
                >
                  <Mail className="size-3.5" /> {r.buyerEmail.address}
                </a>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-sm">{b.rationale}</p>
          <div className="text-muted-foreground text-xs">
            {r.buyerEmail ? (
              <>Email found on <Source url={r.buyerEmail.sourceUrl} /></>
            ) : (
              'No email published on any retrieved page. Emails are never guessed.'
            )}
            {b.sourceUrl && b.sourceUrl !== b.linkedinUrl && (
              <> · Role confirmed on <Source url={b.sourceUrl} /></>
            )}
          </div>
          {b.alternates?.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-muted-foreground mb-1.5 text-xs uppercase tracking-wide">Alternates</div>
              <ul className="space-y-1 text-sm">
                {b.alternates.map((a) => (
                  <li key={a.name} className="flex items-center gap-1.5">
                    {a.name}
                    {a.title && <span className="text-muted-foreground">· {a.title}</span>}
                    {a.linkedinUrl && (
                      <a href={a.linkedinUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-[#0a66c2]">
                        <LinkedInIcon className="size-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm">
          <span className="text-muted-foreground">No named person could be verified. Target role:</span> {b.role}
          <span className="text-muted-foreground block mt-1 text-xs">{b.rationale}</span>
        </p>
      )}
    </Section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Source({ url }: { url: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-xs whitespace-nowrap underline decoration-dotted underline-offset-2">
      {host}
    </a>
  );
}

function ResearchList({ title, items }: { title: string; items: { text: string; sourceUrl: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">{title}</h3>
      <ul className="space-y-1.5 text-sm">
        {items.map((i, idx) => (
          <li key={idx}>
            {i.text} <Source url={i.sourceUrl} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalList({ title, signals }: { title: string; signals: { id: string; label: string; match: string }[] }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">{title}</h3>
      {signals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No signals matched.</p>
      ) : (
        <ul className="space-y-2">
          {signals.map((s) => (
            <li key={s.id} className="text-sm">
              <div>{s.label}</div>
              <code className="text-muted-foreground block truncate font-mono text-[11px]" title={s.match}>
                {s.match}
              </code>
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
  const cell = (r: PerfResult, row: (typeof rows)[number], kind: 'field' | 'lab') => {
    const v = kind === 'field' ? r.field[row.metric] : row.metric === 'inpMs' ? null : r.lab[row.metric];
    const rating = rate(row.metric, v);
    const color = rating ? { green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-amber-600 dark:text-amber-400', red: 'text-red-600 dark:text-red-400' }[RATING_TONE[rating]] : 'text-muted-foreground';
    return <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${color}`}>{row.fmt(v)}</td>;
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th />
            <th colSpan={2} className="px-2 pb-1 text-right font-medium">Mobile</th>
            <th colSpan={2} className="px-2 pb-1 text-right font-medium">Desktop</th>
          </tr>
          <tr className="border-b">
            <th />
            <th className="px-2 py-1 text-right font-normal">field</th>
            <th className="px-2 py-1 text-right font-normal">lab</th>
            <th className="px-2 py-1 text-right font-normal">field</th>
            <th className="px-2 py-1 text-right font-normal">lab</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.metric}>
              <td className="py-1.5 pr-2 font-medium">{row.label}</td>
              {cell(mobile, row, 'field')}
              {cell(mobile, row, 'lab')}
              {cell(desktop, row, 'field')}
              {cell(desktop, row, 'lab')}
            </tr>
          ))}
          <tr>
            <td className="py-1.5 pr-2 font-medium">Score</td>
            <td colSpan={2} className="px-2 py-1.5 text-right"><Score value={mobile.score} thresholds={[50, 90]} /></td>
            <td colSpan={2} className="px-2 py-1.5 text-right"><Score value={desktop.score} thresholds={[50, 90]} /></td>
          </tr>
        </tbody>
      </table>
      {(mobile.error || desktop.error) && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">PSI: {mobile.error ?? desktop.error}</p>
      )}
    </div>
  );
}

function LedgerRow({ e }: { e: EvidenceItem }) {
  return (
    <li id={`ev-${e.id}`} className="scroll-mt-20 rounded target:bg-amber-50 target:ring-2 target:ring-amber-300 dark:target:bg-amber-950">
      <code className="text-muted-foreground font-mono text-[11px]">{e.id}</code>
      <div className="text-sm">
        <span className="text-muted-foreground">{e.label}:</span> <span className="break-words">{e.value}</span>{' '}
        {e.url && <Source url={e.url} />}
      </div>
    </li>
  );
}
