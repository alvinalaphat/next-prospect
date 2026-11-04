import type { HostId, ProspectStatus } from '@/lib/types';

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet';

export const STATUS: Record<ProspectStatus, { label: string; tone: Tone; group: 'running' | 'review' | 'done' | 'no_pitch' | 'error' }> = {
  queued: { label: 'Queued', tone: 'neutral', group: 'running' },
  detecting: { label: 'Detecting', tone: 'blue', group: 'running' },
  measuring: { label: 'Measuring', tone: 'blue', group: 'running' },
  researching: { label: 'Researching', tone: 'blue', group: 'running' },
  qualifying: { label: 'Qualifying', tone: 'blue', group: 'running' },
  drafting: { label: 'Drafting', tone: 'blue', group: 'running' },
  awaiting_approval: { label: 'Needs review', tone: 'amber', group: 'review' },
  approved: { label: 'Approved', tone: 'green', group: 'done' },
  rejected: { label: 'Rejected', tone: 'red', group: 'done' },
  disqualified: { label: 'No supported pitch', tone: 'neutral', group: 'no_pitch' },
  error: { label: 'Error', tone: 'red', group: 'error' }
};

export const HOST_LABEL: Record<HostId, string> = {
  vercel: 'Vercel',
  netlify: 'Netlify',
  cloudflare: 'Cloudflare',
  aws: 'AWS',
  fastly: 'Fastly',
  akamai: 'Akamai',
  gcp: 'Google Cloud',
  azure: 'Azure',
  render: 'Render',
  fly: 'Fly.io',
  railway: 'Railway',
  heroku: 'Heroku',
  unknown: 'Unknown'
};

export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border border-border bg-hover text-muted-foreground',
  blue: 'border border-success/40 bg-background text-success',
  green: 'border border-positive/40 bg-background text-positive',
  amber: 'border border-warning/40 bg-background text-warning',
  red: 'border border-error/40 bg-background text-error',
  violet: 'border border-violet/40 bg-background text-violet'
};

export function scoreTone(score: number | null | undefined, [poor, good]: [number, number]): Tone {
  if (score == null) return 'neutral';
  return score >= good ? 'green' : score < poor ? 'red' : 'amber';
}

export const RATING_TONE = { good: 'green', 'needs-improvement': 'amber', poor: 'red' } as const;

export function ms(n: number | null | undefined) {
  if (n == null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`;
}

export function relativeTime(date: Date | string, now = Date.now()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
