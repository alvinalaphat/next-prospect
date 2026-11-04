import { ArrowUpRight, Mail, TriangleAlert } from 'lucide-react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { OpportunityApprovalBar } from '@/components/opportunity-approval-bar';
import { OpportunityGmailButton } from '@/components/opportunity-gmail-button';
import { Score } from '@/components/badges';
import { CopyButton } from '@/components/copy-button';
import { Disclosure } from '@/components/disclosure';
import type { OpportunityRow } from '@/lib/db/schema';
import { presentEvidence, salesLanguage } from '@/lib/evidence-presentation';
import type { ScoredSignal } from '@/lib/scoring';
import type { EvidenceItem } from '@/lib/types';

const statusLabel: Record<OpportunityRow['status'], string> = {
  candidate: 'Candidate',
  researching_contact: 'Finding buyer',
  drafting: 'Drafting outreach',
  awaiting_approval: 'Ready for review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  error: 'Error'
};

export function OpportunityCards({
  opportunities,
  ledger
}: {
  opportunities: OpportunityRow[];
  ledger: EvidenceItem[];
}) {
  if (!opportunities.length) return null;
  return (
    <section aria-labelledby="recommended-opportunities-title" className="max-w-5xl space-y-5">
      <div>
        <h2 id="recommended-opportunities-title" className="text-xl font-semibold tracking-tight">Recommended product pitches</h2>
        <p className="text-muted-foreground mt-1 text-sm">Ranked by fit. Each pitch has its own buyer assignment, rationale, and draft.</p>
      </div>
      <div className="space-y-5">
        {opportunities.map((opportunity, index) => (
          <article id={`opportunity-${opportunity.id}`} key={opportunity.id} className="scroll-mt-6 overflow-hidden rounded-xl border bg-background">
            <div className="space-y-7 p-5 sm:p-7">
              <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 max-w-3xl">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-wider">
                    <span>{index === 0 ? 'Top recommendation' : `Recommendation ${index + 1}`}</span>
                    <span aria-hidden>·</span>
                    <span>{opportunity.salesMotion === 'expansion' ? 'Expansion' : 'New business'}</span>
                    <span aria-hidden>·</span>
                    <span>{statusLabel[opportunity.status]}</span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{opportunity.productName}</h3>
                  <p className="mt-3 text-sm leading-6 sm:text-base">{opportunity.angle}</p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="text-muted-foreground mb-1 text-xs">Opportunity score</p>
                  <Score value={opportunity.score} thresholds={[35, 60]} suffix="/100" showRating={false} className="sm:justify-end" />
                </div>
              </header>

              <dl className="grid gap-5 text-sm sm:grid-cols-2 sm:gap-8">
                <PitchReason label="Why now">{opportunity.whyNow}</PitchReason>
                <PitchReason label="Why Vercel">{opportunity.whyVercel}</PitchReason>
              </dl>

              <Buyer opportunity={opportunity} />

              <section
                aria-label={`Why ${opportunity.productName} scored ${opportunity.score}`}
                className="rounded-lg border bg-hover/60 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Score and evidence</p>
                    <h4 className="mt-1 text-base font-semibold">Why this opportunity scored {opportunity.score}</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">{scoreAssessment(opportunity.score).label}</p>
                </div>
                <ScoreExplanation opportunity={opportunity} ledger={ledger} />
              </section>

              {opportunity.draft && <DraftPreview opportunity={opportunity} ledger={ledger} />}
            </div>

            {opportunity.status === 'awaiting_approval' && opportunity.draft && (
              <div className="border-t bg-hover/50 p-5 sm:p-7">
                <OpportunityApprovalBar opportunityId={opportunity.id} draft={opportunity.draft} />
              </div>
            )}
            {opportunity.status === 'approved' && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-hover/50 p-5 text-sm sm:p-7">
                <span className="text-positive">Approved{opportunity.decision ? ` by ${opportunity.decision.by}` : ''}</span>
                {opportunity.gmailDraft
                  ? <a href={opportunity.gmailDraft.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">Open Gmail draft</a>
                  : <OpportunityGmailButton opportunityId={opportunity.id} />}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function PitchReason({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</dt>
      <dd className="mt-2 leading-6">{children}</dd>
    </div>
  );
}

function Buyer({ opportunity }: { opportunity: OpportunityRow }) {
  const contact = opportunity.contact;
  const activity = opportunity.contactActivity ?? [];
  return (
    <section aria-label={`Recommended buyer for ${opportunity.productName}`} className="rounded-lg border bg-hover/60 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Recommended buyer</p>
          {contact?.name ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="font-medium">{contact.name}</p>
                <p className="text-muted-foreground text-sm">{contact.title ?? opportunity.targetRole}</p>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1.5 font-medium">{opportunity.targetRole}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">No named person verified yet.</p>
            </>
          )}
        </div>
        {contact && (contact.linkedinUrl || contact.email) && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="bg-background hover:bg-accent inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium">
                <LinkedInIcon className="size-3.5" /> LinkedIn
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="bg-background hover:bg-accent inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium">
                <Mail className="size-3.5" /> Email
              </a>
            )}
          </div>
        )}
      </div>
      {contact?.rationale && (
        <div className="mt-4 border-t pt-4 sm:grid sm:grid-cols-[8rem_1fr] sm:gap-4">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Why this person</p>
          <p className="mt-1 text-sm leading-6 sm:mt-0">{contact.rationale}</p>
        </div>
      )}
      {activity.length > 0 && (
        <div className="mt-4 border-t pt-4 sm:grid sm:grid-cols-[8rem_1fr] sm:gap-4">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Public activity</p>
          <ul className="mt-2 space-y-3 text-sm sm:mt-0">
            {activity.map((item) => (
              <li key={item.id} className="leading-6">
                <p>{item.text}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {item.publishedAt ? `${formatSourceDate(item.publishedAt)} · ` : ''}{item.relevance}{' '}
                  <SourceLink url={item.sourceUrl} label={sourceTypeLabel(item.sourceType)} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SourceLink({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">
      {label} <ArrowUpRight className="size-3" aria-hidden />
    </a>
  );
}

function sourceTypeLabel(sourceType: NonNullable<OpportunityRow['contactActivity']>[number]['sourceType']) {
  return {
    'linkedin-post': 'LinkedIn post',
    blog: 'Blog',
    talk: 'Talk',
    podcast: 'Podcast',
    github: 'GitHub',
    other: 'Source'
  }[sourceType];
}

function formatSourceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function DraftPreview({ opportunity, ledger }: { opportunity: OpportunityRow; ledger: EvidenceItem[] }) {
  const draft = opportunity.draft!;
  const recipient = draft.to?.name
    ? `To ${draft.to.name}${draft.to.title ? `, ${draft.to.title}` : ''}`
    : `For ${opportunity.targetRole}`;
  return (
    <section aria-label={`Draft for ${opportunity.productName}`} className="rounded-lg border bg-hover/60 px-4 sm:px-5">
      <Disclosure title="Email draft" hint={`${recipient} · ${draft.subject}`}>
        <div className="flex justify-end">
          <CopyButton text={`Subject: ${draft.subject}\n\n${draft.body}`} />
        </div>
        <div className="mt-3 rounded-lg bg-background p-4 sm:p-5">
          <p className="text-muted-foreground text-xs">Subject</p>
          <p className="mt-1 text-sm font-medium">{draft.subject}</p>
          <div className="mt-5 whitespace-pre-wrap text-sm leading-6">{draft.body}</div>
          {draft.emailCitations.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Evidence used in this draft</p>
              <EvidenceFacts ids={draft.emailCitations} ledger={ledger} className="mt-3" />
            </div>
          )}
        </div>
        {draft.warnings.length > 0 && (
          <div className="text-warning mt-3 flex items-start gap-2 text-xs">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>{draft.warnings.join(' · ')}</span>
          </div>
        )}
      </Disclosure>
    </section>
  );
}

function scoreAssessment(score: number) {
  if (score >= 60) return { label: 'Strong opportunity', takeaway: 'Prioritize personalized outreach while the evidence is current.' };
  if (score >= 35) return { label: 'Promising opportunity', takeaway: 'Worth pursuing, with the missing signals serving as useful discovery questions.' };
  return { label: 'Early opportunity', takeaway: 'Review the evidence and validate the gaps before prioritizing outreach.' };
}

function ScoreExplanation({ opportunity, ledger }: { opportunity: OpportunityRow; ledger: EvidenceItem[] }) {
  const breakdown = opportunity.scoreBreakdown;
  const assessment = scoreAssessment(opportunity.score);
  const categories = [
    { label: 'Product fit', value: breakdown.productFit, cap: 45 },
    { label: 'Timing', value: breakdown.trigger, cap: 20 },
    { label: 'Account potential', value: breakdown.accountValue, cap: 20 },
    { label: 'Buyer confidence', value: breakdown.buyerQuality, cap: 15 }
  ];

  return (
    <div className="mt-5">
      <dl aria-label="Score calculation" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {categories.map((category) => (
          <div key={category.label} className="rounded-lg border bg-background p-3">
            <dt className="text-muted-foreground text-xs">{category.label}</dt>
            <dd className="mt-1 font-mono text-lg tabular-nums">+{category.value}<span className="text-muted-foreground text-xs">/{category.cap}</span></dd>
          </div>
        ))}
        <div className="col-span-2 rounded-lg bg-foreground p-3 text-background sm:col-span-1">
          <dt className="text-xs opacity-70">Total</dt>
          <dd className="mt-1 font-mono text-lg tabular-nums">{opportunity.score}<span className="text-xs opacity-70">/100</span></dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-6">{assessment.takeaway}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ScoreCategory
          label="Product fit"
          value={breakdown.productFit}
          cap={45}
          empty="No product-fit evidence contributed points."
          signals={opportunity.matchedSignals.filter((signal) => signal.category === 'product_fit')}
          ledger={ledger}
        />
        <ScoreCategory
          label="Timing"
          value={breakdown.trigger}
          cap={20}
          empty="No dated event added a timely reason to reach out."
          signals={opportunity.matchedSignals.filter((signal) => signal.category === 'trigger')}
          ledger={ledger}
        />
        <ScoreCategory
          label="Account potential"
          value={breakdown.accountValue}
          cap={20}
          empty="Public company signals did not support a priority account tier."
          signals={opportunity.matchedSignals.filter((signal) => signal.category === 'account_value')}
          ledger={ledger}
          expansion={opportunity.salesMotion === 'expansion'}
        />
        <BuyerScore opportunity={opportunity} />
      </div>

      <p className="text-muted-foreground mt-4 text-xs leading-5">
        The score is calculated in code from the points shown above. Evidence is displayed in sales language; source links open the original public record.
      </p>
    </div>
  );
}

function ScoreCategory({
  label,
  value,
  cap,
  empty,
  signals,
  ledger,
  expansion = false
}: {
  label: string;
  value: number;
  cap: number;
  empty: string;
  signals: ScoredSignal[];
  ledger: EvidenceItem[];
  expansion?: boolean;
}) {
  const signalPoints = signals.reduce((total, signal) => total + signal.points, 0);
  const expansionPoints = expansion ? Math.max(0, value - Math.min(cap, signalPoints)) : 0;
  const rawPoints = signalPoints + (expansion ? 5 : 0);
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h5 className="text-sm font-semibold">{label}</h5>
        <span className="text-positive font-mono text-sm tabular-nums">+{value}/{cap}</span>
      </div>
      {signals.length === 0 && expansionPoints === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm leading-6">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {signals.map((signal) => (
            <li key={signal.ruleId}>
              <div className="flex items-start justify-between gap-3 text-sm">
                <p className="font-medium leading-5">{salesLanguage(signal.explanation)}</p>
                <span className="text-positive shrink-0 font-mono text-xs tabular-nums">+{signal.points}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-5">{signalContext(signal)}</p>
              <EvidenceFacts ids={signal.evidenceIds} ledger={ledger} className="mt-2" />
            </li>
          ))}
          {expansionPoints > 0 && (
            <li>
              <div className="flex items-start justify-between gap-3 text-sm">
                <p className="font-medium leading-5">The inspected site already runs on Vercel, creating expansion context.</p>
                <span className="text-positive shrink-0 font-mono text-xs tabular-nums">+{expansionPoints}</span>
              </div>
              <EvidenceFacts ids={vercelEvidenceIds(ledger)} ledger={ledger} className="mt-2" />
            </li>
          )}
        </ul>
      )}
      {rawPoints > cap && (
        <p className="text-muted-foreground mt-3 border-t pt-3 text-xs leading-5">
          Supported signals reached +{rawPoints}, but this category contributes at most +{cap}.
        </p>
      )}
    </section>
  );
}

function BuyerScore({ opportunity }: { opportunity: OpportunityRow }) {
  const value = opportunity.scoreBreakdown.buyerQuality;
  const contact = opportunity.contact;
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h5 className="text-sm font-semibold">Buyer confidence</h5>
        <span className="text-positive font-mono text-sm tabular-nums">+{value}/15</span>
      </div>
      <p className="mt-3 text-sm font-medium leading-5">
        {contact?.name
          ? `${contact.name} was verified as a relevant buyer for this conversation.`
          : `The target role is ${opportunity.targetRole}, but no named buyer was verified.`}
      </p>
      {contact?.rationale && <p className="text-muted-foreground mt-1 text-xs leading-5">{contact.rationale}</p>}
      {contact?.sourceUrl && (
        <a href={contact.sourceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-2">
          Verify buyer <ArrowUpRight className="size-3" aria-hidden />
        </a>
      )}
    </section>
  );
}

function EvidenceFacts({ ids, ledger, className = '' }: { ids: string[]; ledger: EvidenceItem[]; className?: string }) {
  const byId = new Map(ledger.map((evidence) => [evidence.id, evidence]));
  const evidence = [...new Set(ids)].map((id) => byId.get(id)).filter((item): item is EvidenceItem => Boolean(item));
  if (evidence.length === 0) return null;
  return (
    <ul className={`${className} space-y-2`}>
      {evidence.map((item) => <EvidenceFact key={item.id} evidence={item} />)}
    </ul>
  );
}

function EvidenceFact({ evidence }: { evidence: EvidenceItem }) {
  const presented = presentEvidence(evidence);
  return (
    <li className="border-l-2 pl-3 text-xs leading-5">
      <p className="text-muted-foreground font-medium">{presented.label}</p>
      <p className="mt-0.5">{presented.statement}</p>
      {evidence.url && presented.sourceLabel && (
        <a href={evidence.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">
          {presented.sourceLabel} <ArrowUpRight className="size-3" aria-hidden />
        </a>
      )}
    </li>
  );
}

function signalContext(signal: ScoredSignal) {
  const confidence = `${signal.confidence[0].toUpperCase()}${signal.confidence.slice(1)}-confidence match`;
  const date = signal.observedAt ? ` · observed ${formatSourceDate(signal.observedAt)}` : '';
  const adjustment = signal.points < signal.basePoints ? ` · adjusted from +${signal.basePoints}` : '';
  return `${confidence}${date}${adjustment}`;
}

function vercelEvidenceIds(ledger: EvidenceItem[]) {
  return ledger
    .filter((evidence) => evidence.id.startsWith('detect.host.') && /vercel/i.test(`${evidence.label} ${evidence.value}`))
    .map((evidence) => evidence.id);
}
