import { getWorkflowMetadata } from 'workflow';
import { stepFailMaintenance, stepRefreshCatalog, stepRefreshProofs } from './steps';

export async function workflowRefreshCatalog() {
  'use workflow';

  const { workflowRunId } = getWorkflowMetadata();
  try {
    return await stepRefreshCatalog(workflowRunId);
  } catch (error) {
    await stepFailMaintenance(workflowRunId, 'catalog', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

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
