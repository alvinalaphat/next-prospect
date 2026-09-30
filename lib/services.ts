import { generateText, isStepCount, Output, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { exa } from '@/lib/exa';
import {
  formatLedger,
  groundResearch,
  normalizeCitations,
  normalizeId,
  pruneClaims,
  unknownCitations,
  unverifiedNumbers
} from '@/lib/grounding';
import { DRAFT_INSTRUCTIONS, QUALIFY_INSTRUCTIONS, RESEARCH_INSTRUCTIONS } from '@/lib/prompts';
import {
  type Detection,
  type Draft,
  draftSchema,
  type EvidenceItem,
  type Qualification,
  qualificationSchema,
  type Research,
  researchSchema
} from '@/lib/types';

/** Any AI Gateway model id; lead-agent's default. */
export const MODEL = process.env.AI_MODEL || 'openai/gpt-5';

/**
 * Low reasoning effort keeps each workflow step well inside a function's
 * max duration; the evidence ledger does the heavy lifting, not deliberation.
 * Ignored by providers that don't support it.
 */
const FAST = { openai: { reasoningEffort: 'low' } } as const;

/**
 * ------------------------------------------------------------
 * Research agent (lead-agent's Agent + Exa tools, with structured output)
 * ------------------------------------------------------------
 */

/** Surface tool failures in function logs (the model only sees a generic error). */
async function logToolErrors<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[research] ${name} failed:`, err instanceof Error ? err.message : err);
    throw err;
  }
}

/**
 * Tools close over `retrieved`, recording every URL they return so
 * groundResearch() can reject citations the agent never actually saw.
 */
function researchTools(retrieved: Set<string>) {
  const search = tool({
    description: 'Search the web. Returns titles, URLs, dates, and relevant highlights.',
    inputSchema: z.object({
      query: z.string().describe('Search query, e.g. "Acme Series B funding"'),
      category: z
        .enum(['company', 'news', 'people', 'financial report', 'publication'])
        .optional()
        .describe('Restrict to a result category'),
      recentOnly: z.boolean().optional().describe('Only results from the last 12 months')
    }),
    execute: async ({ query, category, recentOnly }) => {
      const res = await logToolErrors('search', () => exa().search(query, {
        numResults: 5,
        type: 'auto',
        category,
        startPublishedDate: recentOnly
          ? new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString()
          : undefined,
        contents: { highlights: true }
      }));
      return res.results.map((r) => {
        retrieved.add(r.url);
        return {
          title: r.title,
          url: r.url,
          publishedDate: r.publishedDate ?? null,
          highlights: (r.highlights ?? []).slice(0, 3)
        };
      });
    }
  });

  const fetchUrl = tool({
    description: 'Return the visible text of a public URL (truncated).',
    inputSchema: z.object({
      url: z.string().describe('Absolute URL, including https://')
    }),
    execute: async ({ url }) => {
      const res = await logToolErrors('fetchUrl', () =>
        exa().getContents(url, { text: { maxCharacters: 6_000 } })
      );
      const page = res.results[0];
      if (!page) return { url, error: 'No content' };
      retrieved.add(page.url);
      retrieved.add(url);
      return { url: page.url, title: page.title, text: page.text };
    }
  });

  return { search, fetchUrl };
}

export async function research(
  domain: string,
  detection: Detection
): Promise<{ research: Research; dropped: string[]; retrieved: string[] }> {
  const retrieved = new Set<string>();

  const researchAgent = new ToolLoopAgent({
    model: MODEL,
    instructions: RESEARCH_INSTRUCTIONS,
    tools: researchTools(retrieved),
    output: Output.object({ schema: researchSchema }),
    stopWhen: isStepCount(14),
    providerOptions: FAST
  });

  const { output } = await researchAgent.generate({
    prompt: [
      `Company domain: ${domain}`,
      `Homepage: ${detection.finalUrl ?? `https://${domain}/`}`,
      `Detected: Next.js (${detection.nextjs.router ?? 'unknown'} router), hosted on ${detection.host.primary}${detection.host.cdn ? ` behind ${detection.host.cdn}` : ''}.`
    ].join('\n')
  });

  const grounded = groundResearch(output, retrieved);
  return { ...grounded, retrieved: [...retrieved] };
}

/**
 * ------------------------------------------------------------
 * Qualification (generateText + Output.object, grounded)
 * ------------------------------------------------------------
 */

export async function qualify(
  domain: string,
  ledger: EvidenceItem[]
): Promise<{ qualification: Qualification; warnings: string[] }> {
  const prompt = `Prospect: ${domain}\n\nEVIDENCE LEDGER:\n${formatLedger(ledger)}`;
  const normalize = (q: Qualification): Qualification => ({
    ...q,
    strongestAngle: normalizeCitations(q.strongestAngle),
    claims: q.claims.map(normalizeCitations)
  });
  const cites = (q: Qualification) => [
    ...q.strongestAngle.citations,
    ...q.claims.flatMap((c) => c.citations)
  ];

  let { output } = await generateText({
    model: MODEL,
    providerOptions: FAST,
    system: QUALIFY_INSTRUCTIONS,
    prompt,
    output: Output.object({ schema: qualificationSchema })
  });
  output = normalize(output);

  // One repair pass if the model cited ids that don't exist.
  const bad = unknownCitations(cites(output), ledger);
  if (bad.length) {
    ({ output } = await generateText({
      model: MODEL,
      providerOptions: FAST,
      system: QUALIFY_INSTRUCTIONS,
      prompt: `${prompt}\n\nYour previous answer cited ids that are NOT in the ledger: ${bad.join(', ')}. Redo it using only ledger ids, and remove any claim you can't support.`,
      output: Output.object({ schema: qualificationSchema })
    }));
    output = normalize(output);
  }

  const warnings: string[] = [];
  const stillBad = unknownCitations(cites(output), ledger);
  if (stillBad.length) warnings.push(`Dropped unknown citations: ${stillBad.join(', ')}`);

  const claims = pruneClaims(output.claims, ledger);
  if (claims.length < output.claims.length) {
    warnings.push(`Dropped ${output.claims.length - claims.length} unsupported claim(s)`);
  }
  const [angle] = pruneClaims([output.strongestAngle], ledger);
  if (!angle) warnings.push('Strongest angle has no valid citation');

  return {
    qualification: {
      ...output,
      claims,
      strongestAngle: angle ?? { ...output.strongestAngle, citations: [] }
    },
    warnings
  };
}

/**
 * ------------------------------------------------------------
 * Draft email + rep brief
 * ------------------------------------------------------------
 */

export async function writeDraft(
  domain: string,
  ledger: EvidenceItem[],
  qualification: Qualification
): Promise<Draft> {
  const prompt = [
    `Prospect: ${domain}`,
    `Strongest angle: ${qualification.strongestAngle.label} — ${qualification.strongestAngle.explanation}`,
    `Qualification reasoning: ${qualification.reasoning}`,
    '',
    'EVIDENCE LEDGER:',
    formatLedger(ledger)
  ].join('\n');

  const normalize = (d: z.infer<typeof draftSchema>) => ({
    ...d,
    emailCitations: [...new Set(d.emailCitations.map(normalizeId))],
    talkingPoints: d.talkingPoints.map(normalizeCitations)
  });
  const check = (d: z.infer<typeof draftSchema>) => ({
    bad: unknownCitations([...d.emailCitations, ...d.talkingPoints.flatMap((t) => t.citations)], ledger),
    numbers: unverifiedNumbers(`${d.subject}\n${d.body}`, ledger)
  });

  let { output } = await generateText({
    model: MODEL,
    providerOptions: FAST,
    system: DRAFT_INSTRUCTIONS,
    prompt,
    output: Output.object({ schema: draftSchema })
  });
  output = normalize(output);

  let issues = check(output);
  if (issues.bad.length || issues.numbers.length) {
    ({ output } = await generateText({
      model: MODEL,
      providerOptions: FAST,
      system: DRAFT_INSTRUCTIONS,
      prompt: [
        prompt,
        '',
        'Your previous draft had problems. Fix them:',
        issues.bad.length ? `- Cited ids not in the ledger: ${issues.bad.join(', ')}` : '',
        issues.numbers.length ? `- Numbers not found in the ledger: ${issues.numbers.join(', ')}` : '',
        '',
        `Previous draft:\nSubject: ${output.subject}\n${output.body}`
      ].join('\n'),
      output: Output.object({ schema: draftSchema })
    }));
    output = normalize(output);
    issues = check(output);
  }

  const warnings: string[] = [];
  if (issues.bad.length) warnings.push(`Unknown citations: ${issues.bad.join(', ')}`);
  if (issues.numbers.length) warnings.push(`Numbers not found in evidence: ${issues.numbers.join(', ')}`);
  const words = output.body.split(/\s+/).filter(Boolean).length;
  if (words > 140) warnings.push(`Email is ${words} words (target ≤120)`);

  return {
    ...output,
    emailCitations: output.emailCitations.filter((id) => !issues.bad.includes(id)),
    talkingPoints: output.talkingPoints.map((t) => ({
      ...t,
      citations: t.citations.filter((id) => !issues.bad.includes(id))
    })),
    warnings
  };
}
