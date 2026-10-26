import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Mail, TriangleAlert } from 'lucide-react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { AutoRefresh } from '@/components/auto-refresh';
import { HostBadge, Score, StatusBadge } from '@/components/badges';
import { ApprovalBar } from '@/components/approval-bar';
import { Citations, Sources } from '@/components/citations';
import { CopyButton } from '@/components/copy-button';
import { Disclosure, Panel } from '@/components/disclosure';
import { GmailDraftButton } from '@/components/gmail-draft-button';
import { getProspect } from '@/lib/db';
import { HOST_LABEL, ms, RATING_TONE, relativeTime, STATUS } from '@/lib/format';
import { rate } from '@/lib/psi';
import type { Detection, EvidenceItem, PerfResult, Research } from '@/lib/types';

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
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <AutoRefresh active={running} />

      <div className="space-y-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-4 text-sm">
          <ArrowLeft className="size-4" /> Prospects
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-2xl font-medium">{r?.companyName || p.domain}</h1>
              <StatusBadge status={p.status} />
            </div>
            <a
              href={d?.finalUrl ?? `https://${p.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-4 font-mono text-sm"
            >
              {p.domain} <ArrowUpRight className="size-3" />
            </a>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-4">
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
          <div className="rounded-lg border border-error/40 bg-background px-4 py-4 text-sm text-error" role="alert">
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
          <div className="flex flex-col gap-4 rounded-lg border p-4 text-sm sm:flex-row sm:flex-wrap sm:items-center">
            {p.gmailDraft ? (
              <>
                <Mail className="size-4 shrink-0" />
                <span className="min-w-0">
                  Gmail draft created {relativeTime(p.gmailDraft.createdAt)}
                  {!p.gmailDraft.to && <span className="text-muted-foreground"> · no recipient (no published email). Add one in Gmail.</span>}
                </span>
                <a href={p.gmailDraft.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4 sm:ml-auto">
                  Open in Gmail ↗
                </a>
              </>
            ) : (
              <>
                <Mail className="text-muted-foreground size-4 shrink-0" />
                <span className="text-muted-foreground min-w-0">{p.gmailError ?? 'No Gmail draft yet.'}</span>
                <div className="w-full sm:ml-auto sm:w-auto">
                  <GmailDraftButton domain={p.domain} label={p.gmailError ? 'Retry Gmail draft' : 'Create Gmail draft'} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {p.status === 'awaiting_approval' && draft && <ApprovalBar domain={p.domain} draft={draft} />}

      <div className="max-w-3xl space-y-6">
        {(q || draft || r) && (
          <section className="space-y-6 rounded-lg border p-4 sm:p-6">
            {q && (
              <div>
                <p className="text-muted-foreground text-xs">Why write them</p>
                <h2 className="mt-1 text-lg font-medium leading-snug">{q.strongestAngle.label}</h2>
                <p className="mt-2 text-sm leading-relaxed">{q.strongestAngle.explanation}</p>
              </div>
            )}

            {r && <StakeholderCard research={r} />}

            {draft && (
              <div>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-sm font-medium">Draft</h2>
                  <CopyButton text={`Subject: ${draft.subject}\n\n${draft.body}`} />
                </div>
                {draft.editedBy && <p className="text-muted-foreground mb-2 text-xs">Edited by {draft.editedBy}</p>}
                <div className="rounded-lg border">
                  <div className="border-b px-4 py-4 text-sm">
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
                  <div className="border-b px-4 py-4 text-sm">
                    <span className="text-muted-foreground">Subject: </span>
                    {draft.subject}
                  </div>
                  <div className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</div>
                </div>
                {draft.warnings.length > 0 && (
                  <ul className="mt-4 space-y-4">
                    {draft.warnings.map((w) => (
                      <li key={w} className="text-warning flex items-start gap-4 text-xs">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" /> {w}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 divide-y border-t">
                  {draft.subjectOptions.filter((o) => o !== draft.subject).length > 0 && (
                    <Disclosure title="Other subject lines" hint={draft.subjectOptions.filter((o) => o !== draft.subject).join(' · ')}>
                      <ul className="space-y-2 text-sm">
                        {draft.subjectOptions
                          .filter((o) => o !== draft.subject)
                          .map((o) => (
                            <li key={o}>{o}</li>
                          ))}
                      </ul>
                    </Disclosure>
                  )}
                  <Disclosure title="Talking points" hint="Three notes for the call">
                    <ol className="list-decimal space-y-4 pl-5 text-sm">
                      {draft.talkingPoints.map((t, i) => (
                        <li key={i}>
                          {t.text} <Sources ids={t.citations} ledger={ledger} />
                        </li>
                      ))}
                    </ol>
                  </Disclosure>
                  {draft.emailCitations.length > 0 && (
                    <Disclosure title="Sources for this email" hint={`${draft.emailCitations.length} receipts`}>
                      <Citations ids={draft.emailCitations} ledger={ledger} />
                    </Disclosure>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {q && q.claims.length > 0 && (
          <Panel title="How the score was built">
            <Disclosure title="Reasoning" hint={lead(q.reasoning)}>
              <p className="text-sm leading-relaxed">{q.reasoning}</p>
            </Disclosure>
            <Disclosure title="Supporting facts" hint={`${q.claims.length} checks, each tied to a receipt`}>
              <ul className="space-y-4">
                {q.claims.map((c, i) => (
                  <li key={i} className="text-sm">
                    {c.text} <Sources ids={c.citations} ledger={ledger} />
                  </li>
                ))}
              </ul>
            </Disclosure>
          </Panel>
        )}

        {r && (r.summary.text || r.sizeSignals.length > 0 || r.news.length > 0 || r.whyNow.length > 0) && (
          <Panel title="Company">
            {r.summary.text && (
              <p className="py-4 text-sm leading-relaxed">
                {r.summary.text} <Source url={r.summary.sourceUrl} />
              </p>
            )}
            <ResearchList title="Size and funding" items={r.sizeSignals} />
            <ResearchList
              title="Recent news"
              items={r.news.map((n) => ({ ...n, text: n.date ? `${n.date} — ${n.text}` : n.text }))}
            />
            <ResearchList title="Why now" items={r.whyNow} />
          </Panel>
        )}

        {(p.perf || d || ledger.length > 0) && (
          <Panel title="Evidence">
            {p.perf && (
              <Disclosure title="Real-user speed" hint={speedHint(p.perf.mobile, p.perf.desktop)}>
                <div className="mb-4 flex justify-end">
                  <a
                    className="text-muted-foreground hover:text-foreground text-xs"
                    href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(d?.finalUrl ?? `https://${p.domain}/`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PageSpeed ↗
                  </a>
                </div>
                <VitalsTable mobile={p.perf.mobile} desktop={p.perf.desktop} />
                <p className="text-muted-foreground mt-2 text-xs">
                  Real users are the CrUX 75th percentile{p.perf.mobile.field.scope === 'origin' ? ' for the whole site' : ''}. Lab is one Lighthouse run. INP only exists for real users.
                </p>
              </Disclosure>
            )}

            {d && (
              <Disclosure title="How we detected the stack" hint={detectionHint(d, p.host)}>
                <p className="text-muted-foreground mb-3 text-xs break-all">
                  Checked {relativeTime(d.fetchedAt)} · GET {d.fetchedUrl} → {d.status ?? '—'}
                  {d.finalUrl && d.finalUrl !== d.fetchedUrl && ` → ${d.finalUrl}`}
                  {d.outcome !== 'ok' && ` · ${d.outcome}`}
                </p>
                <SignalList title="Next.js" signals={d.nextjs.signals} />
                <SignalList title="Hosting" signals={d.host.signals.map((s) => ({ ...s, label: `${s.label} → ${s.host}` }))} />
                {(d.dns.cname.length > 0 || d.dns.a.length > 0) && (
                  <div className="mt-4 font-mono text-xs break-all">
                    {d.dns.cname.map((c) => (
                      <div key={c}>CNAME {c}</div>
                    ))}
                    {d.dns.a.map((a) => (
                      <div key={a}>A {a}</div>
                    ))}
                  </div>
                )}
                <Disclosure className="border-t" title="Response headers" hint={`${Object.keys(d.headers).length} headers`}>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-hover p-4 font-mono text-xs">
                    {Object.entries(d.headers)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n')}
                  </pre>
                </Disclosure>
              </Disclosure>
            )}

            {ledger.length > 0 && (
              <Disclosure id="evidence-ledger" title="Receipts" hint={`${ledger.length} sources behind the claims above`}>
                <p className="text-muted-foreground mb-4 text-xs">Every claim has to point at one of these. Unknown ids are rejected.</p>
                <ul className="space-y-4">
                  {ledger.map((e) => (
                    <LedgerRow key={e.id} e={e} />
                  ))}
                </ul>
              </Disclosure>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function StakeholderCard({ research: r }: { research: Research }) {
  const b = r.likelyBuyer;
  const others = b.alternates?.length ?? 0;
  return (
    <div className="border-t pt-6">
      <p className="text-muted-foreground text-xs">Who to contact</p>
      {b.name ? (
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-medium">{b.name}</div>
            <div className="text-muted-foreground text-sm">{b.title ?? b.role}</div>
          </div>
          <div className="flex flex-wrap gap-4">
            {b.linkedinUrl && (
              <a
                href={b.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-accent inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <LinkedInIcon className="size-3.5" /> LinkedIn
              </a>
            )}
            {r.buyerEmail && (
              <a
                href={`mailto:${r.buyerEmail.address}`}
                className="hover:bg-accent inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs break-all"
              >
                <Mail className="size-3.5" /> {r.buyerEmail.address}
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm">
          No named person verified. Target role: {b.role}
        </p>
      )}
      <Disclosure
        className="mt-4 border-t"
        title="Why this person"
        hint={others > 0 ? `${others} other ${others === 1 ? 'person' : 'people'} on file` : 'How they were chosen'}
      >
        <p className="text-sm leading-relaxed">{b.rationale}</p>
        <p className="text-muted-foreground mt-4 text-xs">
          {r.buyerEmail ? (
            <>Email found on <Source url={r.buyerEmail.sourceUrl} /></>
          ) : (
            'No email published on a retrieved page. Emails are never guessed.'
          )}
          {b.sourceUrl && b.sourceUrl !== b.linkedinUrl && (
            <> · Role confirmed on <Source url={b.sourceUrl} /></>
          )}
        </p>
        {others > 0 && (
          <ul className="mt-4 space-y-4 text-sm">
            {b.alternates.map((a) => (
              <li key={a.name} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{a.name}</span>
                {a.title && <span className="text-muted-foreground min-w-0">· {a.title}</span>}
                {a.linkedinUrl && (
                  <a href={a.linkedinUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <LinkedInIcon className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </div>
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

function lead(text: string) {
  const sentence = text.split(/(?<=\.)\s/)[0] ?? text;
  return sentence.length > 180 ? `${sentence.slice(0, 177)}…` : sentence;
}

function speedHint(mobile: PerfResult, desktop: PerfResult) {
  return `Mobile LCP ${ms(mobile.field.lcpMs)}, server ${ms(mobile.field.ttfbMs)}. Desktop LCP ${ms(desktop.field.lcpMs)}, server ${ms(desktop.field.ttfbMs)}.`;
}

function detectionHint(d: Detection, host: string | null) {
  const router = d.nextjs.router === 'app' ? 'App Router' : d.nextjs.router === 'pages' ? 'Pages Router' : 'Next.js';
  const confidence = Math.round(d.nextjs.confidence * 100);
  const hostName = host && host in HOST_LABEL ? HOST_LABEL[host as keyof typeof HOST_LABEL] : host;
  const cdn = d.host.cdn && d.host.cdn in HOST_LABEL ? HOST_LABEL[d.host.cdn] : null;
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
  if (items.length === 0) return null;
  return (
    <Disclosure title={title} hint={`${items.length} ${items.length === 1 ? 'note' : 'notes'}`}>
      <ul className="space-y-4 text-sm">
        {items.map((i, idx) => (
          <li key={idx}>
            {i.text} <Source url={i.sourceUrl} />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

function SignalList({ title, signals }: { title: string; signals: { id: string; label: string; match: string }[] }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-muted-foreground mb-2 text-xs">{title}</h3>
      {signals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No signals matched.</p>
      ) : (
        <ul className="space-y-4">
          {signals.map((s) => (
            <li key={s.id} className="text-sm">
              <div>{s.label}</div>
              <code className="text-muted-foreground block truncate font-mono text-xs" title={s.match}>
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
    const color = rating
      ? { green: 'text-positive', amber: 'text-warning', red: 'text-error' }[RATING_TONE[rating]]
      : 'text-muted-foreground';
    const label = rating
      ? { good: 'Good', 'needs-improvement': 'Needs improvement', poor: 'Poor' }[rating]
      : null;
    return (
      <td className="px-2 py-3 text-right align-top sm:px-4">
        <span className="font-mono tabular-nums">{row.fmt(v)}</span>
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
            <th colSpan={2} className="px-4 pb-4 text-right font-medium">Mobile</th>
            <th colSpan={2} className="px-4 pb-4 text-right font-medium">Desktop</th>
          </tr>
          <tr className="border-b">
            <th />
            <th className="px-4 py-4 text-right font-normal">field</th>
            <th className="px-4 py-4 text-right font-normal">lab</th>
            <th className="px-4 py-4 text-right font-normal">field</th>
            <th className="px-4 py-4 text-right font-normal">lab</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.metric}>
              <td className="py-4 pr-4 font-medium">{row.label}</td>
              {cell(mobile, row, 'field')}
              {cell(mobile, row, 'lab')}
              {cell(desktop, row, 'field')}
              {cell(desktop, row, 'lab')}
            </tr>
          ))}
          <tr>
            <td className="py-4 pr-4 font-medium">Score</td>
            <td colSpan={2} className="px-4 py-4 text-right"><Score value={mobile.score} thresholds={[50, 90]} /></td>
            <td colSpan={2} className="px-4 py-4 text-right"><Score value={desktop.score} thresholds={[50, 90]} /></td>
          </tr>
        </tbody>
      </table>
      {(mobile.error || desktop.error) && (
        <p className="text-warning mt-2 text-xs">PSI: {mobile.error ?? desktop.error}</p>
      )}
    </div>
  );
}

function LedgerRow({ e }: { e: EvidenceItem }) {
  return (
    <li id={`ev-${e.id}`} className="scroll-mt-20 rounded-lg target:bg-hover target:ring-2 target:ring-warning">
      <code className="text-muted-foreground font-mono text-xs">{e.id}</code>
      <div className="text-sm">
        <span className="text-muted-foreground">{e.label}:</span> <span className="break-words">{e.value}</span>{' '}
        {e.url && <Source url={e.url} />}
      </div>
    </li>
  );
}
