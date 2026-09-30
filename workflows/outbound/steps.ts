import { FatalError, getStepMetadata, RetryableError } from 'workflow';
import { detect, detectionEvidence } from '@/lib/detect';
import { getProspect, upsertProspect } from '@/lib/db';
import { researchEvidence } from '@/lib/grounding';
import { emptyPerfResult, perfEvidence, PsiRateLimitError, runPsi } from '@/lib/psi';
import { qualify, research, writeDraft } from '@/lib/services';
import { postApprovalRequest, updateApprovalMessage } from '@/lib/slack';
import type {
  Approval,
  Detection,
  EvidenceItem,
  Perf,
  ProspectStatus,
  Qualification
} from '@/lib/types';

/**
 * step: detect Next.js + hosting from one polite homepage fetch
 */
export const stepDetect = async (domain: string, runId: string) => {
  'use step';

  await upsertProspect(domain, { status: 'detecting', runId, error: null });
  const detection = await detect(domain);
  const evidence = detectionEvidence(detection);

  let status: ProspectStatus | null = null;
  if (detection.host.primary === 'vercel') status = 'vercel_customer';
  else if (detection.outcome === 'robots_disallowed') status = 'robots_disallowed';
  else if (detection.outcome === 'unreachable') status = 'unreachable';
  else if (detection.outcome === 'blocked' && !detection.nextjs.isNextjs) status = 'blocked';
  else if (!detection.nextjs.isNextjs) status = 'not_nextjs';

  await upsertProspect(domain, {
    status: status ?? 'measuring',
    detection,
    evidence,
    host: detection.host.primary,
    nextjsConfidence: Math.round(detection.nextjs.confidence * 100)
  });

  return { detection, evidence, stop: status !== null };
};

/**
 * step: PageSpeed Insights, mobile + desktop (cached 24h)
 */
export const stepPerf = async (domain: string, detection: Detection) => {
  'use step';

  const url = detection.finalUrl ?? `https://${domain}/`;
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
    return { evidence: [] as EvidenceItem[], dropped: [] as string[] };
  }

  const result = await research(domain, detection);
  await upsertProspect(domain, { status: 'qualifying', research: result.research });
  return { evidence: researchEvidence(result.research), dropped: result.dropped };
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
  extraWarnings: string[]
) => {
  'use step';

  const draft = await writeDraft(domain, evidence, qualification);
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
};

/**
 * step: record the human decision (or expiry)
 */
export const stepRecordDecision = async (domain: string, approval: Approval | null) => {
  'use step';

  const prospect = await getProspect(domain);
  if (!prospect) throw new FatalError(`Prospect ${domain} missing`);

  const status: ProspectStatus = !approval ? 'expired' : approval.decision;
  const draft =
    approval?.editedDraft && prospect.draft
      ? { ...prospect.draft, ...approval.editedDraft, editedBy: approval.by }
      : prospect.draft;

  await upsertProspect(domain, { status, approval, draft, approvalToken: null });
  if (prospect.slack) {
    await updateApprovalMessage({ ...prospect, status, approval, draft });
  }
};

/**
 * step: mark a run as failed so it shows up on the dashboard
 */
export const stepFail = async (domain: string, message: string) => {
  'use step';

  await upsertProspect(domain, { status: 'error', error: message.slice(0, 500) });
};
