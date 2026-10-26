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
        'inline-flex items-center gap-4 rounded-lg px-4 py-4 text-xs font-medium whitespace-nowrap',
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

const RATING_WORD: Partial<Record<keyof typeof TONE_CLASS, string>> = {
  green: 'Good',
  amber: 'Fair',
  red: 'Poor'
};

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
    green: 'bg-positive',
    amber: 'bg-warning',
    red: 'bg-error',
    neutral: 'bg-muted-foreground',
    blue: 'bg-success',
    violet: 'bg-violet'
  }[tone];
  const word = RATING_WORD[tone];
  return (
    <span className="inline-flex items-center justify-end gap-4 font-mono tabular-nums">
      <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden />
      <span>
        {value}
        {suffix}
      </span>
      {word && <Pill tone={tone}>{word}</Pill>}
    </span>
  );
}
