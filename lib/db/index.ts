import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { and, desc, eq, exists, inArray, isNull, or, sql } from 'drizzle-orm';
import * as schema from './schema';
import type { OpportunityRow, ProspectRow } from './schema';
import type { MaintenanceKind, ProofRecord, ProofRefreshResult } from '@/lib/refresh/types';
import type { ProspectStatus } from '@/lib/types';

type DB = NeonHttpDatabase<typeof schema>;
let _db: DB | null = null;

/**
 * Neon Postgres (via Vercel Marketplace) when DATABASE_URL is set; otherwise,
 * in local dev only, an embedded PGlite database in ./.pglite so the whole
 * pipeline runs with zero setup. Both speak the same Drizzle API.
 */
export function db(): DB {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (url) {
    _db = drizzleNeon(neon(url), { schema });
  } else if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require('@electric-sql/pglite');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/pglite');
    // Next bundles route handlers, pages and workflow steps separately; share
    // one PGlite instance per process, since it can't be opened twice.
    const g = globalThis as { __pglite?: unknown };
    g.__pglite ??= new PGlite(localDbPath());
    _db = drizzle(g.__pglite, { schema }) as DB;
  } else {
    throw new Error('DATABASE_URL is not set (add Neon via the Vercel Marketplace)');
  }
  return _db!;
}

export const localDbPath = () => process.env.PGLITE_PATH || `${process.cwd()}/.pglite`;

export { schema };

type ProspectPatch = Partial<Omit<ProspectRow, 'domain' | 'createdAt' | 'updatedAt'>>;

export async function upsertProspect(domain: string, patch: ProspectPatch) {
  await db()
    .insert(schema.prospects)
    .values({ domain, ...patch })
    .onConflictDoUpdate({
      target: schema.prospects.domain,
      set: { ...patch, updatedAt: sql`now()` }
    });
}

/** Clear stage data once a replacement workflow has successfully taken ownership. */
function freshStagePatch(): ProspectPatch {
  return {
    host: null,
    nextjsConfidence: null,
    perfScore: null,
    fitScore: null,
    angle: null,
    planningComplete: false,
    detection: null,
    perf: null,
    research: null,
    evidence: null,
    error: null
  };
}

export async function resetProspectForNewRun(domain: string, batch: string) {
  await upsertProspect(domain, {
    ...freshStagePatch(),
    status: 'queued',
    runId: null,
    batch
  });
}

export async function getProspect(domain: string) {
  const rows = await db()
    .select()
    .from(schema.prospects)
    .where(eq(schema.prospects.domain, domain))
    .limit(1);
  return rows[0] ?? null;
}

/** Claim a queued account without allowing an older run to take ownership. */
export async function claimProspectRun(domain: string, runId: string, patch: ProspectPatch) {
  const rows = await db()
    .update(schema.prospects)
    .set({ ...patch, runId, updatedAt: sql`now()` })
    .where(and(
      eq(schema.prospects.domain, domain),
      or(
        eq(schema.prospects.runId, runId),
        and(eq(schema.prospects.status, 'queued'), isNull(schema.prospects.runId))
      )
    ))
    .returning({ domain: schema.prospects.domain });
  return rows.length > 0;
}

/** Claim a queued account and discard data from the run it replaces. */
export async function claimFreshProspectRun(domain: string, runId: string) {
  const claimed = await claimProspectRun(domain, runId, {
    ...freshStagePatch(),
    status: 'detecting'
  });
  if (claimed) await expireOpportunities(domain);
  return claimed;
}

/** Reserve one clean retry without destroying the failed run before start succeeds. */
export async function resetFailedProspectForRetry(domain: string, failedRunId: string, batch: string) {
  const rows = await db()
    .update(schema.prospects)
    .set({ status: 'queued', runId: null, batch, error: null, updatedAt: sql`now()` })
    .where(and(
      eq(schema.prospects.domain, domain),
      eq(schema.prospects.runId, failedRunId),
      eq(schema.prospects.status, 'error')
    ))
    .returning({ domain: schema.prospects.domain });
  return rows.length > 0;
}

/** Restore the visible failure if starting the new run did not succeed. */
export async function restoreProspectRetry(
  domain: string,
  failedRunId: string,
  error: string | null
) {
  const rows = await db()
    .update(schema.prospects)
    .set({ status: 'error', runId: failedRunId, error, updatedAt: sql`now()` })
    .where(and(
      eq(schema.prospects.domain, domain),
      eq(schema.prospects.status, 'queued'),
      isNull(schema.prospects.runId)
    ))
    .returning({ domain: schema.prospects.domain });
  return rows.length > 0;
}

/** Persist step output only while this exact run still owns the account. */
export async function updateProspectForRun(
  domain: string,
  runId: string,
  patch: ProspectPatch,
  allowedStatuses?: ProspectStatus[]
) {
  const rows = await db()
    .update(schema.prospects)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(
      eq(schema.prospects.domain, domain),
      eq(schema.prospects.runId, runId),
      allowedStatuses?.length ? inArray(schema.prospects.status, allowedStatuses) : undefined
    ))
    .returning({ domain: schema.prospects.domain });
  return rows.length > 0;
}

type OpportunityInsert = typeof schema.opportunities.$inferInsert;
type OpportunityPatch = Partial<Omit<OpportunityRow, 'id' | 'domain' | 'runId' | 'createdAt' | 'updatedAt'>>;

export async function insertOpportunity(value: OpportunityInsert) {
  const rows = await db().insert(schema.opportunities).values(value).returning();
  return rows[0];
}

export async function updateOpportunity(id: string, patch: OpportunityPatch) {
  const rows = await db()
    .update(schema.opportunities)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(schema.opportunities.id, id))
    .returning();
  return rows[0] ?? null;
}

/** Publish opportunity state only while its owning run still owns the account. */
export async function updateOpportunityForRun(id: string, patch: OpportunityPatch) {
  const owningRunIsCurrent = db()
    .select({ value: sql`1` })
    .from(schema.prospects)
    .where(and(
      eq(schema.prospects.domain, schema.opportunities.domain),
      eq(schema.prospects.runId, schema.opportunities.runId)
    ));
  const rows = await db()
    .update(schema.opportunities)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(schema.opportunities.id, id), exists(owningRunIsCurrent)))
    .returning();
  return rows[0] ?? null;
}

export async function getOpportunity(id: string) {
  const rows = await db()
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOpportunities(domain: string, runId?: string | null) {
  return db()
    .select()
    .from(schema.opportunities)
    .where(
      runId
        ? and(eq(schema.opportunities.domain, domain), eq(schema.opportunities.runId, runId))
        : eq(schema.opportunities.domain, domain)
    )
    .orderBy(desc(schema.opportunities.score), desc(schema.opportunities.createdAt));
}

/** Remove a partial planner write before retrying that stage. */
export async function clearIncompleteOpportunityPlanning(domain: string, runId: string) {
  const prospect = await getProspect(domain);
  if (prospect?.runId !== runId || prospect.planningComplete) return false;
  const planningIsIncomplete = db()
    .select({ value: sql`1` })
    .from(schema.prospects)
    .where(and(
      eq(schema.prospects.domain, domain),
      eq(schema.prospects.runId, runId),
      eq(schema.prospects.planningComplete, false)
    ));
  await db()
    .delete(schema.opportunities)
    .where(and(
      eq(schema.opportunities.domain, domain),
      eq(schema.opportunities.runId, runId),
      exists(planningIsIncomplete)
    ));
  return updateProspectForRun(domain, runId, {
    planningComplete: false,
    fitScore: null,
    angle: null
  });
}

export async function expireOpportunities(domain: string) {
  await db()
    .update(schema.opportunities)
    .set({ status: 'expired', approvalToken: null, updatedAt: sql`now()` })
    .where(and(
      eq(schema.opportunities.domain, domain),
      eq(schema.opportunities.status, 'awaiting_approval')
    ));
}

export async function startMaintenanceRun(id: string, kind: MaintenanceKind) {
  await db()
    .insert(schema.maintenanceRuns)
    .values({ id, kind, status: 'running', result: null, error: null, finishedAt: null })
    .onConflictDoUpdate({
      target: schema.maintenanceRuns.id,
      set: { status: 'running', result: null, error: null, finishedAt: null }
    });
}

export async function completeMaintenanceRun(id: string, result: ProofRefreshResult) {
  await db()
    .update(schema.maintenanceRuns)
    .set({ status: 'complete', result, error: null, finishedAt: sql`now()` })
    .where(eq(schema.maintenanceRuns.id, id));
}

export async function failMaintenanceRun(id: string, error: string) {
  await db()
    .update(schema.maintenanceRuns)
    .set({ status: 'failed', error: error.slice(0, 2_000), finishedAt: sql`now()` })
    .where(eq(schema.maintenanceRuns.id, id));
}

export async function getLatestMaintenanceRun(kind: MaintenanceKind) {
  const rows = await db()
    .select()
    .from(schema.maintenanceRuns)
    .where(eq(schema.maintenanceRuns.kind, kind))
    .orderBy(desc(schema.maintenanceRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertProofRecords(records: ProofRecord[]) {
  if (!records.length) return 0;
  for (const record of records) {
    await db()
      .insert(schema.proofRecords)
      .values({
        ...record,
        lastSeenAt: new Date(record.lastSeenAt),
        active: true
      })
      .onConflictDoUpdate({
        target: schema.proofRecords.sourceUrl,
        set: {
          vendor: record.vendor,
          usage: record.usage,
          company: record.company,
          title: record.title,
          summary: record.summary,
          productIds: record.productIds,
          industries: record.industries,
          workloads: record.workloads,
          candidateClaims: record.candidateClaims,
          publishedAt: record.publishedAt,
          lastSeenAt: new Date(record.lastSeenAt),
          active: true,
          updatedAt: sql`now()`
        }
      });
  }
  return records.length;
}

export async function listActiveProofRecords() {
  return db()
    .select()
    .from(schema.proofRecords)
    .where(eq(schema.proofRecords.active, true))
    .orderBy(desc(schema.proofRecords.lastSeenAt));
}

export async function getProofRecords(ids: string[]) {
  if (!ids.length) return [];
  return db()
    .select()
    .from(schema.proofRecords)
    .where(and(eq(schema.proofRecords.active, true), inArray(schema.proofRecords.id, ids)));
}
