import { ArrowUpRight, Mail, TriangleAlert } from 'lucide-react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { OpportunityApprovalBar } from '@/components/opportunity-approval-bar';
import { OpportunityGmailButton } from '@/components/opportunity-gmail-button';
import { Score } from '@/components/badges';
import { Sources } from '@/components/citations';
import { CopyButton } from '@/components/copy-button';
import { Disclosure } from '@/components/disclosure';
import type { OpportunityRow, ProofRecordRow } from '@/lib/db/schema';
import type { EvidenceItem } from '@/lib/types';

const statusLabel: Record<OpportunityRow['status'], string> = {
  candidate: 'Candidate',
  researching_contact: 'Finding buyer',
  drafting: 'Drafting outreach',
  awaiting_approval: 'Ready for review',
  approved: 'Approved',
  rejected: 'Rejected',
  suppressed: 'Suppressed',
  expired: 'Expired',
  error: 'Error'
};

export function OpportunityCards({
  opportunities,
  ledger,
  proofRecords
}: {
  opportunities: OpportunityRow[];
  ledger: EvidenceItem[];
  proofRecords: ProofRecordRow[];
}) {
  if (!opportunities.length) return null;
  const proofById = new Map(proofRecords.map((record) => [record.id, record]));
  return (
    <section aria-labelledby="recommended-opportunities-title" className="max-w-5xl space-y-5">
      <div>
        <h2 id="recommended-opportunities-title" className="text-xl font-semibold tracking-tight">Recommended product pitches</h2>
        <p className="text-muted-foreground mt-1 text-sm">Ranked by fit. Each pitch has its own buyer, rationale, and draft.</p>
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

              <SalesContext
                customerProof={(opportunity.proofIds ?? []).flatMap((id) => proofById.get(id) ?? [])}
                competitiveContext={(opportunity.competitiveContextIds ?? []).flatMap((id) => proofById.get(id) ?? [])}
              />

              <div className="rounded-lg bg-hover px-4 sm:px-5">
                <Disclosure
                  title={`Why this opportunity scored ${opportunity.score}`}
                  hint={`${scoreAssessment(opportunity.score).label} · ${scoreDriverSummary(opportunity)}`}
                >
                  <ScoreExplanation opportunity={opportunity} ledger={ledger} />
                </Disclosure>
              </div>

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

function SalesContext({
  customerProof,
  competitiveContext
}: {
  customerProof: ProofRecordRow[];
  competitiveContext: ProofRecordRow[];
}) {
  if (!customerProof.length && !competitiveContext.length) return null;
  return (
    <section aria-label="Customer proof and competitive context" className="grid gap-3 sm:grid-cols-2">
      {customerProof.length > 0 && (
        <div className="rounded-lg bg-hover p-4 sm:p-5">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Relevant Vercel precedent</p>
          <p className="text-muted-foreground mt-1 text-xs">Supporting context for the rep, not a scoring signal.</p>
          <ProofList records={customerProof} />
        </div>
      )}
      {competitiveContext.length > 0 && (
        <div className="rounded-lg border border-dashed p-4 sm:p-5">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Competitive context</p>
          <p className="text-muted-foreground mt-1 text-xs">Internal only. Never included in draft outreach.</p>
          <ProofList records={competitiveContext} />
        </div>
      )}
    </section>
  );
}

function ProofList({ records }: { records: ProofRecordRow[] }) {
  return (
    <ul className="mt-4 space-y-4">
      {records.map((record) => (
        <li key={record.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium">{record.company}</p>
            <span className="text-muted-foreground text-xs capitalize">{record.vendor}</span>
          </div>
          <p className="mt-1 text-sm leading-6">{record.summary}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {record.publishedAt ? `${formatSourceDate(record.publishedAt)} · ` : ''}
            <SourceLink url={record.sourceUrl} label={record.title} />
          </p>
        </li>
      ))}
    </ul>
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
  return (
    <section aria-label={`Draft for ${opportunity.productName}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">Draft outreach</h4>
          <p className="text-muted-foreground mt-1 text-xs">
            {draft.to?.name ? `To ${draft.to.name}${draft.to.title ? `, ${draft.to.title}` : ''}` : `For ${opportunity.targetRole}`}
          </p>
        </div>
        <CopyButton text={`Subject: ${draft.subject}\n\n${draft.body}`} />
      </div>
      <div className="mt-4 rounded-lg bg-hover p-4 sm:p-5">
        <p className="text-muted-foreground text-xs">Subject</p>
        <p className="mt-1 text-sm font-medium">{draft.subject}</p>
        <div className="mt-5 whitespace-pre-wrap text-sm leading-6">{draft.body}</div>
        <Sources ids={draft.emailCitations} ledger={ledger} />
      </div>
      {draft.warnings.length > 0 && (
        <div className="text-warning mt-3 flex items-start gap-2 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{draft.warnings.join(' · ')}</span>
        </div>
      )}
    </section>
  );
}

function scoreAssessment(score: number) {
  if (score >= 60) return { label: 'Strong opportunity', takeaway: 'Prioritize personalized outreach while the evidence is current.' };
  if (score >= 35) return { label: 'Promising opportunity', takeaway: 'Worth pursuing, with the missing signals serving as useful discovery questions.' };
  return { label: 'Early opportunity', takeaway: 'Review the evidence and validate the gaps before prioritizing outreach.' };
}

function scoreDriverSummary(opportunity: OpportunityRow) {
  const breakdown = opportunity.scoreBreakdown;
  const drivers = [
    breakdown.productFit > 0 && 'product fit',
    breakdown.trigger > 0 && 'timing',
    breakdown.accountValue > 0 && 'account potential',
    breakdown.buyerQuality > 0 && 'buyer confidence'
  ].filter(Boolean) as string[];
  if (drivers.length === 0) return 'No positive scoring signals yet';
  if (drivers.length === 1) return `${drivers[0]} is the main score driver`;
  return `${drivers.slice(0, -1).join(', ')} and ${drivers.at(-1)} drive the score`;
}

function ScoreExplanation({ opportunity, ledger }: { opportunity: OpportunityRow; ledger: EvidenceItem[] }) {
  const breakdown = opportunity.scoreBreakdown;
  const assessment = scoreAssessment(opportunity.score);
  const positive = [
    { label: 'Product fit', value: breakdown.productFit, description: 'Public evidence connects this Vercel product to a specific need.' },
    { label: 'Timing', value: breakdown.trigger, description: 'A recent event creates a reason to start the conversation now.' },
    { label: 'Account potential', value: breakdown.accountValue, description: 'The company profile matches the accounts Vercel sales should prioritize.' },
    { label: 'Buyer confidence', value: breakdown.buyerQuality, description: 'A relevant person was identified for this product conversation.' }
  ].filter((item) => item.value > 0);
  const missing = [
    breakdown.trigger === 0 && 'a timely trigger',
    breakdown.accountValue === 0 && 'a qualifying account profile',
    breakdown.buyerQuality === 0 && 'a verified buyer'
  ].filter(Boolean) as string[];

  return (
    <div className="pb-1">
      <div className="grid gap-6 sm:grid-cols-[11rem_1fr] sm:gap-8">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Overall assessment</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{opportunity.score}<span className="text-muted-foreground text-sm">/100</span></p>
          <p className="mt-1 text-sm font-medium">{assessment.label}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Sales takeaway</p>
          <p className="text-muted-foreground mt-1 text-sm leading-6">{assessment.takeaway}</p>
        </div>
      </div>

      <div className="mt-6 border-t pt-5">
        <h4 className="text-sm font-medium">What raised the score</h4>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {positive.map((item) => <ScoreDriver key={item.label} {...item} />)}
        </dl>
      </div>

      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium">Still unproven</p>
          <p className="text-muted-foreground mt-1 leading-6">
            {missing.length > 0 ? `No points yet for ${joinList(missing)}.` : 'The major qualification areas all contributed to the score.'}
          </p>
        </div>
        <div>
          <p className="font-medium">Account profile</p>
          <p className="text-muted-foreground mt-1 leading-6">
            {breakdown.accountValue > 0
              ? 'Account-potential points reflect the highest supported sales-fit tier and any observed Vercel expansion context.'
              : 'No target-account tier was supported; traditional SMB and professional-services profiles do not receive account-potential points by default.'}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t pt-4">
        <p className="text-muted-foreground text-xs">The score is deterministic and based only on the evidence collected for this opportunity.</p>
        <Sources ids={opportunity.evidenceIds} ledger={ledger} />
      </div>
    </div>
  );
}

function ScoreDriver({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="rounded-lg bg-background p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm font-medium">{label}</dt>
        <dd className="text-positive font-mono text-sm tabular-nums">+{value}</dd>
      </div>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{description}</p>
    </div>
  );
}

function joinList(items: string[]) {
  if (items.length < 2) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`;
}
