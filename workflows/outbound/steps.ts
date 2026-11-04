import { FatalError, getStepMetadata, RetryableError } from 'workflow';
import { detect, detectionEvidence } from '@/lib/detect';
import {
  claimFreshProspectRun,
  clearIncompleteOpportunityPlanning,
  getOpportunities,
  getOpportunity,
  getProspect,
  insertOpportunity,
  updateOpportunityForRun,
  updateProspectForRun
} from '@/lib/db';
import { researchEvidence } from '@/lib/grounding';
import { findOpportunityContacts, planOpportunities, writeOpportunityDraft } from '@/lib/opportunity-services';
import { contactActivityEvidence, researchContactActivities } from '@/lib/contact-activity';
import { emptyPerfResult, perfEvidence, PsiRateLimitError, runPsi } from '@/lib/psi';
import { scoreOpportunity } from '@/lib/scoring';
import { getProduct } from '@/lib/catalog/products';
import { research, ResearchAuthError } from '@/lib/services';
import { postOpportunityApprovalRequest } from '@/lib/slack';
import type { ContactActivity, Detection, EvidenceItem, OpportunityContact, Perf, Research } from '@/lib/types';

/**
 * step: detect Next.js + hosting from one polite homepage fetch
 */
export const stepDetect = async (domain: string, runId: string) => {
  'use step';

  if (!(await claimFreshProspectRun(domain, runId))) {
    return { detection: null, evidence: [] as EvidenceItem[], stop: true as const };
  }
  const detection = await detect(domain);
  const evidence = detectionEvidence(detection);

  // Eligibility is evaluated per product. Being on Vercel or not using
  // Next.js can suppress a hosting motion, but must not eliminate AI,
  // observability, security, or other product opportunities.
  const active = await updateProspectForRun(domain, runId, {
    status: 'measuring',
    detection,
    evidence,
    host: detection.host.primary,
    nextjsConfidence: Math.round(detection.nextjs.confidence * 100)
  });

  if (!active) return { detection: null, evidence: [] as EvidenceItem[], stop: true as const };
  return { detection, evidence, stop: false as const };
};

/**
 * step: PageSpeed Insights, mobile + desktop (cached 24h)
 */
export const stepPerf = async (domain: string, runId: string, detection: Detection) => {
  'use step';

  const url = detection.finalUrl ?? `https://${domain}/`;
  if (!process.env.PSI_API_KEY) {
    const perf: Perf = {
      mobile: emptyPerfResult('mobile', 'PSI_API_KEY not set — performance measurement skipped'),
      desktop: emptyPerfResult('desktop', 'PSI_API_KEY not set — performance measurement skipped')
    };
    await updateProspectForRun(domain, runId, { status: 'researching', perf, perfScore: null });
    return { perf, evidence: [] as EvidenceItem[] };
  }
  const { attempt } = getStepMetadata();
  let perf: Perf;
  try {
    const [mobile, desktop] = await Promise.all([runPsi(url, 'mobile'), runPsi(url, 'desktop')]);
    perf = { mobile, desktop };
  } catch (err) {
    if (!(err instanceof PsiRateLimitError)) throw err;
    // Back off on quota errors; after the last retry, continue without perf
    // data rather than failing the whole prospect.
    if (attempt <= stepPerf.maxRetries) {
      throw new RetryableError(err.message, { retryAfter: `${attempt}m` });
    }
    perf = {
      mobile: emptyPerfResult('mobile', 'PSI quota exhausted — set PSI_API_KEY'),
      desktop: emptyPerfResult('desktop', 'PSI quota exhausted — set PSI_API_KEY')
    };
  }

  await updateProspectForRun(domain, runId, { status: 'researching', perf, perfScore: perf.mobile.score });
  return { perf, evidence: perfEvidence(perf, url) };
};
stepPerf.maxRetries = 4;

/**
 * step: research agent (Exa), grounded to retrieved URLs
 */
export const stepResearch = async (domain: string, runId: string, detection: Detection) => {
  'use step';

  if (!process.env.EXA_API_KEY) {
    await updateProspectForRun(domain, runId, { status: 'qualifying' });
    return { research: null, evidence: [] as EvidenceItem[], dropped: [] as string[], warning: 'EXA_API_KEY not set — research skipped' };
  }

  try {
    const result = await research(domain, detection);
    await updateProspectForRun(domain, runId, { status: 'qualifying', research: result.research });
    return { research: result.research, evidence: researchEvidence(result.research), dropped: result.dropped, warning: null };
  } catch (err) {
    // A bad key won't fix itself on retry: continue without research, loudly.
    if (!(err instanceof ResearchAuthError)) throw err;
    await updateProspectForRun(domain, runId, { status: 'qualifying' });
    return { research: null, evidence: [] as EvidenceItem[], dropped: [] as string[], warning: err.message };
  }
};

/**
 * step: mark a run as failed so it shows up on the dashboard
 */
export const stepFail = async (domain: string, runId: string, message: string) => {
  'use step';

  await updateProspectForRun(domain, runId, { status: 'error', error: message.slice(0, 500) });
};

/** Plan and persist up to three product-specific opportunities. */
export const stepPlanOpportunities = async (
  domain: string,
  runId: string,
  evidence: EvidenceItem[]
) => {
  'use step';

  const existing = await getProspect(domain);
  if (existing?.runId === runId && existing.planningComplete) {
    return (await getOpportunities(domain, runId)).map((opportunity) => opportunity.id);
  }
  if (!(await clearIncompleteOpportunityPlanning(domain, runId))) return [];
  if (!(await updateProspectForRun(domain, runId, { status: 'qualifying', evidence }))) return [];
  const prospect = await getProspect(domain);
  if (!prospect?.detection) throw new FatalError(`Prospect ${domain} is missing detection`);
  const usesVercel = prospect.detection.host.primary === 'vercel';
  const { opportunities } = await planOpportunities(domain, evidence, usesVercel);
  if (!(await isProspectRunCurrent(domain, runId))) return [];

  const rows = [];
  for (const opportunity of opportunities) {
    if (!(await isProspectRunCurrent(domain, runId))) break;
    rows.push(
      await insertOpportunity({
        id: crypto.randomUUID(),
        domain,
        runId,
        productId: opportunity.productId,
        productName: opportunity.productName,
        category: opportunity.category,
        salesMotion: opportunity.salesMotion,
        status: 'candidate',
        angle: opportunity.angle,
        whyNow: opportunity.whyNow,
        whyVercel: opportunity.whyVercel,
        targetRole: opportunity.targetRole,
        score: opportunity.score,
        scoreBreakdown: opportunity.scoreBreakdown,
        matchedSignals: opportunity.matchedSignals,
        evidenceIds: opportunity.evidenceIds
      })
    );
  }

  const top = rows[0];
  await updateProspectForRun(domain, runId, {
    status: rows.length ? 'researching' : 'disqualified',
    fitScore: top?.score ?? 0,
    angle: top?.angle ?? null,
    planningComplete: true,
    // Candidate-level suppression is expected planner behavior, not an
    // account failure. Keep the error field reserved for stepFail so the UI
    // never renders discarded product ideas as fatal errors.
    error: null
  });
  return rows.map((row) => row.id);
};

export type OpportunityBuyerResearch = {
  opportunityId: string;
  contact: OpportunityContact;
  activity: ContactActivity[];
};

/** Search people once, then research activity once per unique selected buyer. */
export const stepResearchOpportunityBuyers = async (
  domain: string,
  runId: string,
  opportunityIds: string[],
  researchResult: Research | null
): Promise<OpportunityBuyerResearch[]> => {
  'use step';

  if (!(await isProspectRunCurrent(domain, runId))) return [];
  const rows = (await Promise.all(opportunityIds.map((id) => getOpportunity(id))))
    .filter((row) => row?.runId === runId);
  const fallback = (targetRole: string): OpportunityContact => ({
    name: null,
    title: null,
    linkedinUrl: null,
    email: null,
    sourceUrl: null,
    rationale: `No named person was verified. Target ${targetRole}.`
  });
  if (!process.env.EXA_API_KEY) {
    return rows.map((row) => ({
      opportunityId: row.id,
      contact: fallback(row.targetRole),
      activity: []
    }));
  }

  const contacts = await findOpportunityContacts({
    domain,
    companyName: researchResult?.companyName ?? domain,
    opportunities: rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      angle: row.angle,
      targetRole: row.targetRole
    }))
  });
  const activityByOpportunity = new Map<string, ContactActivity[]>();
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const contact = contacts.get(row.id) ?? fallback(row.targetRole);
    if (!contact.name) continue;
    const key = contact.name.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  await Promise.all([...groups.values()].map(async (group) => {
    const contact = contacts.get(group[0].id)!;
    const activities = await researchContactActivities({
      contact,
      companyName: researchResult?.companyName ?? domain,
      domain,
      opportunities: group.map((row) => ({
        opportunityId: row.id,
        productName: row.productName,
        angle: row.angle
      }))
    });
    for (const row of group) activityByOpportunity.set(row.id, activities.get(row.id) ?? []);
  }));

  return rows.map((row) => ({
    opportunityId: row.id,
    contact: contacts.get(row.id) ?? fallback(row.targetRole),
    activity: activityByOpportunity.get(row.id) ?? []
  }));
};

/** Persist buyer research, finalize the score, and draft outreach. */
export const stepEnrichOpportunity = async (
  opportunityId: string,
  evidence: EvidenceItem[],
  researchResult: Research | null,
  buyerResearch: OpportunityBuyerResearch
) => {
  'use step';

  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) throw new FatalError(`Opportunity ${opportunityId} is missing`);
  if (!(await updateProspectForRun(opportunity.domain, opportunity.runId, { status: 'drafting' }))) {
    return { opportunityId, score: opportunity.score };
  }
  if (!(await updateOpportunityForRun(opportunityId, { status: 'researching_contact' }))) {
    return { opportunityId, score: opportunity.score };
  }

  const contact = buyerResearch.contact;

  const product = getProduct(opportunity.productId);
  if (!product) throw new FatalError(`Unknown product ${opportunity.productId}`);
  const activity = buyerResearch.activity;
  const activityEvidence = contactActivityEvidence(activity);
  const rescored = scoreOpportunity({
    product,
    matches: opportunity.matchedSignals,
    usesVercel: opportunity.salesMotion === 'expansion',
    buyerQuality: contact.name ? 15 : 5
  });
  const selectedEvidence = evidence.filter((item) => opportunity.evidenceIds.includes(item.id));
  selectedEvidence.push(...activityEvidence);

  if (!(await isProspectRunCurrent(opportunity.domain, opportunity.runId))) {
    return { opportunityId, score: rescored.score };
  }

  if (!(await updateOpportunityForRun(opportunityId, {
    status: 'drafting',
    contact,
    contactActivity: activity,
    score: rescored.score,
    scoreBreakdown: rescored.breakdown,
    matchedSignals: rescored.signals
  }))) return { opportunityId, score: rescored.score };
  const draft = await writeOpportunityDraft({
    domain: opportunity.domain,
    productId: opportunity.productId,
    angle: opportunity.angle,
    whyNow: opportunity.whyNow,
    whyVercel: opportunity.whyVercel,
    evidence: selectedEvidence,
    contact,
    salesMotion: opportunity.salesMotion,
    region: researchResult?.region
  });
  if (!(await isProspectRunCurrent(opportunity.domain, opportunity.runId))) {
    return { opportunityId, score: rescored.score };
  }
  await updateOpportunityForRun(opportunityId, { draft });
  return { opportunityId, score: rescored.score };
};

/** Ask for a separate decision on each opportunity. */
export const stepRequestOpportunityApproval = async (
  opportunityId: string,
  token: string
) => {
  'use step';

  const current = await getOpportunity(opportunityId);
  if (!current) throw new FatalError(`Opportunity ${opportunityId} is missing`);
  if (current.status === 'approved' || current.status === 'rejected' || current.slack) {
    return current.slack;
  }
  const opportunity = await updateOpportunityForRun(opportunityId, {
    status: 'awaiting_approval',
    approvalToken: token
  });
  if (!opportunity) return;
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) return;
  if (!(await isProspectRunCurrent(opportunity.domain, opportunity.runId))) return;
  const prospect = await getProspect(opportunity.domain);
  if (!prospect) throw new FatalError(`Prospect ${opportunity.domain} is missing`);
  const slack = await postOpportunityApprovalRequest(prospect, opportunity, token);
  await updateOpportunityForRun(opportunityId, { slack });
  return slack;
};

/** Derive the account summary from every planned opportunity after recovery. */
export const stepFinishOpportunityPlanning = async (domain: string, runId: string) => {
  'use step';

  const opportunities = await getOpportunities(domain, runId);
  const allDecided = opportunities.length > 0 && opportunities.every(
    (opportunity) => opportunity.status === 'approved' || opportunity.status === 'rejected'
  );
  if (allDecided) {
    const status = opportunities.some((opportunity) => opportunity.status === 'approved')
      ? 'approved'
      : 'rejected';
    await updateProspectForRun(
      domain,
      runId,
      { status },
      ['qualifying', 'researching', 'drafting', 'awaiting_approval']
    );
    return status;
  }
  await updateProspectForRun(
    domain,
    runId,
    { status: 'awaiting_approval' },
    ['qualifying', 'researching', 'drafting']
  );
  return 'awaiting_approval' as const;
};

async function isProspectRunCurrent(domain: string, runId: string) {
  const prospect = await getProspect(domain);
  return prospect?.runId === runId;
}
