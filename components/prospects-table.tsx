'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowDown, ArrowUp, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountActions } from '@/components/account-actions';
import { Score, StatusBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { authHeaders, secretCheckMessage, useRunSecret } from '@/lib/client-secret';
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

const ACTION_STATUSES = new Set<ProspectStatus>(['awaiting_approval', 'error']);
const REVIEWED_STATUSES = new Set<ProspectStatus>(['approved', 'rejected']);
const MAX_BULK_SELECTION = 250;

const VIEWS = {
  all: { label: 'All', test: () => true },
  action: {
    label: 'Action needed',
    test: (i: ProspectListItem) => ACTION_STATUSES.has(i.status)
  },
  running: { label: 'In progress', test: (i: ProspectListItem) => STATUS[i.status].group === 'running' },
  reviewed: { label: 'Reviewed', test: (i: ProspectListItem) => REVIEWED_STATUSES.has(i.status) },
  noPitch: {
    label: 'No pitch',
    test: (i: ProspectListItem) => STATUS[i.status].group === 'no_pitch'
  }
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
  const router = useRouter();
  const secretField = useRunSecret();
  const [view, setView] = useState<keyof typeof VIEWS>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'fitScore', dir: 'desc' });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<'rerun' | 'delete' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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

  const selectedDomains = useMemo(
    () => items.filter((item) => selected.has(item.domain)).map((item) => item.domain),
    [items, selected]
  );
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.has(row.domain));
  const someVisibleSelected = rows.some((row) => selected.has(row.domain));

  function toggleDomain(domain: string) {
    if (!selected.has(domain) && selected.size >= MAX_BULK_SELECTION) {
      toast.error(`Select up to ${MAX_BULK_SELECTION} accounts at a time`);
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function toggleVisible() {
    if (allVisibleSelected) {
      setSelected((current) => {
        const next = new Set(current);
        rows.forEach((row) => next.delete(row.domain));
        return next;
      });
      return;
    }

    const available = MAX_BULK_SELECTION - selected.size;
    const unselectedRows = rows.filter((row) => !selected.has(row.domain));
    if (unselectedRows.length > available) {
      toast.error(available > 0
        ? `Selected ${available} more shown accounts · ${MAX_BULK_SELECTION} max`
        : `Selection is already at the ${MAX_BULK_SELECTION}-account maximum`);
    }
    setSelected((current) => {
      const next = new Set(current);
      unselectedRows.slice(0, available).forEach((row) => next.add(row.domain));
      return next;
    });
  }

  async function authorized() {
    const result = await secretField.commit();
    if (result.status !== 'valid') toast.error(secretCheckMessage(result.status));
    return result.status === 'valid' ? result.value : null;
  }

  async function rerunSelected() {
    setBulkBusy('rerun');
    const secret = await authorized();
    if (!secret) return setBulkBusy(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(secret) },
        body: JSON.stringify({ domains: selectedDomains, force: true })
      });
      const json = await response.json();
      if (response.status === 401) secretField.reveal();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(`Re-running ${json.started.length} account${json.started.length === 1 ? '' : 's'}`);
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to re-run selected accounts');
    } finally {
      setBulkBusy(null);
    }
  }

  async function deleteSelected() {
    setBulkBusy('delete');
    const secret = await authorized();
    if (!secret) return setBulkBusy(null);
    try {
      const response = await fetch('/api/prospects', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', ...authHeaders(secret) },
        body: JSON.stringify({ domains: selectedDomains })
      });
      const json = await response.json();
      if (response.status === 401) secretField.reveal();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(`Deleted ${json.deleted.length} account${json.deleted.length === 1 ? '' : 's'}`);
      setDeleteConfirmOpen(false);
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete selected accounts');
    } finally {
      setBulkBusy(null);
    }
  }

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
    <div className={cn('space-y-4', selectedDomains.length > 0 && 'pb-44 sm:pb-28')}>
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
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter companies…"
              className="min-h-11 pr-3 pl-9"
            />
          </label>
        </div>
      </div>

      {selectedDomains.length > 0 && (
        <div className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 flex justify-center sm:right-6 sm:left-6">
          <div
            role="toolbar"
            aria-label="Selected account actions"
            className="bulk-actions-in bg-background/95 pointer-events-auto flex w-full max-w-2xl flex-col gap-3 rounded-lg border p-3 shadow-geist backdrop-blur-md sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">
                {selectedDomains.length} selected
                <span className="text-muted-foreground font-normal"> · {MAX_BULK_SELECTION} max</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Clear selection"
                disabled={bulkBusy !== null}
                onClick={() => setSelected(new Set())}
              >
                <X />
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
              {secretField.show && (
                <Input
                  type="password"
                  value={secretField.secret}
                  onChange={(event) => secretField.update(event.target.value)}
                  onBlur={() => void secretField.commit()}
                  placeholder="RUN_SECRET"
                  autoComplete="off"
                  aria-label="Run secret for bulk actions"
                  aria-invalid={secretField.invalid || undefined}
                  className="min-w-0 sm:w-40"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulkBusy !== null}
                  onClick={() => void rerunSelected()}
                >
                  <RefreshCw className={bulkBusy === 'rerun' ? 'animate-spin' : undefined} />
                  Re-run
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={bulkBusy !== null}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div key={view} className="rows-in">
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border px-4 py-8 text-center text-sm">
          {items.length === 0 ? 'No prospects yet — run a batch of domains to get started.' : 'Nothing matches these filters.'}
        </p>
      ) : (
        <>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border px-4 text-sm lg:hidden">
          <Checkbox
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected && !allVisibleSelected}
            onChange={toggleVisible}
            aria-label={rows.length > MAX_BULK_SELECTION ? `Select up to ${MAX_BULK_SELECTION} shown accounts` : 'Select all shown accounts'}
          />
          {rows.length > MAX_BULK_SELECTION ? `Select first ${MAX_BULK_SELECTION} shown` : 'Select all shown'}
        </label>
        <ul className="mt-3 space-y-3 lg:hidden">
          {rows.map((i) => (
            <li
              key={i.domain}
              className={cn(
                'cursor-pointer rounded-lg border p-4 transition-colors hover:bg-accent/50',
                selected.has(i.domain) && 'border-foreground/20 bg-hover'
              )}
              onClick={(event) => openProspect(event, i.domain, router.push)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Checkbox
                    checked={selected.has(i.domain)}
                    onChange={() => toggleDomain(i.domain)}
                    aria-label={`Select ${i.domain}`}
                  />
                  <Link href={`/prospect/${i.domain}`} className="min-w-0 font-medium break-all hover:underline">
                    {i.domain}
                  </Link>
                </div>
                <AccountActions domain={i.domain} />
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
            <col className="w-[4%]" />
            <col className="w-[20%]" />
            <col className="w-[33%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead className="text-muted-foreground border-b bg-hover text-left text-xs">
            <tr>
              <th className="px-3 py-3">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  onChange={toggleVisible}
                  aria-label={rows.length > MAX_BULK_SELECTION ? `Select up to ${MAX_BULK_SELECTION} shown accounts` : 'Select all shown accounts'}
                />
              </th>
              {header('domain', 'Company')}
              <th className="px-3 py-3 font-medium">Best sales pitch</th>
              {header('fitScore', 'Score', 'text-right')}
              {header('status', 'Status', 'pl-6')}
              {header('updatedAt', 'Updated', 'text-right')}
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((i) => (
              <tr
                key={i.domain}
                className={cn(
                  'group cursor-pointer transition-colors hover:bg-accent/50',
                  selected.has(i.domain) && 'bg-hover'
                )}
                onClick={(event) => openProspect(event, i.domain, router.push)}
              >
                <td className="px-3 py-3">
                  <Checkbox
                    checked={selected.has(i.domain)}
                    onChange={() => toggleDomain(i.domain)}
                    aria-label={`Select ${i.domain}`}
                  />
                </td>
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
                <td className="overflow-hidden py-3 pr-3 pl-6">
                  <StatusBadge status={i.status} />
                </td>
                <td className="text-muted-foreground overflow-hidden px-3 py-3 text-right text-xs whitespace-nowrap">
                  {relativeTime(i.updatedAt, renderedAt)}
                </td>
                <td className="overflow-hidden px-3 py-3">
                  <AccountActions domain={i.domain} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
      </div>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete ${selectedDomains.length} account${selectedDomains.length === 1 ? '' : 's'}?`}
        description="This permanently removes the selected accounts and all of their opportunities and drafts. This action cannot be undone."
        confirmLabel="Delete accounts"
        busy={bulkBusy === 'delete'}
        onConfirm={() => void deleteSelected()}
        onOpenChange={setDeleteConfirmOpen}
      />
    </div>
  );
}

function openProspect(
  event: MouseEvent,
  domain: string,
  navigate: (href: string) => void
) {
  if ((event.target as HTMLElement).closest('a, button, input, textarea, select, [role="menuitem"]')) return;
  navigate(`/prospect/${encodeURIComponent(domain)}`);
}
