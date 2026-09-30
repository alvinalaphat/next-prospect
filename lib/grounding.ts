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

/**
 * Drop research items whose sourceUrl wasn't returned by a tool call.
 * `retrieved` maps each URL a tool returned to the text we showed the model,
 * so people can be checked against what the page actually said.
 */
export function groundResearch(
  research: Research,
  retrieved: Map<string, string>,
  domain: string
): { research: Research; dropped: string[] } {
  const content = new Map([...retrieved].map(([u, t]) => [normalizeUrl(u), t]));
  const ok = (u: string | null | undefined) => !!u && content.has(normalizeUrl(u));
  const dropped: string[] = [];
  const keep = <T extends { text: string; sourceUrl: string }>(items: T[]) =>
    items.filter((i) => (ok(i.sourceUrl) ? true : (dropped.push(i.text), false)));

  const summaryOk = ok(research.summary.sourceUrl);
  if (!summaryOk) dropped.push(research.summary.text);

  // A person is kept only if a retrieved page (their LinkedIn result or the
  // cited source) actually contains their name.
  const namedOn = (name: string, ...urls: (string | null | undefined)[]) =>
    urls.some((u) => ok(u) && mentions(content.get(normalizeUrl(u!)) ?? '', name));
  const isLinkedIn = (u: string | null | undefined) => !!u && /linkedin\.com\/in\//i.test(u);

  const b = research.likelyBuyer;
  const buyerOk = !!b.name && namedOn(b.name, b.linkedinUrl, b.sourceUrl);
  if (b.name && !buyerOk) dropped.push(`Stakeholder "${b.name}" (not found on a retrieved page)`);
  const linkedinOk = buyerOk && isLinkedIn(b.linkedinUrl) && ok(b.linkedinUrl);

  const alternates = b.alternates
    .filter((a) => {
      const good = namedOn(a.name, a.linkedinUrl);
      if (!good) dropped.push(`Alternate "${a.name}"`);
      return good;
    })
    .map((a) => ({ ...a, linkedinUrl: isLinkedIn(a.linkedinUrl) ? a.linkedinUrl : null }))
    .slice(0, 2);

  const likelyBuyer = {
    ...b,
    name: buyerOk ? b.name : null,
    title: buyerOk ? b.title : null,
    linkedinUrl: linkedinOk ? b.linkedinUrl : null,
    sourceUrl: buyerOk ? (ok(b.sourceUrl) ? b.sourceUrl : linkedinOk ? b.linkedinUrl : null) : null,
    alternates
  };

  return {
    research: {
      ...research,
      summary: summaryOk ? research.summary : { text: '', sourceUrl: '' },
      sizeSignals: keep(research.sizeSignals),
      news: keep(research.news),
      whyNow: keep(research.whyNow),
      likelyBuyer,
      buyerEmail: likelyBuyer.name ? findPublishedEmail(likelyBuyer.name, domain, retrieved) : null
    },
    dropped
  };
}

/** Case-insensitive check that a page mentions a person (full name, or every name part). */
function mentions(text: string, name: string): boolean {
  const t = text.toLowerCase();
  const n = name.toLowerCase().trim();
  if (t.includes(n)) return true;
  const parts = n.split(/\s+/).filter((p) => p.length >= 3);
  return parts.length >= 2 && parts.every((p) => t.includes(p));
}

/**
 * An email address that appears verbatim on a retrieved page, at the
 * company's domain, whose local part matches the person's name. We never
 * guess addresses from patterns.
 */
export function findPublishedEmail(
  name: string,
  domain: string,
  retrieved: Map<string, string>
): { address: string; sourceUrl: string } | null {
  const root = domain.replace(/^www\./, '').toLowerCase();
  const parts = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter((p) => p.length >= 3);
  for (const [url, text] of retrieved) {
    for (const m of text.matchAll(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const address = m[0].toLowerCase();
      const host = m[1].toLowerCase();
      const local = address.split('@')[0];
      if ((host === root || host.endsWith(`.${root}`)) && parts.some((p) => local.includes(p))) {
        return { address, sourceUrl: url };
      }
    }
  }
  return null;
}

/** First name for the greeting, only when the stakeholder is grounded. */
export function stakeholderFirstName(r: Research | null | undefined): string | null {
  const name = r?.likelyBuyer?.name?.trim();
  if (!name) return null;
  const first = name.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '');
  return first.length >= 2 ? first : null;
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
  const b = r.likelyBuyer;
  if (b.name) {
    items.push({
      id: 'research.buyer',
      source: 'research',
      label: 'Key stakeholder',
      value: `${b.name}${b.title ? `, ${b.title}` : ''}`,
      url: b.linkedinUrl ?? b.sourceUrl ?? undefined
    });
  } else {
    items.push({ id: 'research.buyer', source: 'research', label: 'Target role (no named person found)', value: b.role });
  }
  if (r.buyerEmail) {
    items.push({ id: 'research.buyer.email', source: 'research', label: 'Published email', value: r.buyerEmail.address, url: r.buyerEmail.sourceUrl });
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
