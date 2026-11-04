import { createHash } from 'node:crypto';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { exa } from '@/lib/exa';
import { MODEL } from '@/lib/services';
import type { ContactActivity, EvidenceItem, OpportunityContact } from '@/lib/types';

const activityItemSchema = z.object({
    text: z.string(),
    sourceUrl: z.string(),
    sourceType: z.enum(['linkedin-post', 'blog', 'talk', 'podcast', 'github', 'other']),
    relevance: z.string()
});

const activitySelectionsSchema = z.object({
  selections: z.array(z.object({
    opportunityId: z.string(),
    items: z.array(activityItemSchema).max(5)
  })).max(3)
});

export function contactActivityId({
  sourceUrl,
  text,
  relevance
}: Pick<ContactActivity, 'sourceUrl' | 'text' | 'relevance'>): string {
  const receipt = [sourceUrl, text, relevance].join('\0');
  return `research.buyer-activity.${createHash('sha256').update(receipt).digest('hex').slice(0, 20)}`;
}

function normalizeIdentityText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function containsFullName(text: string, name: string): boolean {
  const normalizedName = normalizeIdentityText(name);
  const normalizedText = normalizeIdentityText(text);
  if (!normalizedName || !normalizedText) return false;
  return ` ${normalizedText} `.includes(` ${normalizedName} `);
}

export async function researchContactActivities({
  contact,
  companyName,
  domain,
  opportunities
}: {
  contact: OpportunityContact;
  companyName: string;
  domain: string;
  opportunities: { opportunityId: string; productName: string; angle: string }[];
}): Promise<Map<string, ContactActivity[]>> {
  if (!contact.name) return new Map();
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1_000).toISOString();
  const queries = [
    `"${contact.name}" "${companyName}"`,
    `site:linkedin.com/posts "${contact.name}" "${companyName}"`,
    `"${contact.name}" ${domain} engineering blog OR podcast OR conference`
  ];
  const responses = await Promise.all(queries.map((query) => exa().search(query, {
    numResults: 6,
    type: 'auto',
    startPublishedDate: since,
    contents: { highlights: true }
  })));
  const retrieved = new Map<string, {
    title: string;
    author: string | null;
    publishedDate: string | null;
    highlights: string[];
  }>();
  for (const result of responses.flatMap((response) => response.results)) {
    if (retrieved.has(result.url)) continue;
    retrieved.set(result.url, {
      title: result.title ?? '',
      author: result.author ?? null,
      publishedDate: result.publishedDate ?? null,
      highlights: (result.highlights ?? []).slice(0, 4)
    });
  }
  const attributable = [...retrieved.entries()].filter(([, result]) => {
    const text = [result.title, result.author, ...result.highlights].filter(Boolean).join(' ');
    return containsFullName(text, contact.name!);
  });
  if (!attributable.length) return new Map();

  const { output } = await generateText({
    model: MODEL,
    providerOptions: { openai: { reasoningEffort: 'low' } },
    system: [
      'Select public activity authored by or directly featuring the named person.',
      'Use only supplied URLs and text. Do not infer company plans from personal opinions.',
      'Choose separately for each supplied opportunity and prefer activity relevant to that product angle.',
      'Do not call an item recent without a supplied publication date.'
    ].join(' '),
    prompt: [
      `Person: ${contact.name}`,
      `Company: ${companyName} (${domain})`,
      `OPPORTUNITIES: ${JSON.stringify(opportunities)}`,
      'ATTRIBUTABLE RESULTS:',
      JSON.stringify(attributable.map(([url, result]) => ({ url, ...result })))
    ].join('\n'),
    output: Output.object({ schema: activitySelectionsSchema })
  });
  const allowedSources = new Map(attributable);
  const requested = new Set(opportunities.map((opportunity) => opportunity.opportunityId));
  const selections = new Map<string, ContactActivity[]>();
  for (const selection of output.selections) {
    if (!requested.has(selection.opportunityId) || selections.has(selection.opportunityId)) continue;
    selections.set(selection.opportunityId, selection.items
      .filter((item) => allowedSources.has(item.sourceUrl))
      .map((item) => ({
        id: contactActivityId(item),
        personName: contact.name!,
        ...item,
        publishedAt: allowedSources.get(item.sourceUrl)?.publishedDate ?? null
      })));
  }
  return selections;
}

export function contactActivityEvidence(activity: ContactActivity[]): EvidenceItem[] {
  return activity.map((item) => ({
    id: item.id,
    source: 'research',
    label: `Buyer activity${item.publishedAt ? ` (${item.publishedAt})` : ''}`,
    value: item.text,
    url: item.sourceUrl,
    observedAt: item.publishedAt
  }));
}
