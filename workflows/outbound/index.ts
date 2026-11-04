import { approvalToken } from '@/lib/approval-token';
import { getWorkflowMetadata, sleep } from 'workflow';
import {
  stepDetect,
  stepEnrichOpportunity,
  stepFail,
  stepFinishOpportunityPlanning,
  stepPerf,
  stepRequestOpportunityApproval,
  stepPlanOpportunities,
  stepResearch,
  stepResearchOpportunityBuyers
} from './steps';

/**
 * Outbound workflow — one durable run per domain.
 *
 *   detect → PageSpeed Insights → broad account research
 *   → route across Vercel's product catalog → score up to 3 opportunities
 *   → shared buyer search + targeted fallbacks → per-buyer activity → draft
 *   → Needs review
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
    const buyerResearch = await stepResearchOpportunityBuyers(
      domain,
      workflowRunId,
      opportunityIds,
      researched.research
    );

    for (const opportunityId of opportunityIds) {
      const buyer = buyerResearch.find((result) => result.opportunityId === opportunityId);
      if (!buyer) throw new Error(`Buyer research missing for opportunity ${opportunityId}`);
      await stepEnrichOpportunity(opportunityId, evidence, researched.research, buyer);
      await stepRequestOpportunityApproval(
        opportunityId,
        approvalToken(opportunityId, workflowRunId)
      );
    }
    await stepFinishOpportunityPlanning(domain, workflowRunId);
    return { domain, stopped: 'awaiting_approval', opportunities: opportunityIds.length };
  } catch (err) {
    await stepFail(domain, workflowRunId, err instanceof Error ? err.message : String(err));
    throw err;
  }
};
