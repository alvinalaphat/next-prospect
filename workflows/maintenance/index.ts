import { getWorkflowMetadata } from 'workflow';
import { stepFailMaintenance, stepRefreshProofs } from './steps';

export async function workflowRefreshProofs() {
  'use workflow';

  const { workflowRunId } = getWorkflowMetadata();
  try {
    return await stepRefreshProofs(workflowRunId);
  } catch (error) {
    await stepFailMaintenance(workflowRunId, 'proof', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
