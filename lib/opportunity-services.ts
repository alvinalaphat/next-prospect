import { generateText, Output } from 'ai';
import { z } from 'zod';
import { EMEA_TRUST_NOTE, getProduct, productIndexForPrompt } from '@/lib/catalog/products';
import { containsFullName } from '@/lib/contact-activity';
import { exa } from '@/lib/exa';
import { findPublishedEmail, formatLedger, latestEvidenceDate, normalizeId, unknownCitations, unverifiedNumbers } from '@/lib/grounding';
import { ensureQuestionPunctuation, placeClosingNoteBeforeSignoff, stripEmDashes } from '@/lib/email-text';
import { DRAFT_INSTRUCTIONS } from '@/lib/prompts';
import { configuredRepName, enforceEmailIdentity, MODEL, stripCitationLeaks } from '@/lib/services';
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
  account.credible-growth, account.smb-digital.
- Match at most one shared account rule: choose the highest supported tier.
- account.enterprise-scale requires substantial digital scale, engineering
  footprint, global operations, traffic, or multi-brand complexity.
- account.growth-scale requires mid-market or growth-stage technical scale.
- account.credible-growth requires a smaller product-led company with credible
  growth, hiring, funding, or expansion evidence.
- account.smb-digital requires an SMB with a meaningful digital product,
  commerce, or web workload.
- Traditional small, local, or professional-services firms receive no account
  tier unless evidence supports a meaningful digital product, commerce, or web workload.
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
    const matches: SignalMatch[] = candidate.matches.map((match) => {
      const evidenceIds = [...new Set(match.evidenceIds.map(normalizeId).filter((id) => knownEvidence.has(id)))];
      return {
        ...match,
        evidenceIds,
        observedAt: latestEvidenceDate(evidenceIds, ledger)
      };
    }).filter((match) => match.evidenceIds.length > 0);
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

const contactAssignmentsSchema = z.object({
  assignments: z.array(opportunityContactSchema.omit({ email: true }).extend({
    opportunityId: z.string(),
    sourceUrl: z.string().nullable()
  })).max(3)
});

export type BuyerResearchOpportunity = {
  id: string;
  productId: string;
  angle: string;
  targetRole: string;
};

/** Search once and assign the best grounded buyer to each planned opportunity. */
export async function findOpportunityContacts({
  domain,
  companyName,
  opportunities
}: {
  domain: string;
  companyName: string;
  opportunities: BuyerResearchOpportunity[];
}): Promise<Map<string, OpportunityContact>> {
  const roles = [...new Set(opportunities.flatMap((opportunity) => [
    opportunity.targetRole,
    ...(getProduct(opportunity.productId)?.targetRoles ?? [])
  ]))].slice(0, 12);
  const result = await exa().search(
    `${roles.map((role) => `"${role}"`).join(' OR ')} at "${companyName}"`,
    {
      numResults: 15,
      type: 'auto',
      category: 'people',
      contents: { highlights: true }
    }
  );
  const retrieved = new Map<string, string>();
  const people = result.results.map((person) => {
    const text = [person.title, person.author, ...(person.highlights ?? [])].filter(Boolean).join('\n');
    retrieved.set(person.url, text);
    return { name: person.author ?? null, title: person.title, url: person.url, highlights: person.highlights ?? [] };
  });

  const { output } = await generateText({
    model: MODEL,
    providerOptions: FAST,
    system: [
      'Assign the single best current person to each opportunity.',
      'Only choose named people from the supplied results.',
      'Prefer direct functional ownership over general seniority.',
      'A person may own multiple opportunities. Return null person fields when nobody is sufficiently supported.',
      'Set region only when a supplied result explicitly connects that person to a work location or regional role.',
      'Copy the location label verbatim from that result and cite its URL. Do not infer location from company headquarters or the company having an office there.'
    ].join(' '),
    prompt: [
      `Company: ${companyName} (${domain})`,
      `OPPORTUNITIES:\n${JSON.stringify(opportunities.map((opportunity) => ({
        ...opportunity,
        productName: getProduct(opportunity.productId)?.name ?? opportunity.productId
      })))}`,
      `PEOPLE RESULTS:\n${JSON.stringify(people)}`
    ].join('\n\n'),
    output: Output.object({ schema: contactAssignmentsSchema })
  });

  const requested = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const contacts = new Map<string, OpportunityContact>();
  for (const assignment of output.assignments) {
    const opportunity = requested.get(assignment.opportunityId);
    if (!opportunity || contacts.has(assignment.opportunityId)) continue;
    const pageText = assignment.sourceUrl ? retrieved.get(assignment.sourceUrl) : null;
    const grounded = !!assignment.name && !!pageText && containsFullName(pageText, assignment.name);
    if (!grounded) continue;
    const regionText = assignment.region?.sourceUrl ? retrieved.get(assignment.region.sourceUrl) : null;
    const region = assignment.region && regionText
      && containsFullName(regionText, assignment.name!)
      && containsFullName(regionText, assignment.region.label)
      ? assignment.region
      : null;
    const published = findPublishedEmail(assignment.name!, domain, retrieved);
    const { opportunityId: _opportunityId, ...contact } = assignment;
    contacts.set(assignment.opportunityId, {
      ...contact,
      region,
      email: published?.address ?? null,
      linkedinUrl: assignment.linkedinUrl && /linkedin\.com\/in\//i.test(assignment.linkedinUrl)
        ? assignment.linkedinUrl
        : null
    });
  }
  for (const opportunity of opportunities) {
    if (!contacts.has(opportunity.id)) contacts.set(opportunity.id, {
      name: null,
      title: null,
      linkedinUrl: null,
      email: null,
      sourceUrl: null,
      region: null,
      rationale: `No named person was verified. Target ${opportunity.targetRole}.`
    });
  }
  return contacts;
}

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
  const firstName = contact.name?.split(/\s+/)[0] ?? null;
  const repName = configuredRepName();
  const greeting = `Hi ${firstName ?? 'there'},`;
  const requiredEmeaNote = region?.group === 'emea' ? EMEA_TRUST_NOTE : null;
  const prompt = [
    `Account: ${domain}`,
    `Product: ${product.name}: ${product.summary}`,
    `Angle: ${angle}`,
    `Why now: ${whyNow}`,
    `Why Vercel: ${whyVercel}`,
    `Buyer: ${contact.name ?? 'No verified name'}, ${contact.title ?? 'role unknown'}`,
    `Buyer rationale: ${contact.rationale}`,
    `Greeting: ${greeting}`,
    `Sign off: ${repName}`,
    `Sales motion: ${salesMotion}`,
    `Region: ${region?.group ?? 'unknown'}${region?.label ? ` (${region.label})` : ''}`,
    '',
    `Approved product claims:\n${product.approvedClaims.map((claim) => `- ${claim}`).join('\n') || '- No extra uncited product claims. Use only the product summary.'}`,
    `Prohibited claims:\n${product.prohibitedClaims.map((claim) => `- ${claim}`).join('\n')}`,
    requiredEmeaNote ? `Required EMEA trust note:\n${requiredEmeaNote}` : '',
    '',
    'EVIDENCE LEDGER:',
    formatLedger(evidence)
  ].filter(Boolean).join('\n');

  const generate = async (repair?: string) => (await generateText({
    model: MODEL,
    providerOptions: FAST,
    system: DRAFT_INSTRUCTIONS,
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
  let identity = [
    !output.body.trimStart().startsWith(greeting) ? `Email must begin with exactly: ${greeting}` : '',
    !output.body.trimEnd().endsWith(repName) ? `Email must end with exactly: ${repName}` : ''
  ].filter(Boolean);
  const missingEmeaNote = requiredEmeaNote && !output.body.includes(requiredEmeaNote)
    ? `Email must include this exact closing note after the ask and before the sign-off: ${requiredEmeaNote}`
    : '';
  if (bad.length || numbers.length || identity.length || missingEmeaNote) {
    output = await generate([
      bad.length ? `Unknown evidence ids: ${bad.join(', ')}` : '',
      numbers.length ? `Numbers not present in evidence: ${numbers.join(', ')}` : '',
      missingEmeaNote,
      ...identity
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
    identity = [
      !output.body.trimStart().startsWith(greeting) ? `Email must begin with exactly: ${greeting}` : '',
      !output.body.trimEnd().endsWith(repName) ? `Email must end with exactly: ${repName}` : ''
    ].filter(Boolean);
  }

  const warnings: string[] = [];
  if (!firstName) warnings.push('No verified buyer — used "Hi there," for the greeting');
  if (bad.length) warnings.push(`Unknown citations: ${bad.join(', ')}`);
  if (numbers.length) warnings.push(`Numbers not found in evidence: ${numbers.join(', ')}`);
  if (identity.length) warnings.push(...identity);
  let body = ensureQuestionPunctuation(
    stripEmDashes(enforceEmailIdentity(stripCitationLeaks(output.body), greeting, repName))
  );
  if (requiredEmeaNote) body = placeClosingNoteBeforeSignoff(body, requiredEmeaNote);
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < 70 || words > 110) warnings.push(`Email is ${words} words (target 70–110)`);

  return {
    ...output,
    subject: stripEmDashes(output.subject),
    subjectOptions: output.subjectOptions.map(stripEmDashes),
    body,
    to: contact.name ? { name: contact.name, title: contact.title, email: contact.email, linkedinUrl: contact.linkedinUrl } : null,
    emailCitations: output.emailCitations.filter((id) => !bad.includes(id)),
    talkingPoints: output.talkingPoints.map((point) => ({ ...point, citations: point.citations.map(normalizeId).filter((id) => !bad.includes(id)) })),
    warnings
  };
}
