'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';
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

/** Details whose body eases open and closed. Closing stays in the document until the fade finishes. */
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
  const ref = useRef<HTMLDetailsElement>(null);

  function onSummaryClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const el = ref.current;
    if (!el) return;

    if (el.dataset.closing === 'true') {
      delete el.dataset.closing;
      return;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el.open || reduce) {
      el.open = !el.open;
      return;
    }

    const panel = el.querySelector<HTMLElement>(':scope > .disclosure-panel');
    el.dataset.closing = 'true';
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.open = false;
      delete el.dataset.closing;
    };
    const onEnd = (ev: TransitionEvent) => {
      if (ev.target === panel && ev.propertyName === 'grid-template-rows') finish();
    };
    panel?.addEventListener('transitionend', onEnd);
    window.setTimeout(() => {
      panel?.removeEventListener('transitionend', onEnd);
      finish();
    }, 180);
  }

  return (
    <details id={id} ref={ref} className={className ? `group ${className}` : 'group'}>
      <summary onClick={onSummaryClick} className={summaryClassName}>
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
      summaryClassName="flex cursor-pointer list-none items-start justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden"
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
