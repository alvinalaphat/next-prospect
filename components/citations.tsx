import type { EvidenceItem } from '@/lib/types';
import { cn } from '@/lib/utils';

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
    <span className={cn('inline-flex flex-wrap gap-1 align-middle', !inline && 'mt-2 flex')}>
      {ids.map((id) => {
        const e = byId.get(id);
        return (
          <a
            key={id}
            href={`#ev-${id}`}
            title={e ? `${e.label}: ${e.value}` : 'Unknown evidence id'}
            className={cn(
              'rounded border px-1 font-mono text-[10px] leading-4 transition-colors',
              e
                ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
                : 'border-red-300 text-red-600'
            )}
          >
            {id}
          </a>
        );
      })}
    </span>
  );
}
