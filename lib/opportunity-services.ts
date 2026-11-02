import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getProduct, productIndexForPrompt } from '@/lib/catalog/products';
import { exa } from '@/lib/exa';
import { findPublishedEmail, formatLedger, normalizeId, unknownCitations, unverifiedNumbers } from '@/lib/grounding';
import { stripEmDashes } from '@/lib/email-text';
import { formatEmailBody, fillPlaceholders, MODEL, stripCitationLeaks } from '@/lib/services';
import { scoreOpportunity, type SignalMatch } from '@/lib/scoring';
import {
  draftSchema,
  type Draft,
  type EvidenceItem,
  type OpportunityContact,
  opportunityContactSchema,
  type Research
} from '@/lib/types';

const FAST = { openai: { reasoningEffort: 'low' } } as const;

const signalMatchSchema = z.object({
  ruleId: z.string(),
  evidenceIds: z.array(z.string()).min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  observedAt: z.string().nullable(),
  explanation: z.string()
});

const candidateSchema = z.object({
  productId: z.string(),
  angle: z.string(),
  whyNow: z.string(),
  whyVercel: z.string(),
  targetRole: z.string(),
  matches: z.array(signalMatchSchema).min(1)
});

const planSchema = z.object({
  candidates: z.array(candidateSchema).max(8)
});

export type PlannedOpportunity = {
  productId: string;
  productName: string;
  category: NonNullable<ReturnType<typeof getProduct>>['category'];
  salesMotion: 'new_business' | 'expansion';
  angle: string;
  whyNow: string;
  whyVercel: string;
  targetRole: string;
  score: number;
  scoreBreakdown: ReturnType<typeof scoreOpportunity>['breakdown'];
  matchedSignals: ReturnType<typeof scoreOpportunity>['signals'];
  evidenceIds: string[];
};

const ROUTER_INSTRUCTIONS = `
You plan evidence-based outbound opportunities for Vercel.

The product catalog contains every product and some supporting capabilities.
Return only products with can-create-opportunity behavior: never return a
capability that says it rolls up to another product; return its parent instead.

For each candidate:
- Match only signal rule ids shown for that product, plus these shared account
  rules when supported: account.enterprise-scale, account.growth-scale,
  account.credible-growth, account.low-roi.
- Every match must cite evidence ids from the supplied ledger.
- Do not infer private infrastructure, product usage, contracts, or spend.
- One weak keyword is not product fit. Prefer direct public evidence.
- whyNow must be a real timely trigger when one exists; otherwise say that
  timing evidence is limited.
- Return at most 8 plausible candidates. Returning none is valid.
- Avoid overlapping opportunities that would produce essentially the same
  conversation. Products may be distinct when they solve distinct problems.
`.trim();

export async function planOpportunities(
  domain: string,
  ledger: EvidenceItem[],
  usesVercel: boolean
): Promise<{ opportunities: PlannedOpportunity[]; warnings: string[] }> {
  const { output } = await generateText({
    model: MODEL,
    providerOptions: FAST,
    system: ROUTER_INSTRUCTIONS,
    prompt: [
      `Account: ${domain}`,
      `Observed website hosted on Vercel: ${usesVercel ? 'yes' : 'no'}`,
      '',
      'FULL PRODUCT INDEX:',
      productIndexForPrompt(),
      '',
      'EVIDENCE LEDGER:',
      formatLedger(ledger)
    ].join('\n'),
    output: Output.object({ schema: planSchema })
  });

  const warnings: string[] = [];
  const knownEvidence = new Set(ledger.map((item) => item.id));
  const byProduct = new Map<string, PlannedOpportunity>();

  for (const candidate of output.candidates) {
    const product = getProduct(candidate.productId);
    if (!product?.canCreateOpportunity) {
      warnings.push(`Dropped unknown or non-opportunity product: ${candidate.productId}`);
      continue;
    }
    const matches: SignalMatch[] = candidate.matches.map((match) => ({
      ...match,
      evidenceIds: [...new Set(match.evidenceIds.map(normalizeId).filter((id) => knownEvidence.has(id)))]
    })).filter((match) => match.evidenceIds.length > 0);
    const result = scoreOpportunity({ product, matches, usesVercel });
    // Keep every grounded product-fit candidate, even when the evidence is
    // weak. The score communicates confidence; a cutoff would hide the very
    // weak detections a reviewer needs to inspect.
    if (result.suppressedReason) {
      if (result.suppressedReason) warnings.push(`${product.name}: ${result.suppressedReason}`);
      continue;
    }
    const evidenceIds = [...new Set(result.signals.flatMap((signal) => signal.evidenceIds))];
    const planned: PlannedOpportunity = {
      productId: product.id,
      productName: product.name,
      category: product.category,
      salesMotion: usesVercel ? 'expansion' : 'new_business',
      angle: candidate.angle,
      whyNow: candidate.whyNow,
      whyVercel: candidate.whyVercel,
      targetRole: candidate.targetRole,
      score: result.score,
      scoreBreakdown: result.breakdown,
      matchedSignals: result.signals,
      evidenceIds
    };
    const previous = byProduct.get(product.id);
    if (!previous || planned.score > previous.score) byProduct.set(product.id, planned);
  }

  return {
    opportunities: [...byProduct.values()].sort((a, b) => b.score - a.score).slice(0, 3),
    warnings
  };
}

const contactPickSchema = opportunityContactSchema.omit({ email: true }).extend({
  sourceUrl: z.string().nullable()
});

/** Find one grounded person after the product and angle are known. */
export async function findOpportunityContact({
  domain,
  companyName,
  productId,
  angle,
  targetRole
}: {
  domain: string;
  companyName: string;
  productId: string;
  angle: string;
  targetRole: string;
}): Promise<OpportunityContact> {
  const product = getProduct(productId);
  const roles = [...new Set([targetRole, ...(product?.targetRoles ?? [])])].slice(0, 4);
  const results = await Promise.all(
    roles.map((role) =>
      exa().search(`${role} at ${companyName}`, {
        numResults: 5,
        type: 'auto',
        category: 'people',
        contents: { highlights: true }
      })
    )
  );
  const retrieved = new Map<string, string>();
  const people = results.flatMap((result) => result.results).map((result) => {
    const text = [result.title, result.author, ...(result.highlights ?? [])].filter(Boolean).join('\n');
    retrieved.set(result.url, text);
    return { name: result.author ?? null, title: result.title, url: result.url, highlights: result.highlights ?? [] };
  });

  const { output } = await generateText({
    model: MODEL,
    providerOptions: FAST,
    system: 'Choose the single best current person for this opportunity. Only choose a named person from the supplied results. Prefer direct functional ownership over general seniority. Return null fields when nobody is sufficiently supported.',
    prompt: `Company: ${companyName} (${domain})\nProduct: ${product?.name ?? productId}\nAngle: ${angle}\nTarget role: ${targetRole}\n\nPEOPLE RESULTS:\n${JSON.stringify(people)}`,
    output: Output.object({ schema: contactPickSchema })
  });

  const pageText = output.sourceUrl ? retrieved.get(output.sourceUrl) : null;
  const grounded = !!output.name && !!pageText && output.name.toLowerCase().split(/\s+/).filter((p) => p.length > 2).every((part) => pageText.toLowerCase().includes(part));
  if (!grounded) {
    return { name: null, title: null, linkedinUrl: null, email: null, sourceUrl: null, rationale: `No named person was verified. Target ${targetRole}.` };
  }
  const published = findPublishedEmail(output.name!, domain, retrieved);
  return {
    ...output,
    name: output.name,
    email: published?.address ?? null,
    linkedinUrl: output.linkedinUrl && /linkedin\.com\/in\//i.test(output.linkedinUrl) ? output.linkedinUrl : null
  };
}

const OPPORTUNITY_DRAFT_INSTRUCTIONS = `
Draft a concise first-touch outbound email for a Vercel rep.

Structure:
1. The public triggering event or evidence that prompted the message.
2. Why the selected Vercel product is relevant to this person's work.
3. Ask for a short meeting.

Rules:
- 60–120 words, 3–5 short paragraphs, plain text, no bullets.
- Greet with exactly "Hi {{first_name}}," and sign "{{rep_name}}".
- Never use em dashes, hype, fake familiarity, or unsupported promises.
- Use only supplied evidence and approved product claims.
- Every external factual claim must have an id in emailCitations.
- Never expose internal or sensitive information.
- When this is an expansion motion, you may say the inspected website runs on
  Vercel and suggest building on that footprint. Do not claim a contract,
  company-wide standardization, plan, spend, or private product usage.
- For EMEA, use a direct why-you, why-now structure. Mention privacy or
  governance only when explicitly supported.
- Return exactly three talking points for the rep.
`.trim();

export async function writeOpportunityDraft({
  domain,
  productId,
  angle,
  whyNow,
  whyVercel,
  evidence,
  contact,
  salesMotion,
  region
}: {
  domain: string;
  productId: string;
  angle: string;
  whyNow: string;
  whyVercel: string;
  evidence: EvidenceItem[];
  contact: OpportunityContact;
  salesMotion: 'new_business' | 'expansion';
  region: Research['region'] | undefined;
}): Promise<Draft> {
  const product = getProduct(productId);
  if (!product) throw new Error(`Unknown product ${productId}`);
  const prompt = [
    `Account: ${domain}`,
    `Product: ${product.name} — ${product.summary}`,
    `Angle: ${angle}`,
    `Why now: ${whyNow}`,
    `Why Vercel: ${whyVercel}`,
    `Target: ${contact.name ?? 'unverified person'}, ${contact.title ?? 'role unknown'}`,
    `Sales motion: ${salesMotion}`,
    `Region: ${region?.group ?? 'unknown'}${region?.label ? ` (${region.label})` : ''}`,
    salesMotion === 'expansion' ? 'Expansion context: the inspected website is already hosted on Vercel. Use this only when it makes the transition natural.' : '',
    '',
    `Approved product claims:\n${product.approvedClaims.map((claim) => `- ${claim}`).join('\n') || '- No extra uncited product claims. Use only the product summary.'}`,
    `Prohibited claims:\n${product.prohibitedClaims.map((claim) => `- ${claim}`).join('\n')}`,
    region?.group === 'emea' ? `EMEA guidance:\n${product.emeaNotes?.map((note) => `- ${note}`).join('\n')}` : '',
    '',
    'EVIDENCE LEDGER:',
    formatLedger(evidence)
  ].filter(Boolean).join('\n');

  const generate = async (repair?: string) => (await generateText({
    model: MODEL,
    providerOptions: FAST,
    system: OPPORTUNITY_DRAFT_INSTRUCTIONS,
    prompt: repair ? `${prompt}\n\nREPAIR THESE ISSUES:\n${repair}` : prompt,
    output: Output.object({ schema: draftSchema })
  })).output;

  let output = await generate();
  output = {
    ...output,
    emailCitations: [...new Set(output.emailCitations.map(normalizeId))],
    talkingPoints: output.talkingPoints.map((point) => ({
      ...point,
      citations: [...new Set(point.citations.map(normalizeId))]
    }))
  };
  let bad = unknownCitations([...output.emailCitations, ...output.talkingPoints.flatMap((point) => point.citations)], evidence);
  let numbers = unverifiedNumbers(`${output.subjectOptions.join('\n')}\n${output.subject}\n${output.body}`, evidence);
  if (bad.length || numbers.length) {
    output = await generate([
      bad.length ? `Unknown evidence ids: ${bad.join(', ')}` : '',
      numbers.length ? `Numbers not present in evidence: ${numbers.join(', ')}` : ''
    ].filter(Boolean).join('\n'));
    output = {
      ...output,
      emailCitations: [...new Set(output.emailCitations.map(normalizeId))],
      talkingPoints: output.talkingPoints.map((point) => ({
        ...point,
        citations: [...new Set(point.citations.map(normalizeId))]
      }))
    };
    bad = unknownCitations([...output.emailCitations, ...output.talkingPoints.flatMap((point) => point.citations)], evidence);
    numbers = unverifiedNumbers(`${output.subjectOptions.join('\n')}\n${output.subject}\n${output.body}`, evidence);
  }

  const firstName = contact.name?.split(/\s+/)[0] ?? null;
  const warnings: string[] = [];
  if (!firstName) warnings.push('No verified stakeholder — fill in {{first_name}} before sending');
  if (bad.length) warnings.push(`Unknown citations: ${bad.join(', ')}`);
  if (numbers.length) warnings.push(`Numbers not found in evidence: ${numbers.join(', ')}`);
  const body = stripEmDashes(formatEmailBody(fillPlaceholders(stripCitationLeaks(output.body), firstName)));
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words > 120) warnings.push(`Email is ${words} words (target 60–120)`);

  return {
    ...output,
    subject: stripEmDashes(fillPlaceholders(output.subject, firstName)),
    subjectOptions: output.subjectOptions.map((subject) => stripEmDashes(fillPlaceholders(subject, firstName))),
    body,
    to: contact.name ? { name: contact.name, title: contact.title, email: contact.email, linkedinUrl: contact.linkedinUrl } : null,
    emailCitations: output.emailCitations.filter((id) => !bad.includes(id)),
    talkingPoints: output.talkingPoints.map((point) => ({ ...point, citations: point.citations.map(normalizeId).filter((id) => !bad.includes(id)) })),
    warnings
  };
}
