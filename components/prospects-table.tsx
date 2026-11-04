'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { AccountActions } from '@/components/account-actions';
import { Score, StatusBadge } from '@/components/badges';
import { relativeTime, STATUS } from '@/lib/format';
import type { ProspectStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export type ProspectListItem = {
  domain: string;
  status: ProspectStatus;
  fitScore: number | null;
  opportunityName: string | null;
  updatedAt: string;
};

type SortKey = 'domain' | 'fitScore' | 'status' | 'updatedAt';

const VIEWS = {
  pipeline: { label: 'Pipeline', test: (i: ProspectListItem) => STATUS[i.status].group !== 'skipped' },
  review: { label: 'Needs review', test: (i: ProspectListItem) => i.status === 'awaiting_approval' },
  skipped: { label: 'Skipped', test: (i: ProspectListItem) => STATUS[i.status].group === 'skipped' },
  all: { label: 'All', test: () => true }
} as const;

/** Inset track so the active fill never sits on the border. The fill slides between options. */
function ViewSwitch({
  view,
  onChange,
  counts
}: {
  view: keyof typeof VIEWS;
  onChange: (view: keyof typeof VIEWS) => void;
  counts: Record<keyof typeof VIEWS, number>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const active = track.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!active) return;
      setBox({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [view]);

  useEffect(() => setReady(true), []);

  return (
    <div
      ref={trackRef}
      className="relative grid grid-cols-2 gap-1 rounded-lg border p-1 text-sm sm:flex sm:w-fit"
    >
      {box && (
        <span
          aria-hidden
          data-ready={ready ? 'true' : 'false'}
          className="filter-thumb bg-hover pointer-events-none absolute rounded-[4px]"
          style={{ left: 0, top: 0, width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }}
        />
      )}
      {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => (
        <button
          key={v}
          type="button"
          data-no-press
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={cn(
            'relative z-10 min-h-11 rounded-[4px] px-3 py-2 text-left whitespace-nowrap sm:text-center',
            view === v ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            view === v && !box && 'bg-hover'
          )}
        >
          {VIEWS[v].label}
          <span className="text-muted-foreground ml-2 font-mono text-xs">{counts[v]}</span>
        </button>
      ))}
    </div>
  );
}

export function ProspectsTable({ items, renderedAt }: { items: ProspectListItem[]; renderedAt: number }) {
  const [view, setView] = useState<keyof typeof VIEWS>('pipeline');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'fitScore', dir: 'desc' });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(
      (i) =>
        VIEWS[view].test(i) &&
        (!q ||
          i.domain.includes(q) ||
          i.opportunityName?.toLowerCase().includes(q))
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      // nulls always last
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }, [items, view, query, sort]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={cn('overflow-hidden px-3 py-3 font-medium', className)}>
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({
            key,
            dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : key === 'domain' ? 'asc' : 'desc'
          }))
        }
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        {label}
        {sort.key === key &&
          (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <ViewSwitch
          view={view}
          onChange={setView}
          counts={Object.fromEntries(
            (Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => [v, items.filter(VIEWS[v].test).length])
          ) as Record<keyof typeof VIEWS, number>}
        />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto">
          <label className="relative min-w-0 sm:w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter companies…"
              className="bg-background min-h-11 w-full rounded-lg border py-2 pr-3 pl-9 text-sm"
            />
          </label>
        </div>
      </div>

      <div key={view} className="rows-in">
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border px-4 py-8 text-center text-sm">
          {items.length === 0 ? 'No prospects yet — run a batch of domains to get started.' : 'Nothing matches these filters.'}
        </p>
      ) : (
        <>
        <ul className="space-y-3 lg:hidden">
          {rows.map((i) => (
            <li key={i.domain} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/prospect/${i.domain}`} className="min-w-0 font-medium break-all hover:underline">
                  {i.domain}
                </Link>
                <AccountActions domain={i.domain} status={i.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Opportunity score</dt>
                  <dd className="mt-1"><Score value={i.fitScore} thresholds={[35, 60]} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Status</dt>
                  <dd className="mt-1"><StatusBadge status={i.status} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Updated</dt>
                  <dd className="text-muted-foreground mt-1 text-xs">{relativeTime(i.updatedAt, renderedAt)}</dd>
                </div>
              </dl>
              {i.opportunityName && (
                <div className="mt-4 text-sm">
                  <div className="text-muted-foreground text-xs">Best opportunity</div>
                  <div className="mt-1 font-medium">{i.opportunityName}</div>
                </div>
              )}
            </li>
          ))}
        </ul>

      <div className="hidden overflow-x-auto rounded-lg border lg:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[35%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead className="text-muted-foreground border-b bg-hover text-left text-xs">
            <tr>
              {header('domain', 'Company')}
              <th className="px-3 py-3 font-medium">Best sales pitch</th>
              {header('fitScore', 'Score', 'text-right')}
              {header('status', 'Status')}
              {header('updatedAt', 'Updated', 'text-right')}
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((i) => (
              <tr key={i.domain} className="hover:bg-accent/50 group">
                <td className="overflow-hidden px-3 py-3">
                  <Link href={`/prospect/${i.domain}`} className="block truncate font-medium group-hover:underline">
                    {i.domain}
                  </Link>
                </td>
                <td className="overflow-hidden px-3 py-3">
                  {i.opportunityName
                    ? <span className="block truncate font-medium">{i.opportunityName}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="overflow-hidden px-3 py-3 text-right">
                  <Score value={i.fitScore} thresholds={[35, 60]} className="justify-end" />
                </td>
                <td className="overflow-hidden px-3 py-3">
                  <StatusBadge status={i.status} />
                </td>
                <td className="text-muted-foreground overflow-hidden px-3 py-3 text-right text-xs whitespace-nowrap">
                  {relativeTime(i.updatedAt, renderedAt)}
                </td>
                <td className="overflow-hidden px-3 py-3">
                  <AccountActions domain={i.domain} status={i.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
      </div>
    </div>
  );
}
