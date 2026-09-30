import type { EvidenceItem, Research } from '@/lib/types';

/**
 * "Never invent facts" is enforced here in code, not only in the prompt.
 *
 * - Research items must cite a URL that a tool call actually returned.
 * - Qualification/draft claims must cite ids that exist in the ledger.
 * - Numbers in the email must appear somewhere in the ledger.
 */

export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    return `${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase();
  } catch {
    return u.trim().toLowerCase();
  }
}

/** Drop research items whose sourceUrl wasn't returned by a tool call. */
export function groundResearch(
  research: Research,
  retrievedUrls: Iterable<string>
): { research: Research; dropped: string[] } {
  const seen = new Set([...retrievedUrls].map(normalizeUrl));
  const ok = (u: string | null) => !!u && seen.has(normalizeUrl(u));
  const dropped: string[] = [];
  const keep = <T extends { text: string; sourceUrl: string }>(items: T[]) =>
    items.filter((i) => (ok(i.sourceUrl) ? true : (dropped.push(i.text), false)));

  const summaryOk = ok(research.summary.sourceUrl);
  if (!summaryOk) dropped.push(research.summary.text);

  const buyerSourced = ok(research.likelyBuyer.sourceUrl);
  if (research.likelyBuyer.name && !buyerSourced) {
    dropped.push(`Buyer name "${research.likelyBuyer.name}"`);
  }

  return {
    research: {
      ...research,
      summary: summaryOk ? research.summary : { text: '', sourceUrl: '' },
      sizeSignals: keep(research.sizeSignals),
      news: keep(research.news),
      whyNow: keep(research.whyNow),
      likelyBuyer: {
        ...research.likelyBuyer,
        name: buyerSourced ? research.likelyBuyer.name : null,
        sourceUrl: buyerSourced ? research.likelyBuyer.sourceUrl : null
      }
    },
    dropped
  };
}

export function researchEvidence(r: Research): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  if (r.summary.text) {
    items.push({ id: 'research.summary', source: 'research', label: `About ${r.companyName}`, value: r.summary.text, url: r.summary.sourceUrl });
  }
  r.sizeSignals.forEach((s, i) =>
    items.push({ id: `research.size.${i}`, source: 'research', label: 'Size / funding signal', value: s.text, url: s.sourceUrl })
  );
  r.news.forEach((s, i) =>
    items.push({ id: `research.news.${i}`, source: 'research', label: `News${s.date ? ` (${s.date})` : ''}`, value: s.text, url: s.sourceUrl })
  );
  r.whyNow.forEach((s, i) =>
    items.push({ id: `research.whynow.${i}`, source: 'research', label: 'Why now', value: s.text, url: s.sourceUrl })
  );
  if (r.likelyBuyer.name && r.likelyBuyer.sourceUrl) {
    items.push({ id: 'research.buyer', source: 'research', label: 'Likely buyer', value: `${r.likelyBuyer.name}, ${r.likelyBuyer.role}`, url: r.likelyBuyer.sourceUrl });
  } else {
    items.push({ id: 'research.buyer', source: 'research', label: 'Likely buyer (role only, inferred)', value: r.likelyBuyer.role });
  }
  return items;
}

/**
 * Models often echo the prompt's "[id]" formatting back as the citation.
 * Normalize before checking so valid citations aren't rejected.
 */
export const normalizeId = (id: string) => id.trim().replace(/^\[+|\]+$/g, '').trim();

export function normalizeCitations<T extends { citations: string[] }>(c: T): T {
  return { ...c, citations: [...new Set(c.citations.map(normalizeId))] };
}

/** Which of these citation ids don't exist in the ledger? */
export function unknownCitations(ids: string[], ledger: EvidenceItem[]): string[] {
  const known = new Set(ledger.map((e) => e.id));
  return [...new Set(ids.filter((id) => !known.has(id)))];
}

/** Keep only citations that exist; drop claims left with none. */
export function pruneClaims<T extends { citations: string[] }>(claims: T[], ledger: EvidenceItem[]) {
  const known = new Set(ledger.map((e) => e.id));
  return claims
    .map((c) => ({ ...c, citations: c.citations.filter((id) => known.has(id)) }))
    .filter((c) => c.citations.length > 0);
}

/**
 * Numbers in generated text that don't appear anywhere in the ledger.
 * Handles ms ↔ s conversions ("2,340 ms" ≈ "2.3s"). Years and small
 * integers (≤ 31, e.g. "20-minute call") are ignored.
 */
export function unverifiedNumbers(text: string, ledger: EvidenceItem[]): string[] {
  const ledgerNums = ledger.flatMap((e) =>
    [...`${e.label} ${e.value}`.matchAll(/\d[\d,]*(\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, '')))
  );
  const matches = (n: number) =>
    ledgerNums.some(
      (l) =>
        Math.abs(l - n) <= Math.max(0.01, Math.abs(l) * 0.05) || // same unit
        Math.abs(l / 1000 - n) <= 0.05 || // ms → s
        Math.abs(l * 1000 - n) <= 50 // s → ms
    );

  const out: string[] = [];
  for (const m of text.matchAll(/\d[\d,]*(\.\d+)?\s*(ms|s|%|k|m|x)?\b/gi)) {
    const n = Number(m[0].replace(/[^\d.]/g, ''));
    const isYear = n >= 1990 && n <= 2100 && !m[2];
    if (isYear || (Number.isInteger(n) && n <= 31 && !m[2])) continue;
    if (!matches(n)) out.push(m[0].trim());
  }
  return [...new Set(out)];
}

export function formatLedger(ledger: EvidenceItem[]): string {
  return ledger
    .map((e) => `[${e.id}] ${e.label}: ${e.value}${e.url ? ` (source: ${e.url})` : ''}`)
    .join('\n');
}
