import { getWorkflowMetadata, sleep } from 'workflow';
import type { Approval } from '@/lib/types';
import { approvalHook, approvalToken } from './hooks';
import {
  stepCreateGmailDraft,
  stepDetect,
  stepDraft,
  stepFail,
  stepPerf,
  stepQualify,
  stepRecordDecision,
  stepRequestApproval,
  stepResearch
} from './steps';

/**
 * Outbound workflow — one durable run per domain.
 *
 *   detect → (stop: already Vercel / not Next.js / unreachable)
 *   → PageSpeed Insights → research agent → qualify
 *   → (stop: disqualified) → draft → human approval (Slack or dashboard)
 *
 * Every stage appends to an evidence ledger; qualify and draft may only cite
 * ids from that ledger. Nothing is ever sent — approval just marks the draft.
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

    // Human in the loop. The run suspends here — no compute — until someone
    // clicks Approve / Edit / Reject in Slack or on the dashboard.
    const hook = approvalHook.create({ token: approvalToken(domain, workflowRunId) });
    const card = (await stepRequestApproval(domain, hook.token)) ?? null;

    const approval = await Promise.race([
      hook.then((a): Approval => a),
      sleep('7d').then(() => null)
    ]);
    const recorded = await stepRecordDecision(domain, workflowRunId, approval, card);
    if (!recorded.stale && approval?.decision === 'approved') {
      await stepCreateGmailDraft(domain);
    }

    return { domain, decision: approval?.decision ?? 'expired' };
  } catch (err) {
    await stepFail(domain, err instanceof Error ? err.message : String(err));
    throw err;
  }
};
