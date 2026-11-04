import { isStepCount, Output, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { exa } from '@/lib/exa';
import { groundResearch, isOfficialVercelCustomerStory } from '@/lib/grounding';
import { RESEARCH_INSTRUCTIONS } from '@/lib/prompts';
import { type Detection, type Research, researchSchema } from '@/lib/types';

export const MODEL = process.env.AI_MODEL || 'openai/gpt-5';
const FAST = { openai: { reasoningEffort: 'low' } } as const;

async function logToolErrors<T>(
  name: string,
  state: { authFailed: boolean },
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[research] ${name} failed:`, message);
    if (/invalid api key|unauthorized|401/i.test(message)) state.authFailed = true;
    throw error;
  }
}

/** Company-only research. Buyer discovery runs after opportunities exist. */
function researchTools(retrieved: Map<string, string>, state: { authFailed: boolean }) {
  const record = (url: string, ...content: (string | null | undefined)[]) =>
    retrieved.set(url, [retrieved.get(url), ...content].filter(Boolean).join('\n'));

  const search = tool({
    description: 'Search the web. Returns titles, URLs, dates, and relevant highlights.',
    inputSchema: z.object({
      query: z.string(),
      category: z.enum(['company', 'news', 'financial report', 'publication']).optional(),
      recentOnly: z.boolean().optional()
    }),
    execute: async ({ query, category, recentOnly }) => {
      const response = await logToolErrors('search', state, () =>
        exa().search(query, {
          numResults: 5,
          type: 'auto',
          category,
          startPublishedDate: recentOnly
            ? new Date(Date.now() - 365 * 24 * 3600 * 1_000).toISOString()
            : undefined,
          contents: { highlights: true }
        })
      );
      return response.results.map((result) => {
        const highlights = (result.highlights ?? []).slice(0, 3);
        record(result.url, result.title, ...highlights);
        return {
          title: result.title,
          url: result.url,
          publishedDate: result.publishedDate ?? null,
          highlights
        };
      });
    }
  });

  const fetchUrl = tool({
    description: 'Return the visible text of a public URL (truncated).',
    inputSchema: z.object({ url: z.string() }),
    execute: async ({ url }) => {
      const response = await logToolErrors('fetchUrl', state, () =>
        exa().getContents(url, { text: { maxCharacters: 6_000 } })
      );
      const page = response.results[0];
      if (!page) return { url, error: 'No content' };
      record(page.url, page.title, page.text);
      if (url !== page.url) record(url, page.title, page.text);
      return { url: page.url, title: page.title, text: page.text };
    }
  });

  const searchVercelCustomerStories = tool({
    description: 'Search only official Vercel customer stories for companies with a similar business model, industry, scale, or technical workload. Use this for supporting precedent, not prospect facts.',
    inputSchema: z.object({
      query: z.string().describe('A similarity-focused query based on what is known about the prospect')
    }),
    execute: async ({ query }) => {
      const response = await logToolErrors('searchVercelCustomerStories', state, () =>
        exa().search(query, {
          numResults: 6,
          type: 'auto',
          includeDomains: ['vercel.com'],
          contents: { highlights: true }
        })
      );
      return response.results.flatMap((result) => {
        if (!isOfficialVercelCustomerStory(result.url)) return [];
        const highlights = (result.highlights ?? []).slice(0, 4);
        record(result.url, result.title, ...highlights);
        return [{
          title: result.title,
          url: result.url,
          publishedDate: result.publishedDate ?? null,
          highlights
        }];
      });
    }
  });

  return { search, fetchUrl, searchVercelCustomerStories };
}

export class ResearchAuthError extends Error {}

export async function research(
  domain: string,
  detection: Detection
): Promise<{ research: Research; dropped: string[]; retrieved: string[] }> {
  const retrieved = new Map<string, string>();
  const state = { authFailed: false };
  const agent = new ToolLoopAgent({
    model: MODEL,
    instructions: RESEARCH_INSTRUCTIONS,
    tools: researchTools(retrieved, state),
    output: Output.object({ schema: researchSchema }),
    stopWhen: [isStepCount(16), () => state.authFailed],
    providerOptions: FAST
  });
  const authError = () =>
    new ResearchAuthError('Exa rejected EXA_API_KEY (invalid key) — research skipped');

  let output: z.infer<typeof researchSchema>;
  try {
    ({ output } = await agent.generate({
      prompt: [
        `Company domain: ${domain}`,
        `Homepage: ${detection.finalUrl ?? `https://${domain}/`}`,
        `Detected: Next.js (${detection.nextjs.router ?? 'unknown'} router), hosted on ${detection.host.primary}${detection.host.cdn ? ` behind ${detection.host.cdn}` : ''}.`
      ].join('\n')
    }));
  } catch (error) {
    if (state.authFailed) throw authError();
    throw error;
  }
  if (state.authFailed) throw authError();

  const grounded = groundResearch(output, retrieved);
  return { ...grounded, retrieved: [...retrieved.keys()] };
}

export function configuredRepName(): string {
  const name = process.env.REP_NAME?.trim();
  if (!name) throw new Error('REP_NAME is required to draft outreach');
  return name;
}

export function stripCitationLeaks(body: string): string {
  return body
    .replace(/\s*\[(?:[a-z]+\.[\w.-]+(?:,\s*)?)+\]/gi, '')
    .replace(/\s*\[(?:ids?|sources?|citations?)[^\]]*\]/gi, '')
    .replace(/[ \t]+\n/g, '\n');
}

export function formatEmailBody(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function enforceEmailIdentity(body: string, greeting: string, repName: string): string {
  const paragraphs = formatEmailBody(body)
    .split('\n\n')
    .map((paragraph) => paragraph.replace(/\{\{[^{}]+\}\}/g, '').trim())
    .filter(Boolean);

  if (/^Hi\b.*,$/i.test(paragraphs[0] ?? '')) paragraphs[0] = greeting;
  else paragraphs.unshift(greeting);

  if (paragraphs.at(-1) !== repName) {
    const last = paragraphs.at(-1) ?? '';
    const looksLikeSignature = /^(?:best|thanks|regards|cheers),?$/i.test(last)
      || /^[\p{Lu}][\p{L}'.-]*(?:\s+[\p{Lu}][\p{L}'.-]*){0,3}$/u.test(last);
    if (looksLikeSignature) paragraphs[paragraphs.length - 1] = repName;
    else paragraphs.push(repName);
  }

  return paragraphs.join('\n\n');
}
