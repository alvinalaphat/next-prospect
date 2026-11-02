import { Mail, TriangleAlert } from 'lucide-react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { OpportunityApprovalBar } from '@/components/opportunity-approval-bar';
import { OpportunityGmailButton } from '@/components/opportunity-gmail-button';
import { Score } from '@/components/badges';
import { Sources } from '@/components/citations';
import { CopyButton } from '@/components/copy-button';
import { Disclosure } from '@/components/disclosure';
import type { OpportunityRow } from '@/lib/db/schema';
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

export function OpportunityCards({ opportunities, ledger }: { opportunities: OpportunityRow[]; ledger: EvidenceItem[] }) {
  if (!opportunities.length) return null;
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

              <div className="rounded-lg bg-hover px-4 sm:px-5">
                <Disclosure title="Score and supporting signals" hint="Open the deterministic breakdown and source receipts">
                  <dl className="grid grid-cols-2 gap-5 text-sm sm:grid-cols-5">
                    <ScorePart label="Product fit" value={opportunity.scoreBreakdown.productFit} />
                    <ScorePart label="Timing" value={opportunity.scoreBreakdown.trigger} />
                    <ScorePart label="Account" value={opportunity.scoreBreakdown.accountValue} />
                    <ScorePart label="Buyer" value={opportunity.scoreBreakdown.buyerQuality} />
                    <ScorePart label="Risk" value={opportunity.scoreBreakdown.risk} />
                  </dl>
                  <Sources ids={opportunity.evidenceIds} ledger={ledger} />
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
  return (
    <section aria-label={`Recommended buyer for ${opportunity.productName}`} className="rounded-lg bg-hover p-4 sm:p-5">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Recommended buyer</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {contact?.name ? (
            <>
              <p className="font-medium">{contact.name}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{contact.title ?? opportunity.targetRole}</p>
            </>
          ) : (
            <>
              <p className="font-medium">{opportunity.targetRole}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">No named person verified yet.</p>
            </>
          )}
        </div>
        {contact && (contact.linkedinUrl || contact.email) && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="hover:bg-background inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium">
                <LinkedInIcon className="size-3.5" /> LinkedIn
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="hover:bg-background inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium">
                <Mail className="size-3.5" /> Email
              </a>
            )}
          </div>
        )}
      </div>
      {contact?.rationale && (
        <div className="mt-3 max-w-2xl">
          <Disclosure title="Why this buyer">
            <p className="text-muted-foreground text-sm leading-6">{contact.rationale}</p>
          </Disclosure>
        </div>
      )}
    </section>
  );
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

function ScorePart({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-mono tabular-nums">{value > 0 ? '+' : ''}{value}</dd>
    </div>
  );
}
