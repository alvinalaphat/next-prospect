import { FatalError, getStepMetadata, RetryableError } from 'workflow';
import { detect, detectionEvidence } from '@/lib/detect';
import { getProspect, upsertProspect } from '@/lib/db';
import { getOpportunity, insertOpportunity, updateOpportunity } from '@/lib/db';
import { researchEvidence } from '@/lib/grounding';
import { findOpportunityContact, planOpportunities, writeOpportunityDraft } from '@/lib/opportunity-services';
import { contactActivityEvidence, researchContactActivity } from '@/lib/contact-activity';
import { selectOpportunityProof } from '@/lib/proof-selection';
import { emptyPerfResult, perfEvidence, PsiRateLimitError, runPsi } from '@/lib/psi';
import { scoreOpportunity } from '@/lib/scoring';
import { getProduct } from '@/lib/catalog/products';
import { qualify, research, ResearchAuthError, writeDraft } from '@/lib/services';
import { postApprovalRequest, postOpportunityApprovalRequest } from '@/lib/slack';
import type { Detection, EvidenceItem, Perf, ProspectStatus, Qualification, Research } from '@/lib/types';

/**
 * step: detect Next.js + hosting from one polite homepage fetch
 */
export const stepDetect = async (domain: string, runId: string) => {
  'use step';

  await upsertProspect(domain, { status: 'detecting', runId, error: null });
  const detection = await detect(domain);
  const evidence = detectionEvidence(detection);

  // Eligibility is evaluated per product. Being on Vercel or not using
  // Next.js can suppress a hosting motion, but must not eliminate AI,
  // observability, security, or other product opportunities.
  const status: ProspectStatus | null =
    detection.outcome === 'unreachable' ? 'unreachable' : null;

  await upsertProspect(domain, {
    status: status ?? 'measuring',
    detection,
    evidence,
    host: detection.host.primary,
    nextjsConfidence: Math.round(detection.nextjs.confidence * 100)
  });

  return { detection, evidence, stop: false };
};

/**
 * step: PageSpeed Insights, mobile + desktop (cached 24h)
 */
export const stepPerf = async (domain: string, detection: Detection) => {
  'use step';

  const url = detection.finalUrl ?? `https://${domain}/`;
  if (!process.env.PSI_API_KEY) {
    const perf: Perf = {
      mobile: emptyPerfResult('mobile', 'PSI_API_KEY not set — performance measurement skipped'),
      desktop: emptyPerfResult('desktop', 'PSI_API_KEY not set — performance measurement skipped')
    };
    await upsertProspect(domain, { status: 'researching', perf, perfScore: null });
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

  await upsertProspect(domain, { status: 'researching', perf, perfScore: perf.mobile.score });
  return { perf, evidence: perfEvidence(perf, url) };
};
stepPerf.maxRetries = 4;

/**
 * step: research agent (Exa), grounded to retrieved URLs
 */
export const stepResearch = async (domain: string, detection: Detection) => {
  'use step';

  if (!process.env.EXA_API_KEY) {
    await upsertProspect(domain, { status: 'qualifying' });
    return { research: null, evidence: [] as EvidenceItem[], dropped: [] as string[], warning: 'EXA_API_KEY not set — research skipped' };
  }

  try {
    const result = await research(domain, detection);
    await upsertProspect(domain, { status: 'qualifying', research: result.research });
    return { research: result.research, evidence: researchEvidence(result.research), dropped: result.dropped, warning: null };
  } catch (err) {
    // A bad key won't fix itself on retry: continue without research, loudly.
    if (!(err instanceof ResearchAuthError)) throw err;
    await upsertProspect(domain, { status: 'qualifying' });
    return { research: null, evidence: [] as EvidenceItem[], dropped: [] as string[], warning: err.message };
  }
};

/**
 * step: qualify against the evidence ledger
 */
export const stepQualify = async (domain: string, evidence: EvidenceItem[]) => {
  'use step';

  const { qualification, warnings } = await qualify(domain, evidence);
  const status: ProspectStatus = qualification.verdict === 'disqualified' ? 'disqualified' : 'drafting';
  await upsertProspect(domain, {
    status,
    qualification,
    evidence,
    fitScore: qualification.fitScore,
    angle: qualification.strongestAngle.label
  });
  return { qualification, warnings };
};

/**
 * step: draft the email + rep brief
 */
export const stepDraft = async (
  domain: string,
  evidence: EvidenceItem[],
  qualification: Qualification,
  research: Research | null,
  extraWarnings: string[]
) => {
  'use step';

  const draft = await writeDraft(domain, evidence, qualification, research);
  draft.warnings = [...extraWarnings, ...draft.warnings];
  await upsertProspect(domain, { draft });
  return draft;
};

/**
 * step: ask a human — Slack card with Approve / Edit / Reject
 */
export const stepRequestApproval = async (domain: string, token: string) => {
  'use step';

  await upsertProspect(domain, { status: 'awaiting_approval', approvalToken: token });

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
    console.warn('⚠️  Slack not configured — approve from the dashboard instead');
    return;
  }
  const prospect = await getProspect(domain);
  if (!prospect) throw new FatalError(`Prospect ${domain} missing`);
  const slack = await postApprovalRequest(prospect, token);
  await upsertProspect(domain, { slack });
  return slack;
};

/**
 * step: mark a run as failed so it shows up on the dashboard
 */
export const stepFail = async (domain: string, message: string) => {
  'use step';

  await upsertProspect(domain, { status: 'error', error: message.slice(0, 500) });
};

/** Plan and persist up to three product-specific opportunities. */
export const stepPlanOpportunities = async (
  domain: string,
  runId: string,
  evidence: EvidenceItem[]
) => {
  'use step';

  await upsertProspect(domain, { status: 'qualifying', evidence });
  const prospect = await getProspect(domain);
  if (!prospect?.detection) throw new FatalError(`Prospect ${domain} is missing detection`);
  const usesVercel = prospect.detection.host.primary === 'vercel';
  const { opportunities } = await planOpportunities(domain, evidence, usesVercel);

  const rows = [];
  for (const opportunity of opportunities) {
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
  await upsertProspect(domain, {
    status: rows.length ? 'researching' : 'disqualified',
    fitScore: top?.score ?? 0,
    angle: top?.angle ?? null,
    // Candidate-level suppression is expected planner behavior, not an
    // account failure. Keep the error field reserved for stepFail so the UI
    // never renders discarded product ideas as fatal errors.
    error: null
  });
  return rows.map((row) => row.id);
};

/** Find the opportunity's buyer, finalize its score, and draft outreach. */
export const stepEnrichOpportunity = async (
  opportunityId: string,
  evidence: EvidenceItem[],
  researchResult: Research | null
) => {
  'use step';

  const opportunity = await getOpportunity(opportunityId);
  if (!opportunity) throw new FatalError(`Opportunity ${opportunityId} is missing`);
  await updateOpportunity(opportunityId, { status: 'researching_contact' });

  let contact = null;
  if (process.env.EXA_API_KEY) {
    contact = await findOpportunityContact({
      domain: opportunity.domain,
      companyName: researchResult?.companyName ?? opportunity.domain,
      productId: opportunity.productId,
      angle: opportunity.angle,
      targetRole: opportunity.targetRole
    });
  }
  contact ??= {
    name: null,
    title: null,
    linkedinUrl: null,
    email: null,
    sourceUrl: null,
    rationale: `No named person was verified. Target ${opportunity.targetRole}.`
  };

  const product = getProduct(opportunity.productId);
  if (!product) throw new FatalError(`Unknown product ${opportunity.productId}`);
  const activity = contact.name && process.env.EXA_API_KEY
    ? await researchContactActivity({
        contact,
        companyName: researchResult?.companyName ?? opportunity.domain,
        domain: opportunity.domain,
        productName: product.name,
        angle: opportunity.angle
      })
    : [];
  const activityEvidence = contactActivityEvidence(activity);
  const proof = await selectOpportunityProof(product.id);
  const rescored = scoreOpportunity({
    product,
    matches: opportunity.matchedSignals,
    usesVercel: opportunity.salesMotion === 'expansion',
    buyerQuality: contact.name ? 15 : 5
  });
  const selectedEvidence = evidence.filter((item) => opportunity.evidenceIds.includes(item.id));
  selectedEvidence.push(...activityEvidence);
  // Expansion copy may state the observed hosting footprint, so include that
  // exact evidence even when it was not a product-fit match.
  if (
    opportunity.salesMotion === 'expansion' &&
    !selectedEvidence.some((item) => item.id === 'detect.host.summary')
  ) {
    const host = evidence.find((item) => item.id === 'detect.host.summary');
    if (host) selectedEvidence.push(host);
  }

  await updateOpportunity(opportunityId, {
    status: 'drafting',
    contact,
    contactActivity: activity,
    proofIds: proof.proofIds,
    competitiveContextIds: proof.competitiveContextIds,
    score: rescored.score,
    scoreBreakdown: rescored.breakdown,
    matchedSignals: rescored.signals
  });
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
  await updateOpportunity(opportunityId, { draft });
  return { opportunityId, score: rescored.score };
};

/** Ask for a separate decision on each opportunity. */
export const stepRequestOpportunityApproval = async (
  opportunityId: string,
  token: string
) => {
  'use step';

  const opportunity = await updateOpportunity(opportunityId, {
    status: 'awaiting_approval',
    approvalToken: token
  });
  if (!opportunity) throw new FatalError(`Opportunity ${opportunityId} is missing`);
  await upsertProspect(opportunity.domain, { status: 'awaiting_approval' });
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) return;
  const prospect = await getProspect(opportunity.domain);
  if (!prospect) throw new FatalError(`Prospect ${opportunity.domain} is missing`);
  const slack = await postOpportunityApprovalRequest(prospect, opportunity, token);
  await updateOpportunity(opportunityId, { slack });
  return slack;
};
