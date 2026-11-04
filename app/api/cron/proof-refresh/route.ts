import { start } from 'workflow/api';
import { cronUnauthorized, isCronAuthorized } from '@/lib/auth';
import { workflowRefreshProofs } from '@/workflows/maintenance';

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const run = await start(workflowRefreshProofs, []);
    return Response.json({ ok: true, runId: run.runId });
  } catch (error) {
    console.error('[cron] proof refresh failed to start', error);
    return Response.json({ error: 'Proof refresh failed to start' }, { status: 500 });
  }
}
