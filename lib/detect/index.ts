import type { Detection, EvidenceItem } from '@/lib/types';
import { fetchHomepage } from './fetch';
import { isPrivateAddress, lookupDns } from './dns';
import { detectNextjs } from './nextjs';
import { detectHost } from './host';

export async function detect(domain: string): Promise<Detection> {
  const dns = await lookupDns(domain);
  const base = { domain, dns, fetchedAt: new Date().toISOString() };

  if (dns.a.some(isPrivateAddress)) {
    return {
      ...base,
      fetchedUrl: null,
      finalUrl: null,
      status: null,
      outcome: 'unreachable',
      error: 'Domain resolves to a private address',
      headers: {},
      nextjs: detectNextjs('', {}),
      host: detectHost({}, dns)
    };
  }

  const page = await fetchHomepage(domain);
  return {
    ...base,
    fetchedUrl: page.fetchedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    outcome: page.outcome,
    error: page.outcome === 'ok' ? undefined : page.error,
    headers: pickHeaders(page.headers),
    // A bot-challenge page isn't the real HTML, so only trust its headers.
    nextjs: detectNextjs(page.outcome === 'ok' ? page.html : '', page.headers),
    host: detectHost(page.headers, dns)
  };
}

/** Keep the headers that matter for evidence; drop cookies and noise. */
function pickHeaders(headers: Record<string, string>): Record<string, string> {
  const drop = new Set(['set-cookie', 'report-to', 'nel', 'content-security-policy', 'permissions-policy']);
  return Object.fromEntries(Object.entries(headers).filter(([k]) => !drop.has(k)));
}

export function detectionEvidence(d: Detection): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const url = d.finalUrl ?? d.fetchedUrl ?? undefined;
  for (const s of d.nextjs.signals) {
    items.push({ id: `detect.nextjs.${s.id}`, source: 'detect', label: s.label, value: s.match, url });
  }
  items.push({
    id: 'detect.nextjs.summary',
    source: 'detect',
    label: 'Next.js detection',
    value: d.nextjs.isNextjs
      ? `Next.js detected (confidence ${d.nextjs.confidence}, router: ${d.nextjs.router})`
      : `Next.js not detected (confidence ${d.nextjs.confidence})`
  });
  for (const s of d.host.signals) {
    items.push({ id: `detect.host.${s.id}`, source: 'detect', label: `${s.label} → ${s.host}`, value: s.match, url });
  }
  items.push({
    id: 'detect.host.summary',
    source: 'detect',
    label: 'Hosting',
    value: `Primary host: ${d.host.primary}${d.host.cdn ? `, CDN in front: ${d.host.cdn}` : ''}`
  });
  return items;
}
