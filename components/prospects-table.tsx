'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Mail, Search } from 'lucide-react';
import { LinkedInIcon } from '@/components/linkedin-icon';
import { HostBadge, Score, StatusBadge } from '@/components/badges';
import { HOST_LABEL, ms, relativeTime, STATUS } from '@/lib/format';
import type { HostId, ProspectStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export type ProspectListItem = {
  domain: string;
  status: ProspectStatus;
  host: string | null;
  cdn: HostId | null;
  router: string | null;
  nextjsConfidence: number | null;
  perfScore: number | null;
  lcpMs: number | null;
  ttfbMs: number | null;
  fitScore: number | null;
  angle: string | null;
  stakeholder: { name: string; title: string | null; linkedinUrl: string | null; email: string | null } | null;
  updatedAt: string;
};

type SortKey = 'domain' | 'host' | 'nextjsConfidence' | 'perfScore' | 'lcpMs' | 'fitScore' | 'status' | 'updatedAt';

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

export function ProspectsTable({ items }: { items: ProspectListItem[] }) {
  const [view, setView] = useState<keyof typeof VIEWS>('pipeline');
  const [host, setHost] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'fitScore', dir: 'desc' });

  const hosts = useMemo(
    () => [...new Set(items.map((i) => i.host).filter(Boolean))] as string[],
    [items]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(
      (i) =>
        VIEWS[view].test(i) &&
        (host === 'all' || i.host === host) &&
        (!q ||
          i.domain.includes(q) ||
          i.angle?.toLowerCase().includes(q) ||
          i.stakeholder?.name.toLowerCase().includes(q))
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
  }, [items, view, host, query, sort]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={cn('overflow-hidden px-3 py-3 font-medium', className)}>
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({
            key,
            dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : key === 'domain' || key === 'host' ? 'asc' : 'desc'
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
          <div className="grid w-fit max-w-full">
            <span aria-hidden className="invisible col-start-1 row-start-1 h-9 px-3 pr-8 text-sm leading-9 whitespace-nowrap">
              {host === 'all' ? 'All hosts' : (HOST_LABEL[host as HostId] ?? host)}
            </span>
            <select
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="col-start-1 row-start-1 h-9 w-full appearance-none rounded-lg border bg-background bg-[image:var(--select-chevron)] bg-[length:1rem] bg-[position:right_0.55rem_center] bg-no-repeat pr-8 pl-3 text-sm leading-9"
              aria-label="Filter by host"
            >
              <option value="all">All hosts</option>
              {hosts.map((h) => (
                <option key={h} value={h}>
                  {HOST_LABEL[h as HostId] ?? h}
                </option>
              ))}
            </select>
          </div>
          <label className="relative min-w-0 sm:w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter domains or angles…"
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
                <StatusBadge status={i.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Host</dt>
                  <dd className="mt-1"><HostBadge host={i.host} cdn={i.cdn} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Next.js</dt>
                  <dd className="mt-1 font-mono tabular-nums">
                    {i.nextjsConfidence == null ? '—' : `${i.nextjsConfidence}%`}
                    {i.router && <span className="text-muted-foreground ml-1 text-xs">{i.router}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Perf (mobile)</dt>
                  <dd className="mt-1"><Score value={i.perfScore} thresholds={[50, 90]} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Fit</dt>
                  <dd className="mt-1"><Score value={i.fitScore} thresholds={[35, 60]} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">LCP</dt>
                  <dd className="mt-1 font-mono tabular-nums">{ms(i.lcpMs)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Updated</dt>
                  <dd className="text-muted-foreground mt-1 text-xs">{relativeTime(i.updatedAt)}</dd>
                </div>
              </dl>
              {i.stakeholder && (
                <div className="mt-4 text-sm">
                  <div className="text-muted-foreground text-xs">Stakeholder</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="min-w-0 truncate">{i.stakeholder.name}</span>
                    {i.stakeholder.linkedinUrl && (
                      <a href={i.stakeholder.linkedinUrl} target="_blank" rel="noreferrer" title="LinkedIn profile" className="text-muted-foreground hover:text-foreground">
                        <LinkedInIcon className="size-3.5" />
                      </a>
                    )}
                    {i.stakeholder.email && (
                      <a href={`mailto:${i.stakeholder.email}`} title={i.stakeholder.email} className="text-muted-foreground hover:text-foreground">
                        <Mail className="size-3.5" />
                      </a>
                    )}
                  </div>
                  {i.stakeholder.title && (
                    <div className="text-muted-foreground truncate text-xs" title={i.stakeholder.title}>
                      {i.stakeholder.title}
                    </div>
                  )}
                </div>
              )}
              {i.angle && <p className="text-muted-foreground mt-3 text-sm">{i.angle}</p>}
            </li>
          ))}
        </ul>

      <div className="hidden overflow-x-auto rounded-lg border lg:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[7%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="text-muted-foreground border-b bg-hover text-left text-xs">
            <tr>
              {header('domain', 'Domain')}
              {header('host', 'Host')}
              {header('nextjsConfidence', 'Next.js', 'text-right')}
              {header('perfScore', 'Perf (mobile)', 'text-right')}
              {header('lcpMs', 'LCP', 'text-right')}
              {header('fitScore', 'Fit', 'text-right')}
              <th className="px-3 py-3 font-medium">Stakeholder</th>
              <th className="px-3 py-3 font-medium">Angle</th>
              {header('status', 'Status')}
              {header('updatedAt', 'Updated', 'text-right')}
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
                  <HostBadge host={i.host} cdn={i.cdn} />
                </td>
                <td className="overflow-hidden px-3 py-3 text-right">
                  {i.nextjsConfidence == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="font-mono tabular-nums">
                      {i.nextjsConfidence}%
                      {i.router && <span className="text-muted-foreground ml-1 text-xs">{i.router}</span>}
                    </span>
                  )}
                </td>
                <td className="overflow-hidden px-3 py-3 text-right">
                  <Score value={i.perfScore} thresholds={[50, 90]} className="justify-end" />
                </td>
                <td className="overflow-hidden px-3 py-3 text-right font-mono whitespace-nowrap tabular-nums">{ms(i.lcpMs)}</td>
                <td className="overflow-hidden px-3 py-3 text-right">
                  <Score value={i.fitScore} thresholds={[35, 60]} className="justify-end" />
                </td>
                <td className="overflow-hidden px-3 py-3">
                  {i.stakeholder ? (
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{i.stakeholder.name}</span>
                        {i.stakeholder.linkedinUrl && (
                          <a href={i.stakeholder.linkedinUrl} target="_blank" rel="noreferrer" title="LinkedIn profile" className="text-muted-foreground hover:text-foreground">
                            <LinkedInIcon className="size-3.5" />
                          </a>
                        )}
                        {i.stakeholder.email && (
                          <a href={`mailto:${i.stakeholder.email}`} title={i.stakeholder.email} className="text-muted-foreground hover:text-foreground">
                            <Mail className="size-3.5" />
                          </a>
                        )}
                      </div>
                      {i.stakeholder.title && (
                        <div className="text-muted-foreground truncate text-xs" title={i.stakeholder.title}>
                          {i.stakeholder.title}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-muted-foreground truncate overflow-hidden px-3 py-3" title={i.angle ?? ''}>
                  {i.angle ?? '—'}
                </td>
                <td className="overflow-hidden px-3 py-3">
                  <StatusBadge status={i.status} />
                </td>
                <td className="text-muted-foreground overflow-hidden px-3 py-3 text-right text-xs whitespace-nowrap">
                  {relativeTime(i.updatedAt)}
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
