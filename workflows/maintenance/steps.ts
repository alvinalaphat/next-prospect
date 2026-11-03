import { completeMaintenanceRun, failMaintenanceRun, startMaintenanceRun, upsertProofRecords } from '@/lib/db';
import { refreshCatalogAudit } from '@/lib/refresh/catalog';
import { refreshProofLibrary } from '@/lib/refresh/proofs';
import type { MaintenanceKind } from '@/lib/refresh/types';

export async function stepRefreshCatalog(runId: string) {
  'use step';

  await startMaintenanceRun(runId, 'catalog');
  const result = await refreshCatalogAudit();
  await completeMaintenanceRun(runId, result);
  return result;
}

export async function stepRefreshProofs(runId: string) {
  'use step';

  await startMaintenanceRun(runId, 'proof');
  const { result, records } = await refreshProofLibrary();
  const saved = await upsertProofRecords(records);
  const completed = { ...result, saved };
  await completeMaintenanceRun(runId, completed);
  return completed;
}

export async function stepFailMaintenance(runId: string, kind: MaintenanceKind, message: string) {
  'use step';

  await startMaintenanceRun(runId, kind);
  await failMaintenanceRun(runId, message);
}
