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
import { getProduct } from '@/lib/catalog/products';
import { stripEmDashes } from '@/lib/email-text';
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

/** Terms a non-specialist buyer won't parse; allowed in rep talking points only. */
const EMAIL_JARGON =
  /\b(CrUX|p75|percentile|LCP|INP|CLS|TTFB|Core Web Vitals|Lighthouse|field data|lab data|ISR|RSC|CDN|edge network|SSR|hydration|rated slow)\b/gi;

/** Configured sender identity. Drafts must never ship a name placeholder. */
export function configuredRepName(): string {
  const name = process.env.REP_NAME?.trim();
  if (!name) throw new Error('REP_NAME is required to draft outreach');
  return name;
}

/** Citations belong in emailCitations, not the prose: remove "[psi.mobile…]", "[ids below]" etc. */
export function stripCitationLeaks(body: string): string {
  return body
    .replace(/\s*\[(?:[a-z]+\.[\w.-]+(?:,\s*)?)+\]/gi, '')
    .replace(/\s*\[(?:ids?|sources?|citations?)[^\]]*\]/gi, '')
    .replace(/[ \t]+\n/g, '\n');
}

/**
 * House style: every paragraph separated by exactly one blank line, so each
 * core sentence stands alone. Models often use single newlines; fix that.
 */
export function formatEmailBody(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Make the verified greeting and configured sender deterministic in the saved draft. */
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
  const product = getProduct('vercel-platform');
  const firstName = stakeholderFirstName(research);
  const repName = configuredRepName();
  const greeting = `Hi ${firstName ?? 'there'},`;
  const prompt = [
    `Prospect: ${domain}`,
    `Product: ${product?.name ?? 'Vercel Platform'}${product?.summary ? `: ${product.summary}` : ''}`,
    `Buyer: ${research?.likelyBuyer.name ?? 'No verified name'}, ${research?.likelyBuyer.title ?? research?.likelyBuyer.role ?? 'role unknown'}`,
    `Buyer rationale: ${research?.likelyBuyer.rationale ?? 'No buyer-specific rationale supplied.'}`,
    `Greeting: ${greeting}`,
    `Sign off: ${repName}`,
    `Strongest angle: ${qualification.strongestAngle.label}. ${qualification.strongestAngle.explanation}`,
    `Qualification reasoning: ${qualification.reasoning}`,
    `Why now: ${research?.whyNow.map((item) => item.text).join('; ') || 'No timely trigger supplied. Use the strongest grounded observation without implying recency.'}`,
    `Region: ${research?.region?.group ?? 'unknown'}${research?.region?.label ? ` (${research.region.label})` : ''}`,
    '',
    `Approved product claims:\n${product?.approvedClaims.map((claim) => `- ${claim}`).join('\n') || '- No extra product claims supplied.'}`,
    `Prohibited claims:\n${product?.prohibitedClaims.map((claim) => `- ${claim}`).join('\n') || '- Do not invent product claims.'}`,
    research?.region?.group === 'emea' ? `EMEA guidance:\n${product?.emeaNotes?.map((note) => `- ${note}`).join('\n') || '- No product-specific privacy claim supplied.'}` : '',
    '',
    'EVIDENCE LEDGER:',
    formatLedger(ledger)
  ].filter(Boolean).join('\n');

  const normalize = (d: z.infer<typeof draftSchema>) => ({
    ...d,
    emailCitations: [...new Set(d.emailCitations.map(normalizeId))],
    talkingPoints: d.talkingPoints.map(normalizeCitations)
  });
  const jargon = (d: z.infer<typeof draftSchema>) => [
    ...new Set(
      [...`${d.subject}\n${d.body}`.matchAll(EMAIL_JARGON)].map((m) => m[0].toLowerCase())
    )
  ];
  const check = (d: z.infer<typeof draftSchema>) => ({
    jargon: jargon(d),
    bad: unknownCitations([...d.emailCitations, ...d.talkingPoints.flatMap((t) => t.citations)], ledger),
    numbers: unverifiedNumbers(`${d.subjectOptions.join('\n')}\n${d.subject}\n${d.body}`, ledger),
    identity: [
      !d.body.trimStart().startsWith(greeting) ? `Email must begin with exactly: ${greeting}` : '',
      !d.body.trimEnd().endsWith(repName) ? `Email must end with exactly: ${repName}` : ''
    ].filter(Boolean)
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
  if (issues.bad.length || issues.numbers.length || issues.jargon.length || issues.identity.length) {
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
        issues.jargon.length ? `- Technical jargon in the email (rewrite in plain English): ${issues.jargon.join(', ')}` : '',
        ...issues.identity.map((issue) => `- ${issue}`),
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
  if (issues.jargon.length) warnings.push(`Jargon in email: ${issues.jargon.join(', ')}`);
  if (issues.identity.length) warnings.push(...issues.identity);
  output = {
    ...output,
    subject: stripEmDashes(output.subject),
    subjectOptions: output.subjectOptions.map(stripEmDashes),
    body: stripEmDashes(enforceEmailIdentity(stripCitationLeaks(output.body), greeting, repName))
  };
  if (!firstName) warnings.push('No verified stakeholder — used "Hi there," for the greeting');

  const b = research?.likelyBuyer;
  const to = b?.name
    ? { name: b.name, title: b.title, email: research?.buyerEmail?.address ?? null, linkedinUrl: b.linkedinUrl }
    : null;

  const words = output.body.split(/\s+/).filter(Boolean).length;
  if (words < 70 || words > 110) warnings.push(`Email is ${words} words (target 70–110)`);

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
