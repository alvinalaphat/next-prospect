'use client';

import { AnimatedDetails } from '@/components/disclosure';
import { ChevronDown } from 'lucide-react';
import type { EvidenceItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Open the receipts drawer, then scroll the cited row into view. */
function openReceipt(id: string) {
  const ledger = document.getElementById('evidence-ledger');
  const alreadyOpen = ledger instanceof HTMLDetailsElement && ledger.open;
  if (ledger instanceof HTMLDetailsElement) {
    ledger.open = true;
  }
  const go = () => document.getElementById(`ev-${id}`)?.scrollIntoView({ block: 'center' });
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (alreadyOpen || reduce) go();
  else window.setTimeout(go, 210);
}

/** A one-line source count. The raw receipt ids stay inside it. */
export function Sources({ ids, ledger }: { ids: string[]; ledger: EvidenceItem[] }) {
  if (ids.length === 0) return null;
  return (
    <AnimatedDetails
      className="mt-1"
      summaryClassName="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      summary={
        <>
          <span>{ids.length} {ids.length === 1 ? 'source' : 'sources'}</span>
          <ChevronDown className="disclosure-chevron size-3 group-open:rotate-180" aria-hidden />
        </>
      }
    >
      <Citations ids={ids} ledger={ledger} />
    </AnimatedDetails>
  );
}

/** Citation chips that jump to (and highlight) the ledger entry they cite. */
export function Citations({
  ids,
  ledger,
  inline
}: {
  ids: string[];
  ledger: EvidenceItem[];
  inline?: boolean;
}) {
  if (ids.length === 0) {
    return inline ? null : <p className="text-muted-foreground mt-2 text-xs">No citations</p>;
  }
  const byId = new Map(ledger.map((e) => [e.id, e]));
  return (
    <span className={cn('inline-flex flex-wrap gap-4 align-middle', !inline && 'mt-4 flex')}>
      {ids.map((id) => {
        const e = byId.get(id);
        return (
          <a
            key={id}
            href={`#ev-${id}`}
            onClick={() => openReceipt(id)}
            title={e ? `${e.label}: ${e.value}` : 'Unknown evidence id'}
            className={cn(
              'rounded-lg border px-2 py-1 font-mono text-xs leading-normal transition-colors',
              e
                ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
                : 'border-error text-error'
            )}
          >
            {id}
          </a>
        );
      })}
    </span>
  );
}
