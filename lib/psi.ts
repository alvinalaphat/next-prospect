import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { EvidenceItem, Perf, PerfResult, Strategy } from '@/lib/types';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class PsiRateLimitError extends Error {}

/**
 * Google PageSpeed Insights for one URL + strategy. Returns lab metrics
 * (Lighthouse) and field metrics (CrUX p75) when Google has them.
 */
export async function runPsi(url: string, strategy: Strategy): Promise<PerfResult> {
  const cached = await db()
    .select()
    .from(schema.psiCache)
    .where(
      and(
        eq(schema.psiCache.url, url),
        eq(schema.psiCache.strategy, strategy),
        gt(schema.psiCache.fetchedAt, new Date(Date.now() - CACHE_TTL_MS))
      )
    )
    .limit(1);
  if (cached[0]) return cached[0].result;

  const params = new URLSearchParams({ url, strategy, category: 'performance' });
  if (process.env.PSI_API_KEY) params.set('key', process.env.PSI_API_KEY);

  const res = await fetch(`${PSI_ENDPOINT}?${params}`, { signal: AbortSignal.timeout(120_000) });
  if (res.status === 429) throw new PsiRateLimitError('PSI rate limited');
  const json = await res.json();

  if (!res.ok) {
    // Lighthouse failures (e.g. the site blocks Google's crawler) are a
    // property of the site, not a transient error — record and move on.
    return emptyPerfResult(strategy, json?.error?.message ?? `HTTP ${res.status}`);
  }

  const result = parsePsi(json, strategy);
  await db()
    .insert(schema.psiCache)
    .values({ url, strategy, result })
    .onConflictDoUpdate({
      target: [schema.psiCache.url, schema.psiCache.strategy],
      set: { result, fetchedAt: new Date() }
    });
  return result;
}

type PsiJson = {
  lighthouseResult?: {
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, { numericValue?: number }>;
  };
  loadingExperience?: CruxBlock;
  originLoadingExperience?: CruxBlock;
};
type CruxBlock = {
  overall_category?: string;
  metrics?: Record<string, { percentile?: number }>;
};

export function parsePsi(json: PsiJson, strategy: Strategy): PerfResult {
  const lh = json.lighthouseResult;
  const audit = (id: string) => lh?.audits?.[id]?.numericValue ?? null;
  const score = lh?.categories?.performance?.score;

  // Prefer URL-level field data; fall back to origin-level.
  const urlHasData = !!json.loadingExperience?.metrics;
  const crux = urlHasData ? json.loadingExperience : json.originLoadingExperience;
  const p75 = (k: string) => crux?.metrics?.[k]?.percentile ?? null;
  const cls = p75('CUMULATIVE_LAYOUT_SHIFT_SCORE');

  return {
    strategy,
    score: typeof score === 'number' ? Math.round(score * 100) : null,
    lab: {
      lcpMs: round(audit('largest-contentful-paint')),
      clsScore: roundTo(audit('cumulative-layout-shift'), 3),
      ttfbMs: round(audit('server-response-time')),
      tbtMs: round(audit('total-blocking-time'))
    },
    field: {
      lcpMs: p75('LARGEST_CONTENTFUL_PAINT_MS'),
      inpMs: p75('INTERACTION_TO_NEXT_PAINT'),
      clsScore: cls === null ? null : cls / 100,
      ttfbMs: p75('EXPERIMENTAL_TIME_TO_FIRST_BYTE'),
      category: crux?.overall_category ?? null,
      scope: crux?.metrics ? (urlHasData ? 'url' : 'origin') : null
    },
    fetchedAt: new Date().toISOString()
  };
}

export function emptyPerfResult(strategy: Strategy, error: string): PerfResult {
  return {
    strategy,
    score: null,
    lab: { lcpMs: null, clsScore: null, ttfbMs: null, tbtMs: null },
    field: { lcpMs: null, inpMs: null, clsScore: null, ttfbMs: null, category: null, scope: null },
    fetchedAt: new Date().toISOString(),
    error
  };
}

const round = (n: number | null) => (n === null ? null : Math.round(n));
const roundTo = (n: number | null, d: number) =>
  n === null ? null : Math.round(n * 10 ** d) / 10 ** d;

/** Core Web Vitals "good" / "poor" thresholds (web.dev). */
export const CWV = {
  lcpMs: { good: 2500, poor: 4000 },
  inpMs: { good: 200, poor: 500 },
  clsScore: { good: 0.1, poor: 0.25 },
  ttfbMs: { good: 800, poor: 1800 }
} as const;

export function rate(metric: keyof typeof CWV, value: number | null) {
  if (value === null) return null;
  const t = CWV[metric];
  return value <= t.good ? 'good' : value > t.poor ? 'poor' : 'needs-improvement';
}

export function perfEvidence(perf: Perf, url: string): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const psiUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`;
  for (const r of [perf.mobile, perf.desktop]) {
    const s = r.strategy;
    const add = (id: string, label: string, value: number | string | null, unit = '') => {
      if (value === null) return;
      items.push({ id: `psi.${s}.${id}`, source: 'psi', label: `${label} (${s})`, value: `${value}${unit}`, url: psiUrl });
    };
    add('score', 'Lighthouse performance score', r.score, '/100');
    add('lab.lcp', 'Lab LCP', r.lab.lcpMs, ' ms');
    add('lab.ttfb', 'Lab server response time (TTFB)', r.lab.ttfbMs, ' ms');
    add('lab.cls', 'Lab CLS', r.lab.clsScore);
    add('lab.tbt', 'Lab Total Blocking Time', r.lab.tbtMs, ' ms');
    const scope = r.field.scope === 'origin' ? 'origin-level field p75' : 'field p75';
    add('field.lcp', `Real-user LCP, ${scope}`, r.field.lcpMs, ' ms');
    add('field.inp', `Real-user INP, ${scope}`, r.field.inpMs, ' ms');
    add('field.cls', `Real-user CLS, ${scope}`, r.field.clsScore);
    add('field.ttfb', `Real-user TTFB, ${scope}`, r.field.ttfbMs, ' ms');
    if (r.field.category) add('field.category', 'Core Web Vitals assessment', r.field.category);
  }
  return items;
}
