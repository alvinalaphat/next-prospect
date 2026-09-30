import { cn } from '@/lib/utils';
import { HOST_LABEL, scoreTone, STATUS, TONE_CLASS } from '@/lib/format';
import type { HostId, ProspectStatus } from '@/lib/types';

export function Pill({
  tone = 'neutral',
  className,
  children
}: {
  tone?: keyof typeof TONE_CLASS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProspectStatus }) {
  const s = STATUS[status];
  return (
    <Pill tone={s.tone}>
      {s.group === 'running' && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {s.label}
    </Pill>
  );
}

export function HostBadge({ host, cdn }: { host: HostId | string | null; cdn?: HostId | null }) {
  if (!host) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="whitespace-nowrap">
      {HOST_LABEL[host as HostId] ?? host}
      {cdn && <span className="text-muted-foreground"> + {HOST_LABEL[cdn]}</span>}
    </span>
  );
}

export function Score({
  value,
  thresholds,
  suffix
}: {
  value: number | null | undefined;
  thresholds: [number, number];
  suffix?: string;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone = scoreTone(value, thresholds);
  const dot = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    neutral: 'bg-zinc-400',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500'
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
      <span className={cn('size-2 rounded-full', dot)} aria-hidden />
      {value}
      {suffix}
    </span>
  );
}
