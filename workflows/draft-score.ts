import { stepScoreDraft } from './outbound/steps';

/** Score one persisted draft without rerunning the outbound workflow. */
export const workflowScoreDraft = async (opportunityId: string) => {
  'use workflow';

  return stepScoreDraft(opportunityId);
};
