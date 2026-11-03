import { createHash } from 'node:crypto';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { exa } from '@/lib/exa';
import { MODEL } from '@/lib/services';
import type { ContactActivity, EvidenceItem, OpportunityContact } from '@/lib/types';

const activitySchema = z.object({
  items: z.array(z.object({
    text: z.string(),
    sourceUrl: z.string(),
    sourceType: z.enum(['linkedin-post', 'blog', 'talk', 'podcast', 'github', 'other']),
    relevance: z.string()
  })).max(5)
});

function activityId(sourceUrl: string): string {
  return `research.buyer-activity.${createHash('sha256').update(sourceUrl).digest('hex').slice(0, 20)}`;
}

export async function researchContactActivity({
  contact,
  companyName,
  domain,
  productName,
  angle
}: {
  contact: OpportunityContact;
  companyName: string;
  domain: string;
  productName: string;
  angle: string;
}): Promise<ContactActivity[]> {
  if (!contact.name) return [];
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1_000).toISOString();
  const queries = [
    `"${contact.name}" "${companyName}" ${productName}`,
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
  const nameParts = contact.name.toLowerCase().split(/\s+/).filter((part) => part.length > 2);
  const attributable = [...retrieved.entries()].filter(([, result]) => {
    const text = [result.title, result.author, ...result.highlights].filter(Boolean).join(' ').toLowerCase();
    return nameParts.every((part) => text.includes(part));
  });
  if (!attributable.length) return [];

  const { output } = await generateText({
    model: MODEL,
    providerOptions: { openai: { reasoningEffort: 'low' } },
    system: [
      'Select public activity authored by or directly featuring the named person.',
      'Use only supplied URLs and text. Do not infer company plans from personal opinions.',
      'Prefer activity relevant to the product angle. Do not call an item recent without a supplied publication date.'
    ].join(' '),
    prompt: [
      `Person: ${contact.name}`,
      `Company: ${companyName} (${domain})`,
      `Product: ${productName}`,
      `Angle: ${angle}`,
      'ATTRIBUTABLE RESULTS:',
      JSON.stringify(attributable.map(([url, result]) => ({ url, ...result })))
    ].join('\n'),
    output: Output.object({ schema: activitySchema })
  });
  const allowedSources = new Map(attributable);
  return output.items
    .filter((item) => allowedSources.has(item.sourceUrl))
    .map((item) => ({
      id: activityId(item.sourceUrl),
      personName: contact.name!,
      ...item,
      publishedAt: allowedSources.get(item.sourceUrl)?.publishedDate ?? null
    }));
}

export function contactActivityEvidence(activity: ContactActivity[]): EvidenceItem[] {
  return activity.map((item) => ({
    id: item.id,
    source: 'research',
    label: `Buyer activity${item.publishedAt ? ` (${item.publishedAt})` : ''}`,
    value: item.text,
    url: item.sourceUrl
  }));
}
