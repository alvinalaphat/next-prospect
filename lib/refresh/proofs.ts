import { createHash } from 'node:crypto';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { PRODUCTS } from '@/lib/catalog/products';
import { exa } from '@/lib/exa';
import { MODEL } from '@/lib/services';
import type { ProofRecord, ProofRefreshResult, ProofUsage, ProofVendor } from './types';
import { dedupeResults, isAllowedSource, type SearchResult } from './search';

const proofExtractionSchema = z.object({
  records: z.array(z.object({
    company: z.string(),
    title: z.string(),
    sourceUrl: z.string(),
    summary: z.string(),
    productIds: z.array(z.string()),
    industries: z.array(z.string()),
    workloads: z.array(z.string()),
    candidateClaims: z.array(z.string()),
    publishedAt: z.string().nullable()
  })).max(40)
});

const SOURCES: Array<{
  vendor: ProofVendor;
  hosts: string[];
  queries: string[];
}> = [
  {
    vendor: 'vercel',
    hosts: ['vercel.com'],
    queries: [
      'site:vercel.com/customers Vercel customer story',
      'site:vercel.com/blog/category/customers Vercel customer'
    ]
  },
  {
    vendor: 'cloudflare',
    hosts: ['cloudflare.com'],
    queries: ['site:cloudflare.com/case-studies customer case study web application platform']
  },
  {
    vendor: 'railway',
    hosts: ['railway.com'],
    queries: ['site:railway.com/customers customer story platform']
  }
];

async function searchVendor(queries: string[], hosts: string[]): Promise<SearchResult[]> {
  const pages = await Promise.all(queries.map(async (query) => {
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
  return dedupeResults(pages.flat()).filter((result) => isAllowedSource(result.url, hosts));
}

function proofId(vendor: ProofVendor, sourceUrl: string): string {
  return `${vendor}-${createHash('sha256').update(sourceUrl).digest('hex').slice(0, 20)}`;
}

async function extractVendorProof(vendor: ProofVendor, sources: SearchResult[], now: Date): Promise<ProofRecord[]> {
  const knownUrls = new Set(sources.map((source) => source.url));
  const knownProductIds = new Set(PRODUCTS.map((product) => product.id));
  const usage: ProofUsage = vendor === 'vercel' ? 'customer-proof' : 'competitive-context';
  const { output } = await generateText({
    model: MODEL,
    providerOptions: { openai: { reasoningEffort: 'low' } },
    system: [
      'Extract genuine customer stories from the supplied search results only.',
      'Exclude generic product pages, category indexes, and pages without a named customer.',
      'Map workloads to the supplied Vercel catalog ids when relevant.',
      vendor === 'vercel'
        ? 'Candidate claims must be conservative paraphrases directly supported by the result highlights; they are not approved for outreach.'
        : 'This is competitor context. Return no candidate claims.'
    ].join(' '),
    prompt: [
      `Vendor: ${vendor}`,
      `Catalog ids: ${[...knownProductIds].join(', ')}`,
      'SEARCH RESULTS:',
      JSON.stringify(sources)
    ].join('\n'),
    output: Output.object({ schema: proofExtractionSchema })
  });

  return output.records
    .filter((record) => knownUrls.has(record.sourceUrl))
    .map((record) => ({
      id: proofId(vendor, record.sourceUrl),
      vendor,
      usage,
      company: record.company,
      title: record.title,
      sourceUrl: record.sourceUrl,
      summary: record.summary,
      productIds: record.productIds.filter((id) => knownProductIds.has(id)),
      industries: [...new Set(record.industries)],
      workloads: [...new Set(record.workloads)],
      candidateClaims: vendor === 'vercel' ? [...new Set(record.candidateClaims)] : [],
      publishedAt: record.publishedAt,
      lastSeenAt: now.toISOString()
    }));
}

export async function refreshProofLibrary(now = new Date()): Promise<{ result: ProofRefreshResult; records: ProofRecord[] }> {
  const records: ProofRecord[] = [];
  for (const source of SOURCES) {
    const results = await searchVendor(source.queries, source.hosts);
    records.push(...await extractVendorProof(source.vendor, results, now));
  }
  const deduped = [...new Map(records.map((record) => [record.sourceUrl, record])).values()];
  const byVendor: Record<ProofVendor, number> = { vercel: 0, cloudflare: 0, railway: 0 };
  for (const record of deduped) byVendor[record.vendor]++;
  return {
    records: deduped,
    result: {
      refreshedAt: now.toISOString(),
      discovered: records.length,
      saved: deduped.length,
      byVendor
    }
  };
}
