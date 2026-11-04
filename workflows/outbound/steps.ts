import { FatalError, getStepMetadata, RetryableError } from 'workflow';
import { detect, detectionEvidence } from '@/lib/detect';
import { claimProspectRun, getProspect, updateProspectForRun } from '@/lib/db';
import { getOpportunity, insertOpportunity, updateOpportunity, updateOpportunityForRun } from '@/lib/db';
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

  if (!(await claimProspectRun(domain, runId, { status: 'detecting', error: null }))) {
    return { detection: null, evidence: [] as EvidenceItem[], stop: true as const };
  }
  const detection = await detect(domain);
  const evidence = detectionEvidence(detection);

  // Eligibility is evaluated per product. Being on Vercel or not using
  // Next.js can suppress a hosting motion, but must not eliminate AI,
  // observability, security, or other product opportunities.
  const status: ProspectStatus | null =
    detection.outcome === 'unreachable' ? 'unreachable' : null;

  const active = await updateProspectForRun(domain, runId, {
    status: status ?? 'measuring',
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
 * step: qualify against the evidence ledger
 */
export const stepQualify = async (domain: string, runId: string, evidence: EvidenceItem[]) => {
  'use step';

  const { qualification, warnings } = await qualify(domain, evidence);
  const status: ProspectStatus = qualification.verdict === 'disqualified' ? 'disqualified' : 'drafting';
  await updateProspectForRun(domain, runId, {
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
  runId: string,
  evidence: EvidenceItem[],
  qualification: Qualification,
  research: Research | null,
  extraWarnings: string[]
) => {
  'use step';

  const draft = await writeDraft(domain, evidence, qualification, research);
  draft.warnings = [...extraWarnings, ...draft.warnings];
  await updateProspectForRun(domain, runId, { draft });
  return draft;
};

/**
 * step: ask a human — Slack card with Approve / Edit / Reject
 */
export const stepRequestApproval = async (domain: string, runId: string, token: string) => {
  'use step';

  if (!(await updateProspectForRun(domain, runId, { status: 'awaiting_approval', approvalToken: token }))) return;

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
    console.warn('⚠️  Slack not configured — approve from the dashboard instead');
    return;
  }
  const prospect = await getProspect(domain);
  if (!prospect) throw new FatalError(`Prospect ${domain} missing`);
  if (!(await isProspectRunCurrent(domain, runId))) return;
  const slack = await postApprovalRequest(prospect, token);
  await updateProspectForRun(domain, runId, { slack });
  return slack;
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
  if (!(await updateProspectForRun(opportunity.domain, opportunity.runId, { status: 'drafting' }))) {
    return { opportunityId, score: opportunity.score };
  }
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

  if (!(await isProspectRunCurrent(opportunity.domain, opportunity.runId))) {
    return { opportunityId, score: rescored.score };
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
  if (!(await isProspectRunCurrent(opportunity.domain, opportunity.runId))) {
    return { opportunityId, score: rescored.score };
  }
  await updateOpportunity(opportunityId, { draft });
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
  await updateOpportunity(opportunityId, { slack });
  return slack;
};

/** Mark the account reviewable only after every planned opportunity is ready. */
export const stepFinishOpportunityPlanning = async (domain: string, runId: string) => {
  'use step';

  await updateProspectForRun(
    domain,
    runId,
    { status: 'awaiting_approval' },
    ['qualifying', 'researching', 'drafting']
  );
};

async function isProspectRunCurrent(domain: string, runId: string) {
  const prospect = await getProspect(domain);
  return prospect?.runId === runId;
}
