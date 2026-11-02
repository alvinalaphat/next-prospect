import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** A bordered group of drawers. The title stays visible; each row opens on its own. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border">
      <h2 className="px-4 py-4 text-sm font-medium sm:px-6">{title}</h2>
      <div className="divide-y border-t px-4 sm:px-6">{children}</div>
    </section>
  );
}

/** A native disclosure with a light enter transition and reliable keyboard behavior. */
export function AnimatedDetails({
  id,
  className,
  summaryClassName,
  summary,
  children
}: {
  id?: string;
  className?: string;
  summaryClassName: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <details id={id} className={className ? `group ${className}` : 'group'}>
      <summary className={summaryClassName}>
        {summary}
      </summary>
      <div className="disclosure-panel">
        <div className="disclosure-clip">{children}</div>
      </div>
    </details>
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
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatedDetails
      id={id}
      className={className}
      summaryClassName="-mx-2 flex cursor-pointer list-none items-start justify-between gap-4 rounded-lg px-2 py-4 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      summary={
        <>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{title}</span>
            {hint ? <span className="text-muted-foreground mt-1 line-clamp-2 block text-sm leading-normal">{hint}</span> : null}
          </span>
          <ChevronDown className="disclosure-chevron text-muted-foreground mt-0.5 size-4 shrink-0 group-open:rotate-180" aria-hidden />
        </>
      }
    >
      <div className="pb-4">{children}</div>
    </AnimatedDetails>
  );
}
