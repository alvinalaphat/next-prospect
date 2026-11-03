import { start } from 'workflow/api';
import { cronUnauthorized, isCronAuthorized } from '@/lib/cron-auth';
import { workflowRefreshCatalog } from '@/workflows/maintenance';

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    const run = await start(workflowRefreshCatalog, []);
    return Response.json({ ok: true, runId: run.runId });
  } catch (error) {
    console.error('[cron] catalog refresh failed to start', error);
    return Response.json({ error: 'Catalog refresh failed to start' }, { status: 500 });
  }
}
