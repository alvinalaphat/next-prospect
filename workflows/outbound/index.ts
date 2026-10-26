import { approvalToken } from '@/lib/approval-token';
import { getWorkflowMetadata, sleep } from 'workflow';
import {
  stepDetect,
  stepDraft,
  stepFail,
  stepPerf,
  stepQualify,
  stepRequestApproval,
  stepResearch
} from './steps';

/**
 * Outbound workflow — one durable run per domain.
 *
 *   detect → (stop: already Vercel / not Next.js / unreachable)
 *   → PageSpeed Insights → research agent → qualify
 *   → (stop: disqualified) → draft → Needs review
 *
 * The run ends once the draft is waiting for a person. Slack and the dashboard
 * record the decision themselves. Every stage appends to an evidence ledger;
 * qualify and draft may only cite ids from that ledger. Nothing is ever sent.
 */
export const workflowOutbound = async (domain: string, startDelaySeconds = 0) => {
  'use workflow';

  const { workflowRunId } = getWorkflowMetadata();

  // Stagger large batches so PSI and Exa quotas aren't hit all at once.
  if (startDelaySeconds > 0) await sleep(`${startDelaySeconds}s`);

  try {
    const detected = await stepDetect(domain, workflowRunId);
    if (detected.stop) return { domain, stopped: 'detect' };

    const perf = await stepPerf(domain, detected.detection);
    const researched = await stepResearch(domain, detected.detection);

    const evidence = [...detected.evidence, ...perf.evidence, ...researched.evidence];
    const { qualification, warnings } = await stepQualify(domain, evidence);
    if (qualification.verdict === 'disqualified') return { domain, stopped: 'qualify' };

    const researchWarnings = [
      ...(researched.warning ? [researched.warning] : []),
      ...(researched.dropped.length
        ? [`Research: dropped ${researched.dropped.length} item(s) with unretrieved sources`]
        : [])
    ];
    await stepDraft(domain, evidence, qualification, researched.research, [
      ...researchWarnings,
      ...warnings
    ]);

    // Stop at Needs review. The token lets Slack or the dashboard record a
    // decision for this run without keeping the workflow open.
    await stepRequestApproval(domain, approvalToken(domain, workflowRunId));
    return { domain, stopped: 'awaiting_approval' };
  } catch (err) {
    await stepFail(domain, err instanceof Error ? err.message : String(err));
    throw err;
  }
};
