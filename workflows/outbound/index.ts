import { approvalToken } from '@/lib/approval-token';
import { getWorkflowMetadata, sleep } from 'workflow';
import {
  stepDetect,
  stepDraft,
  stepEnrichOpportunity,
  stepFail,
  stepFinishOpportunityPlanning,
  stepPerf,
  stepQualify,
  stepRequestApproval,
  stepRequestOpportunityApproval,
  stepPlanOpportunities,
  stepResearch,
  stepResumeOutbound
} from './steps';
import type { EvidenceItem } from '@/lib/types';

/**
 * Outbound workflow — one durable run per domain.
 *
 *   detect → PageSpeed Insights → broad account research
 *   → route across Vercel's product catalog → score up to 3 opportunities
 *   → product-specific buyer → draft → Needs review
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

    const perf = await stepPerf(domain, workflowRunId, detected.detection);
    const researched = await stepResearch(domain, workflowRunId, detected.detection);

    const evidence = [...detected.evidence, ...perf.evidence, ...researched.evidence];
    const opportunityIds = await stepPlanOpportunities(domain, workflowRunId, evidence);
    if (!opportunityIds.length) return { domain, stopped: 'no_opportunities' };

    for (const opportunityId of opportunityIds) {
      await stepEnrichOpportunity(opportunityId, evidence, researched.research);
      await stepRequestOpportunityApproval(
        opportunityId,
        approvalToken(opportunityId, workflowRunId, 'opportunity')
      );
    }
    await stepFinishOpportunityPlanning(domain, workflowRunId);
    return { domain, stopped: 'awaiting_approval', opportunities: opportunityIds.length };
  } catch (err) {
    await stepFail(domain, workflowRunId, err instanceof Error ? err.message : String(err));
    throw err;
  }
};

/** Resume an errored account from its last persisted application checkpoint. */
export const workflowRetryOutbound = async (domain: string, failedRunId: string) => {
  'use workflow';

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const checkpoint = await stepResumeOutbound(domain, failedRunId, workflowRunId);
    if (checkpoint.stop) return { domain, stopped: 'superseded' };

    let evidence = checkpoint.evidence;
    let detection = checkpoint.detection;
    if (!detection) {
      const detected = await stepDetect(domain, workflowRunId);
      if (detected.stop) return { domain, stopped: 'detect' };
      detection = detected.detection;
      evidence = replaceEvidence(evidence, 'detect', detected.evidence);
    }

    if (!checkpoint.perf) {
      const perf = await stepPerf(domain, workflowRunId, detection);
      evidence = replaceEvidence(evidence, 'psi', perf.evidence);
    }

    let research = checkpoint.research;
    if (!checkpoint.planningComplete && !research) {
      const researched = await stepResearch(domain, workflowRunId, detection);
      research = researched.research;
      evidence = replaceEvidence(evidence, 'research', researched.evidence);
    }

    let opportunities = checkpoint.opportunities;
    if (checkpoint.planningComplete && !opportunities.length) {
      return { domain, stopped: 'no_opportunities' };
    }
    if (!checkpoint.planningComplete) {
      const opportunityIds = await stepPlanOpportunities(domain, workflowRunId, evidence);
      if (!opportunityIds.length) return { domain, stopped: 'no_opportunities' };
      opportunities = opportunityIds.map((id) => ({
        id,
        status: 'candidate' as const,
        hasDraft: false,
        hasSlack: false
      }));
    }

    for (const opportunity of opportunities) {
      const incomplete = ['candidate', 'researching_contact', 'drafting', 'error'].includes(
        opportunity.status
      );
      const missingSlackPublication =
        opportunity.status === 'awaiting_approval' && !opportunity.hasSlack;
      if (!incomplete && !missingSlackPublication) {
        continue;
      }
      if (incomplete && !opportunity.hasDraft) {
        await stepEnrichOpportunity(opportunity.id, evidence, research);
      }
      await stepRequestOpportunityApproval(
        opportunity.id,
        approvalToken(opportunity.id, workflowRunId, 'opportunity')
      );
    }
    const status = await stepFinishOpportunityPlanning(domain, workflowRunId);
    return { domain, stopped: status, opportunities: opportunities.length };
  } catch (err) {
    await stepFail(domain, workflowRunId, err instanceof Error ? err.message : String(err));
    throw err;
  }
};

function replaceEvidence(
  evidence: EvidenceItem[],
  source: EvidenceItem['source'],
  replacement: EvidenceItem[]
) {
  return [...evidence.filter((item) => item.source !== source), ...replacement];
}
