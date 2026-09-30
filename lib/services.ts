import { generateText, isStepCount, Output, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { exa } from '@/lib/exa';
import {
  formatLedger,
  groundResearch,
  normalizeCitations,
  normalizeId,
  stakeholderFirstName,
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
async function logToolErrors<T>(
  name: string,
  state: { authFailed: boolean },
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[research] ${name} failed:`, message);
    if (/invalid api key|unauthorized|401/i.test(message)) state.authFailed = true;
    throw err;
  }
}

/**
 * Tools close over `retrieved` (URL → the text the model was shown) so
 * groundResearch() can reject citations, people and emails the agent never
 * actually saw on a page.
 */
function researchTools(retrieved: Map<string, string>, state: { authFailed: boolean }) {
  const record = (url: string, ...text: (string | null | undefined)[]) =>
    retrieved.set(url, [retrieved.get(url), ...text].filter(Boolean).join('\n'));

  const search = tool({
    description: 'Search the web. Returns titles, URLs, dates, and relevant highlights.',
    inputSchema: z.object({
      query: z.string().describe('Search query, e.g. "Acme Series B funding"'),
      category: z
        .enum(['company', 'news', 'financial report', 'publication'])
        .optional()
        .describe('Restrict to a result category'),
      recentOnly: z.boolean().optional().describe('Only results from the last 12 months')
    }),
    execute: async ({ query, category, recentOnly }) => {
      const res = await logToolErrors('search', state, () =>
        exa().search(query, {
          numResults: 5,
          type: 'auto',
          category,
          startPublishedDate: recentOnly
            ? new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString()
            : undefined,
          contents: { highlights: true }
        })
      );
      return res.results.map((r) => {
        const highlights = (r.highlights ?? []).slice(0, 3);
        record(r.url, r.title, ...highlights);
        return { title: r.title, url: r.url, publishedDate: r.publishedDate ?? null, highlights };
      });
    }
  });

  const findPeople = tool({
    description:
      'Find people at a company by role using a people (LinkedIn) search. Returns names, headlines and linkedin.com/in URLs. Use this to identify the key technical stakeholder.',
    inputSchema: z.object({
      company: z.string().describe('Company name, e.g. "Plaid"'),
      roles: z
        .array(z.string())
        .min(1)
        .max(3)
        .describe('Roles to look for, e.g. ["VP Engineering", "Head of Web Platform", "Director of Frontend Engineering"]')
    }),
    execute: async ({ company, roles }) => {
      const results = await Promise.all(
        roles.map((role) =>
          logToolErrors('findPeople', state, () =>
            exa().search(`${role} at ${company}`, {
              numResults: 5,
              type: 'auto',
              category: 'people',
              contents: { highlights: true }
            })
          )
        )
      );
      const seen = new Set<string>();
      return results
        .flatMap((r) => r.results)
        .filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)))
        .map((r) => {
          const highlights = (r.highlights ?? []).slice(0, 2);
          record(r.url, r.title, r.author, ...highlights);
          return { name: r.author ?? null, headline: r.title, url: r.url, highlights };
        });
    }
  });

  const fetchUrl = tool({
    description: 'Return the visible text of a public URL (truncated).',
    inputSchema: z.object({
      url: z.string().describe('Absolute URL, including https://')
    }),
    execute: async ({ url }) => {
      const res = await logToolErrors('fetchUrl', state, () =>
        exa().getContents(url, { text: { maxCharacters: 6_000 } })
      );
      const page = res.results[0];
      if (!page) return { url, error: 'No content' };
      record(page.url, page.title, page.text);
      if (url !== page.url) record(url, page.title, page.text);
      return { url: page.url, title: page.title, text: page.text };
    }
  });

  return { search, findPeople, fetchUrl };
}

export class ResearchAuthError extends Error {}

export async function research(
  domain: string,
  detection: Detection
): Promise<{ research: Research; dropped: string[]; retrieved: string[] }> {
  const retrieved = new Map<string, string>();
  const state = { authFailed: false };

  const researchAgent = new ToolLoopAgent({
    model: MODEL,
    instructions: RESEARCH_INSTRUCTIONS,
    tools: researchTools(retrieved, state),
    output: Output.object({ schema: researchSchema }),
    // Stop immediately on a bad key instead of burning steps on errors.
    stopWhen: [isStepCount(16), () => state.authFailed],
    providerOptions: FAST
  });

  const authError = () =>
    new ResearchAuthError('Exa rejected EXA_API_KEY (invalid key) — research skipped');

  let output: z.infer<typeof researchSchema>;
  try {
    ({ output } = await researchAgent.generate({
      prompt: [
        `Company domain: ${domain}`,
        `Homepage: ${detection.finalUrl ?? `https://${domain}/`}`,
        `Detected: Next.js (${detection.nextjs.router ?? 'unknown'} router), hosted on ${detection.host.primary}${detection.host.cdn ? ` behind ${detection.host.cdn}` : ''}.`
      ].join('\n')
    }));
  } catch (err) {
    if (state.authFailed) throw authError();
    throw err;
  }
  if (state.authFailed) throw authError();

  const grounded = groundResearch(output, retrieved, domain);
  return { ...grounded, retrieved: [...retrieved.keys()] };
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
  qualification: Qualification,
  research?: Research | null
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
  // Fill the greeting from the verified stakeholder only; otherwise leave the
  // placeholder for the rep.
  const firstName = stakeholderFirstName(research);
  const fill = (t: string) => (firstName ? t.replaceAll('{{first_name}}', firstName) : t);
  output = { ...output, subject: fill(output.subject), body: fill(output.body) };
  if (!firstName) warnings.push('No verified stakeholder — fill in {{first_name}} before sending');

  const b = research?.likelyBuyer;
  const to = b?.name
    ? { name: b.name, title: b.title, email: research?.buyerEmail?.address ?? null, linkedinUrl: b.linkedinUrl }
    : null;

  const words = output.body.split(/\s+/).filter(Boolean).length;
  if (words > 140) warnings.push(`Email is ${words} words (target ≤120)`);

  return {
    ...output,
    to,
    emailCitations: output.emailCitations.filter((id) => !issues.bad.includes(id)),
    talkingPoints: output.talkingPoints.map((t) => ({
      ...t,
      citations: t.citations.filter((id) => !issues.bad.includes(id))
    })),
    warnings
  };
}
