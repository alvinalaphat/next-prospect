import type { EvidenceItem } from '@/lib/types';

export type PresentedEvidence = {
  label: string;
  statement: string;
  sourceLabel: string | null;
};

const HOST_NAMES: Record<string, string> = {
  aws: 'AWS',
  azure: 'Azure',
  cloudflare: 'Cloudflare',
  fastly: 'Fastly',
  fly: 'Fly.io',
  gcp: 'Google Cloud',
  heroku: 'Heroku',
  netlify: 'Netlify',
  railway: 'Railway',
  render: 'Render',
  vercel: 'Vercel'
};

export function presentEvidence(evidence: EvidenceItem): PresentedEvidence {
  const performance = evidence.id.match(/^psi\.(mobile|desktop)\.(field|lab)\.(lcp|ttfb|inp|cls|tbt)$/);
  if (performance) {
    const [, strategy, kind, metric] = performance;
    const context = kind === 'field'
      ? `For most real ${strategy} visitors`
      : `In one ${strategy} performance test`;
    const duration = durationFromMilliseconds(evidence.value);
    const statements: Record<string, string> = {
      lcp: `${context}, the main page content appeared in ${duration}.`,
      ttfb: `${context}, the server started responding in ${duration}.`,
      inp: `${context}, the site responded to a tap or click in ${duration}.`,
      cls: `${context}, the visual-stability score was ${numberFrom(evidence.value)}; lower is better.`,
      tbt: `${context}, the page was too busy to respond for ${duration}.`
    };
    return {
      label: kind === 'field' ? 'Real visitor experience' : 'Performance test',
      statement: statements[metric] ?? evidence.value,
      sourceLabel: sourceLabel(evidence.url)
    };
  }

  const performanceScore = evidence.id.match(/^psi\.(mobile|desktop)\.score$/);
  if (performanceScore) {
    return {
      label: 'Performance test',
      statement: `The ${performanceScore[1]} performance test scored ${evidence.value.replace('/100', '')} out of 100.`,
      sourceLabel: sourceLabel(evidence.url)
    };
  }

  const performanceAssessment = evidence.id.match(/^psi\.(mobile|desktop)\.field\.category$/);
  if (performanceAssessment) {
    return {
      label: 'Real visitor experience',
      statement: `Google's overall Core Web Vitals result for ${performanceAssessment[1]} visitors was ${evidence.value.toLowerCase()}.`,
      sourceLabel: sourceLabel(evidence.url)
    };
  }

  if (evidence.id === 'benchmark.lcp') {
    return benchmark(evidence, 'Google considers main content fast when it appears within 2.5 seconds.');
  }
  if (evidence.id === 'benchmark.ttfb') {
    return benchmark(evidence, 'Google considers a server response fast when it begins within 0.8 seconds.');
  }
  if (evidence.id === 'benchmark.inp') {
    return benchmark(evidence, 'Google considers a page responsive when it reacts to a tap or click within 0.2 seconds.');
  }

  if (evidence.id.startsWith('detect.nextjs.')) {
    const isSummary = evidence.id === 'detect.nextjs.summary';
    const found = !/not detected/i.test(evidence.value);
    return {
      label: 'Website technology',
      statement: isSummary
        ? found
          ? 'The website scan found enough public signals to identify Next.js.'
          : 'The website scan did not find enough public signals to confirm Next.js.'
        : 'The website scan found a Next.js-related marker. Its strength is reflected in the score above.',
      sourceLabel: sourceLabel(evidence.url)
    };
  }

  if (evidence.id.startsWith('detect.host.')) {
    const host = hostName(evidence);
    return {
      label: 'Website hosting',
      statement: host
        ? `The public website shows a hosting signal for ${host}.`
        : 'The website scan could not identify a hosting provider.',
      sourceLabel: sourceLabel(evidence.url)
    };
  }

  if (evidence.id.startsWith('research.buyer-activity.')) {
    return research(evidence, 'Buyer activity');
  }
  if (evidence.id.startsWith('research.buyer-region.')) return research(evidence, 'Buyer work location');
  if (evidence.id === 'research.summary') return research(evidence, 'Company background');
  if (evidence.id.startsWith('research.size.')) return research(evidence, 'Account potential');
  if (evidence.id.startsWith('research.news.') || evidence.id.startsWith('research.whynow.')) {
    return research(evidence, 'Why now');
  }
  if (evidence.id.startsWith('research.signal.')) return research(evidence, 'Public company signal');
  if (evidence.id.startsWith('research.precedent.')) return research(evidence, 'Vercel customer precedent');
  if (evidence.id === 'research.region') return research(evidence, 'Company headquarters');

  return {
    label: plainLabel(evidence.label),
    statement: salesLanguage(evidence.value),
    sourceLabel: sourceLabel(evidence.url)
  };
}

export function sourceLabel(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'pagespeed.web.dev') return 'PageSpeed';
    if (host === 'web.dev') return 'Google Web Vitals';
    return host;
  } catch {
    return 'Source';
  }
}

export function salesLanguage(value: string): string {
  return value
    .replace(/(\d+(?:\.\d+)?)\s*ms\b/gi, (_match, milliseconds: string) => durationFromMilliseconds(milliseconds))
    .replace(/\bLCP\b/g, 'main-content load time')
    .replace(/\bTTFB\b/g, 'server response time')
    .replace(/\bINP\b/g, 'tap and click response time')
    .replace(/\bCLS\b/g, 'visual stability')
    .replace(/\bTBT\b/g, 'page responsiveness')
    .replace(/\bCrUX\b/g, 'real-user performance data')
    .replace(/\bp75\b/gi, 'the experience for most visitors')
    .replace(/\bCDN\b/g, 'content delivery network')
    .replace(/\bCNAME\b/g, 'domain routing')
    .replace(/\bApp Router\b/g, 'modern Next.js architecture')
    .replace(/\bPages Router\b/g, 'older Next.js architecture');
}

function benchmark(evidence: EvidenceItem, statement: string): PresentedEvidence {
  return { label: 'Google benchmark', statement, sourceLabel: sourceLabel(evidence.url) };
}

function research(evidence: EvidenceItem, label: string): PresentedEvidence {
  return { label, statement: salesLanguage(evidence.value), sourceLabel: sourceLabel(evidence.url) };
}

function durationFromMilliseconds(value: string): string {
  const milliseconds = Number.parseFloat(value);
  if (!Number.isFinite(milliseconds)) return value;
  const seconds = milliseconds / 1000;
  const precision = seconds < 1 ? 2 : seconds < 10 ? 1 : 0;
  return `${Number(seconds.toFixed(precision))} seconds`;
}

function numberFrom(value: string): string {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? `${number}` : value;
}

function hostName(evidence: EvidenceItem): string | null {
  const fromLabel = evidence.label.match(/→\s*([\w.-]+)/)?.[1];
  const fromValue = evidence.value.match(/Primary host:\s*([\w.-]+)/i)?.[1];
  const id = (fromLabel ?? fromValue)?.toLowerCase();
  if (!id || id === 'unknown') return null;
  return HOST_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function plainLabel(label: string): string {
  return salesLanguage(label);
}
