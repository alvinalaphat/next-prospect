import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { GmailDraft } from '@/lib/gmail';
import type { ProductCategory } from '@/lib/catalog/types';
import type { ScoreBreakdown, ScoredSignal } from '@/lib/scoring';
import type { MaintenanceKind, MaintenanceStatus, ProofRefreshResult, ProofUsage, ProofVendor } from '@/lib/refresh/types';
import type {
  Approval,
  ContactActivity,
  Detection,
  Draft,
  EvidenceItem,
  OpportunityContact,
  OpportunityStatus,
  Perf,
  PerfResult,
  ProspectStatus,
  Research,
  SalesMotion
} from '@/lib/types';

/**
 * One row per domain. Each pipeline stage writes its own JSONB column; a few
 * scalar columns are denormalized so the dashboard can sort/filter cheaply.
 */
export const prospects = pgTable(
  'prospects',
  {
    domain: text('domain').primaryKey(),
    status: text('status').$type<ProspectStatus>().notNull().default('queued'),
    runId: text('run_id'),
    batch: text('batch'),

    host: text('host'),
    nextjsConfidence: integer('nextjs_confidence'), // 0–100
    perfScore: integer('perf_score'), // mobile Lighthouse score
    fitScore: integer('fit_score'),
    angle: text('angle'),
    planningComplete: boolean('planning_complete').notNull().default(false),

    detection: jsonb('detection').$type<Detection>(),
    perf: jsonb('perf').$type<Perf>(),
    research: jsonb('research').$type<Research>(),
    evidence: jsonb('evidence').$type<EvidenceItem[]>(),

    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('prospects_status_idx').on(t.status)]
);

/** PageSpeed Insights responses are slow (~20s) and quota-limited: cache them. */
export const psiCache = pgTable(
  'psi_cache',
  {
    url: text('url').notNull(),
    strategy: text('strategy').notNull(),
    result: jsonb('result').$type<PerfResult>().notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.url, t.strategy] })]
);

/** One independently reviewable Vercel product opportunity for an account. */
export const opportunities = pgTable(
  'opportunities',
  {
    id: text('id').primaryKey(),
    domain: text('domain')
      .notNull()
      .references(() => prospects.domain, { onDelete: 'cascade' }),
    runId: text('run_id').notNull(),

    productId: text('product_id').notNull(),
    productName: text('product_name').notNull(),
    category: text('category').$type<ProductCategory>().notNull(),
    salesMotion: text('sales_motion').$type<SalesMotion>().notNull().default('new_business'),
    status: text('status').$type<OpportunityStatus>().notNull().default('candidate'),

    angle: text('angle').notNull(),
    whyNow: text('why_now').notNull(),
    whyVercel: text('why_vercel').notNull(),
    targetRole: text('target_role').notNull(),
    score: integer('score').notNull(),
    scoreBreakdown: jsonb('score_breakdown').$type<ScoreBreakdown>().notNull(),
    matchedSignals: jsonb('matched_signals').$type<ScoredSignal[]>().notNull(),
    evidenceIds: jsonb('evidence_ids').$type<string[]>().notNull(),

    contact: jsonb('contact').$type<OpportunityContact>(),
    contactActivity: jsonb('contact_activity').$type<ContactActivity[]>(),
    proofIds: jsonb('proof_ids').$type<string[]>(),
    competitiveContextIds: jsonb('competitive_context_ids').$type<string[]>(),
    draft: jsonb('draft').$type<Draft>(),
    decision: jsonb('decision').$type<Approval>(),
    approvalToken: text('approval_token'),
    slack: jsonb('slack').$type<{ channel: string; ts: string }>(),
    gmailDraft: jsonb('gmail_draft').$type<GmailDraft>(),
    gmailError: text('gmail_error'),
    error: text('error'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('opportunities_domain_run_idx').on(t.domain, t.runId),
    index('opportunities_status_idx').on(t.status),
    index('opportunities_score_idx').on(t.score)
  ]
);

/** Durable history for the weekly customer-proof refresh workflow. */
export const maintenanceRuns = pgTable(
  'maintenance_runs',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<MaintenanceKind>().notNull(),
    status: text('status').$type<MaintenanceStatus>().notNull().default('running'),
    result: jsonb('result').$type<ProofRefreshResult>(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('maintenance_runs_kind_created_idx').on(t.kind, t.createdAt)]
);

/** Refreshed customer proof and competitive context. Never used for scoring. */
export const proofRecords = pgTable(
  'proof_records',
  {
    id: text('id').primaryKey(),
    vendor: text('vendor').$type<ProofVendor>().notNull(),
    usage: text('usage').$type<ProofUsage>().notNull(),
    company: text('company').notNull(),
    title: text('title').notNull(),
    sourceUrl: text('source_url').notNull(),
    summary: text('summary').notNull(),
    productIds: jsonb('product_ids').$type<string[]>().notNull(),
    industries: jsonb('industries').$type<string[]>().notNull(),
    workloads: jsonb('workloads').$type<string[]>().notNull(),
    candidateClaims: jsonb('candidate_claims').$type<string[]>().notNull(),
    publishedAt: text('published_at'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('proof_records_source_url_idx').on(t.sourceUrl),
    index('proof_records_vendor_idx').on(t.vendor),
    index('proof_records_active_idx').on(t.active)
  ]
);

export type ProspectRow = typeof prospects.$inferSelect;
export type OpportunityRow = typeof opportunities.$inferSelect;
export type MaintenanceRunRow = typeof maintenanceRuns.$inferSelect;
export type ProofRecordRow = typeof proofRecords.$inferSelect;
