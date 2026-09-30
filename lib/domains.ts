import Papa from 'papaparse';
import { domainSchema } from '@/lib/types';

/**
 * Accepts a CSV (with a "domain"/"website"/"url" column, or domains in the
 * first column) or a newline/comma separated list. Returns unique, valid,
 * normalized domains plus whatever was rejected.
 */
export function parseDomains(input: string): { domains: string[]; invalid: string[] } {
  const { data } = Papa.parse<string[]>(input.trim(), { skipEmptyLines: true });
  const header = (data[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = header.findIndex((h) => ['domain', 'website', 'url', 'domains'].includes(h));
  const rows = col >= 0 ? data.slice(1).map((r) => r[col]) : data.flat();

  const domains = new Set<string>();
  const invalid: string[] = [];
  for (const raw of rows) {
    if (!raw?.trim()) continue;
    const parsed = domainSchema.safeParse(raw);
    if (parsed.success) domains.add(parsed.data.replace(/^www\./, ''));
    else invalid.push(raw.trim());
  }
  return { domains: [...domains], invalid };
}
