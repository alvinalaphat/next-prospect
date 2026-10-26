import { ChevronDown } from 'lucide-react';

/** A bordered group of drawers. The title stays visible; each row opens on its own. */
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border">
      <h2 className="px-4 py-4 text-sm font-medium sm:px-6">{title}</h2>
      <div className="divide-y border-t px-4 sm:px-6">{children}</div>
    </section>
  );
}

export function Disclosure({
  id,
  title,
  hint,
  children,
  className
}: {
  id?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details id={id} className={className ? `group ${className}` : 'group'}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {hint ? <span className="text-muted-foreground mt-1 line-clamp-2 block text-sm leading-normal">{hint}</span> : null}
        </span>
        <ChevronDown
          className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform duration-200 ease-out-strong motion-reduce:transition-none group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="disclosure-panel pb-4">{children}</div>
    </details>
  );
}
