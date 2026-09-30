import type { HostId, ProspectStatus } from '@/lib/types';

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet';

export const STATUS: Record<ProspectStatus, { label: string; tone: Tone; group: 'running' | 'review' | 'done' | 'skipped' }> = {
  queued: { label: 'Queued', tone: 'neutral', group: 'running' },
  detecting: { label: 'Detecting', tone: 'blue', group: 'running' },
  measuring: { label: 'Measuring', tone: 'blue', group: 'running' },
  researching: { label: 'Researching', tone: 'blue', group: 'running' },
  qualifying: { label: 'Qualifying', tone: 'blue', group: 'running' },
  drafting: { label: 'Drafting', tone: 'blue', group: 'running' },
  awaiting_approval: { label: 'Needs review', tone: 'amber', group: 'review' },
  approved: { label: 'Approved', tone: 'green', group: 'done' },
  rejected: { label: 'Rejected', tone: 'red', group: 'done' },
  expired: { label: 'Expired', tone: 'neutral', group: 'done' },
  vercel_customer: { label: 'On Vercel', tone: 'violet', group: 'skipped' },
  not_nextjs: { label: 'Not Next.js', tone: 'neutral', group: 'skipped' },
  robots_disallowed: { label: 'robots.txt', tone: 'neutral', group: 'skipped' },
  unreachable: { label: 'Unreachable', tone: 'neutral', group: 'skipped' },
  blocked: { label: 'Bot-blocked', tone: 'neutral', group: 'skipped' },
  disqualified: { label: 'Disqualified', tone: 'neutral', group: 'skipped' },
  error: { label: 'Error', tone: 'red', group: 'skipped' }
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
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
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

export function relativeTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
