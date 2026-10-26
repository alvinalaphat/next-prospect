'use client';

import type { EvidenceItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Open the receipts drawer, then scroll the cited row into view. */
function openReceipt(id: string) {
  const ledger = document.getElementById('evidence-ledger');
  if (ledger instanceof HTMLDetailsElement) ledger.open = true;
  document.getElementById(`ev-${id}`)?.scrollIntoView({ block: 'center' });
}

/** A one-line source count. The raw receipt ids stay inside it. */
export function Sources({ ids, ledger }: { ids: string[]; ledger: EvidenceItem[] }) {
  if (ids.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer list-none text-xs [&::-webkit-details-marker]:hidden">
        {ids.length} {ids.length === 1 ? 'source' : 'sources'}
      </summary>
      <Citations ids={ids} ledger={ledger} />
    </details>
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
