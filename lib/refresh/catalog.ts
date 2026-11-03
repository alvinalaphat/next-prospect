import { generateText, Output } from 'ai';
import { z } from 'zod';
import { PRODUCTS, productIndexForPrompt } from '@/lib/catalog/products';
import { exa } from '@/lib/exa';
import { MODEL } from '@/lib/services';
import type { CatalogAuditResult, CatalogSnapshotItem } from './types';
import { dedupeResults, isAllowedSource, type SearchResult } from './search';

const extractedCatalogSchema = z.object({
  products: z.array(z.object({
    name: z.string(),
    summary: z.string(),
    sourceUrl: z.string(),
    lifecycle: z.enum(['ga', 'beta', 'deprecated', 'unknown']),
    announcedAt: z.string().nullable(),
    catalogProductId: z.string().nullable(),
    possibleChange: z.boolean(),
    notes: z.string()
  })).max(100)
});

const QUERIES = [
  'site:vercel.com/docs Vercel products platform AI compute security observability',
  'site:vercel.com/changelog Vercel product launch generally available beta',
  'site:vercel.com/blog Vercel product announcement platform'
];

async function searchOfficialCatalog(): Promise<SearchResult[]> {
  const pages = await Promise.all(QUERIES.map(async (query) => {
    const response = await exa().search(query, {
      numResults: 20,
      type: 'auto',
      contents: { highlights: true }
    });
    return response.results.map((result) => ({
      title: result.title ?? '',
      url: result.url,
      publishedDate: result.publishedDate ?? null,
      highlights: (result.highlights ?? []).slice(0, 4)
    }));
  }));
  return dedupeResults(pages.flat()).filter((result) => isAllowedSource(result.url, ['vercel.com', 'eve.dev']));
}

export async function refreshCatalogAudit(now = new Date()): Promise<CatalogAuditResult> {
  const sources = await searchOfficialCatalog();
  const knownIds = new Set(PRODUCTS.map((product) => product.id));
  const knownUrls = new Set(sources.map((source) => source.url));
  const { output } = await generateText({
    model: MODEL,
    providerOptions: { openai: { reasoningEffort: 'low' } },
    system: [
      'Audit the current public Vercel product surface using only the supplied official-source results.',
      'Return one item per distinct product or named capability that the sources support.',
      'Map to an existing catalog id only when it is clearly the same offering.',
      'Set possibleChange when an existing name, lifecycle, scope, or positioning may need review.',
      'Do not invent product names, lifecycle states, URLs, or claims.'
    ].join(' '),
    prompt: [
      'CURRENT CATALOG:',
      productIndexForPrompt(),
      '',
      'OFFICIAL SEARCH RESULTS:',
      JSON.stringify(sources)
    ].join('\n'),
    output: Output.object({ schema: extractedCatalogSchema })
  });

  const items: CatalogSnapshotItem[] = output.products
    .filter((item) => knownUrls.has(item.sourceUrl))
    .map((item) => {
      const catalogProductId = item.catalogProductId && knownIds.has(item.catalogProductId)
        ? item.catalogProductId
        : null;
      return {
        name: item.name,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        lifecycle: item.lifecycle,
        announcedAt: item.announcedAt,
        catalogProductId,
        status: catalogProductId ? (item.possibleChange ? 'possible-change' : 'matched') : 'new',
        notes: item.notes
      };
    });
  const matchedProductIds = [...new Set(items.flatMap((item) => item.catalogProductId ? [item.catalogProductId] : []))];

  return {
    checkedAt: now.toISOString(),
    items,
    matchedProductIds,
    notObservedCatalogProductIds: PRODUCTS.map((product) => product.id).filter((id) => !matchedProductIds.includes(id)),
    candidateAdditions: items.filter((item) => item.status === 'new'),
    possibleChanges: items.filter((item) => item.status === 'possible-change')
  };
}
