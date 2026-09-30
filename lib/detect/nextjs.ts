import type { NextjsDetection, Signal } from '@/lib/types';

type Rule = {
  id: string;
  label: string;
  weight: number; // independent evidence strength, 0–1
  router?: 'app' | 'pages';
  test: (html: string, headers: Record<string, string>) => string | null;
};

const snippet = (html: string, re: RegExp): string | null => {
  const m = re.exec(html);
  if (!m) return null;
  const start = Math.max(0, m.index - 20);
  return html.slice(start, m.index + m[0].length + 40).replace(/\s+/g, ' ').trim();
};

const header = (headers: Record<string, string>, name: string, re?: RegExp) => {
  const v = headers[name];
  if (v === undefined) return null;
  return !re || re.test(v) ? `${name}: ${v}` : null;
};

/**
 * Signals are ordered roughly by strength. Weights are combined as
 * independent evidence: confidence = 1 − Π(1 − wᵢ).
 */
const RULES: Rule[] = [
  {
    id: 'x-powered-by',
    label: 'x-powered-by: Next.js header',
    weight: 0.6,
    test: (_, h) => header(h, 'x-powered-by', /next\.js/i)
  },
  {
    id: 'next-f-push',
    label: 'App Router RSC payload (self.__next_f.push)',
    weight: 0.6,
    router: 'app',
    test: (html) => snippet(html, /self\.__next_f\s*(=|\.push)/)
  },
  {
    id: 'next-data',
    label: 'Pages Router data (__NEXT_DATA__)',
    weight: 0.6,
    router: 'pages',
    test: (html) => snippet(html, /<script[^>]+id=["']__NEXT_DATA__["']/)
  },
  {
    id: 'next-static',
    label: '/_next/static/ asset paths',
    weight: 0.45,
    test: (html) => snippet(html, /\/_next\/static\//)
  },
  {
    id: 'app-chunks',
    label: 'App Router chunks (/_next/static/chunks/app/)',
    weight: 0.3,
    router: 'app',
    test: (html) => snippet(html, /\/_next\/static\/chunks\/app\//)
  },
  {
    id: 'pages-chunks',
    label: 'Pages Router chunks (/_next/static/chunks/pages/)',
    weight: 0.3,
    router: 'pages',
    test: (html) => snippet(html, /\/_next\/static\/chunks\/pages\//)
  },
  {
    id: 'x-nextjs-headers',
    label: 'x-nextjs-* response headers',
    weight: 0.5,
    test: (_, h) => {
      const k = Object.keys(h).find((k) => k.startsWith('x-nextjs-'));
      return k ? `${k}: ${h[k]}` : null;
    }
  },
  {
    id: 'vary-rsc',
    label: 'Vary: RSC / Next-Router-State-Tree',
    weight: 0.5,
    router: 'app',
    test: (_, h) => header(h, 'vary', /\b(RSC|Next-Router-State-Tree)\b/i)
  },
  {
    id: 'next-image',
    label: 'next/image optimizer URLs (/_next/image?url=)',
    weight: 0.25,
    test: (html) => snippet(html, /\/_next\/image\?url=/)
  },
  {
    id: 'next-root',
    label: 'Pages Router root element (id="__next")',
    weight: 0.2,
    router: 'pages',
    test: (html) => snippet(html, /<div[^>]+id=["']__next["']/)
  },
  {
    id: 'next-head-count',
    label: 'next-head-count meta (Pages Router ≤13)',
    weight: 0.2,
    router: 'pages',
    test: (html) => snippet(html, /<meta[^>]+name=["']next-head-count["']/)
  }
];

export const IS_NEXTJS_THRESHOLD = 0.5;

export function detectNextjs(html: string, headers: Record<string, string>): NextjsDetection {
  const signals: Signal[] = [];
  let miss = 1;
  let app = 0;
  let pages = 0;

  for (const rule of RULES) {
    const match = rule.test(html, headers);
    if (!match) continue;
    signals.push({ id: rule.id, label: rule.label, match: match.slice(0, 200) });
    miss *= 1 - rule.weight;
    if (rule.router === 'app') app += rule.weight;
    if (rule.router === 'pages') pages += rule.weight;
  }

  const confidence = Math.round((1 - miss) * 100) / 100;
  const isNextjs = confidence >= IS_NEXTJS_THRESHOLD;

  return {
    isNextjs,
    confidence,
    router: !isNextjs ? null : app > pages ? 'app' : pages > app ? 'pages' : 'unknown',
    signals
  };
}
