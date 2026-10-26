'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
    <th className={cn('px-4 py-4 font-medium', className)}>
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({
            key,
            dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : key === 'domain' || key === 'host' ? 'asc' : 'desc'
          }))
        }
        className="hover:text-foreground inline-flex items-center gap-4"
      >
        {label}
        {sort.key === key &&
          (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap rounded-lg border border-border text-sm">
          {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-lg px-4 py-4 whitespace-nowrap transition-colors',
                view === v ? 'bg-hover text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {VIEWS[v].label}
              <span className="text-muted-foreground ml-4 font-mono text-xs">
                {items.filter(VIEWS[v].test).length}
              </span>
            </button>
          ))}
        </div>
        <select
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="bg-background rounded-lg border px-4 py-4 text-sm"
          aria-label="Filter by host"
        >
          <option value="all">All hosts</option>
          {hosts.map((h) => (
            <option key={h} value={h}>
              {HOST_LABEL[h as HostId] ?? h}
            </option>
          ))}
        </select>
        <label className="relative sm:ml-auto">
          <Search className="text-muted-foreground absolute top-4 left-4 size-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter domains or angles…"
            className="bg-background w-full rounded-lg border py-4 pr-4 pl-10 text-sm sm:w-64"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-muted-foreground border-b bg-hover text-left text-xs">
            <tr>
              {header('domain', 'Domain')}
              {header('host', 'Host')}
              {header('nextjsConfidence', 'Next.js', 'text-right')}
              {header('perfScore', 'Perf (mobile)', 'text-right')}
              {header('lcpMs', 'LCP', 'text-right')}
              {header('fitScore', 'Fit', 'text-right')}
              <th className="px-4 py-4 font-medium">Stakeholder</th>
              <th className="px-4 py-4 font-medium">Angle</th>
              {header('status', 'Status')}
              {header('updatedAt', 'Updated', 'text-right')}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((i) => (
              <tr key={i.domain} className="hover:bg-accent/50 group">
                <td className="px-4 py-4">
                  <Link href={`/prospect/${i.domain}`} className="font-medium group-hover:underline">
                    {i.domain}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <HostBadge host={i.host} cdn={i.cdn} />
                </td>
                <td className="px-4 py-4 text-right">
                  {i.nextjsConfidence == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="font-mono tabular-nums">
                      {i.nextjsConfidence}%
                      {i.router && <span className="text-muted-foreground ml-1 text-xs">{i.router}</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <Score value={i.perfScore} thresholds={[50, 90]} />
                </td>
                <td className="px-4 py-4 text-right font-mono whitespace-nowrap tabular-nums">{ms(i.lcpMs)}</td>
                <td className="px-4 py-4 text-right">
                  <Score value={i.fitScore} thresholds={[35, 60]} />
                </td>
                <td className="px-4 py-4">
                  {i.stakeholder ? (
                    <div className="max-w-52">
                      <div className="flex items-center gap-4">
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
                <td className="text-muted-foreground max-w-64 truncate px-4 py-4" title={i.angle ?? ''}>
                  {i.angle ?? '—'}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={i.status} />
                </td>
                <td className="text-muted-foreground px-4 py-4 text-right text-xs whitespace-nowrap">
                  {relativeTime(i.updatedAt)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-muted-foreground px-4 py-8 text-center">
                  {items.length === 0 ? 'No prospects yet — run a batch of domains to get started.' : 'Nothing matches these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
