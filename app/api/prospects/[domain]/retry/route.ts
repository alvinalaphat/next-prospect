import { start } from 'workflow/api';
import { isAuthorized, unauthorized } from '@/lib/auth';
import {
  getProspect,
  resetFailedProspectForRetry,
  restoreProspectRetry
} from '@/lib/db';
import { workflowOutbound } from '@/workflows/outbound';

/** Start a failed account again from the beginning. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ domain: string }> }
) {
  if (!isAuthorized(request)) return unauthorized();

  const { domain: encodedDomain } = await ctx.params;
  const domain = decodeURIComponent(encodedDomain);
  const prospect = await getProspect(domain);
  if (!prospect) return Response.json({ error: 'Account not found' }, { status: 404 });
  if (prospect.status !== 'error' || !prospect.runId) {
    return Response.json({ error: 'Only a failed workflow can be retried' }, { status: 409 });
  }

  const failedRunId = prospect.runId;
  const failedError = prospect.error;
  const batch = `retry-${Date.now()}`;
  if (!(await resetFailedProspectForRetry(domain, failedRunId, batch))) {
    return Response.json({ error: 'This workflow is already being retried' }, { status: 409 });
  }

  try {
    const run = await start(workflowOutbound, [domain, 0], {
      deploymentId: 'latest'
    });
    return Response.json({ domain, runId: run.runId, restartedFrom: failedRunId });
  } catch (error) {
    await restoreProspectRetry(domain, failedRunId, failedError);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Workflow retry failed to start' },
      { status: 500 }
    );
  }
}
