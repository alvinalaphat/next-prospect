import { start } from 'workflow/api';
import { isAuthorized, unauthorized } from '@/lib/auth';
import {
  claimProspectRun,
  getProspect,
  reserveProspectRetry,
  restoreProspectRetry
} from '@/lib/db';
import { workflowRetryOutbound } from '@/workflows/outbound';

/** Retry a failed account from its latest persisted application checkpoint. */
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
  if (!(await reserveProspectRetry(domain, failedRunId))) {
    return Response.json({ error: 'This workflow is already being retried' }, { status: 409 });
  }

  try {
    const run = await start(workflowRetryOutbound, [domain, failedRunId], {
      deploymentId: 'latest'
    });
    // The workflow may already have advanced or failed by the time start()
    // returns. Confirm ownership without rewinding its persisted state.
    if (!(await claimProspectRun(domain, run.runId, {}))) {
      await run.cancel().catch(() => {});
      await restoreProspectRetry(domain, failedRunId, failedError);
      return Response.json({ error: 'The account changed before the retry could start' }, { status: 409 });
    }
    return Response.json({ domain, runId: run.runId, resumedFrom: failedRunId });
  } catch (error) {
    await restoreProspectRetry(domain, failedRunId, failedError);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Workflow retry failed to start' },
      { status: 500 }
    );
  }
}
