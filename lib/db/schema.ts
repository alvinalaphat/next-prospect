import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { GmailDraft } from '@/lib/gmail';
import type { ProductCategory } from '@/lib/catalog/types';
import type { ScoreBreakdown, ScoredSignal } from '@/lib/scoring';
import type {
  Approval,
  Detection,
  Draft,
  EvidenceItem,
  OpportunityContact,
  OpportunityStatus,
  Perf,
  PerfResult,
  ProspectStatus,
  Qualification,
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

    detection: jsonb('detection').$type<Detection>(),
    perf: jsonb('perf').$type<Perf>(),
    research: jsonb('research').$type<Research>(),
    qualification: jsonb('qualification').$type<Qualification>(),
    draft: jsonb('draft').$type<Draft>(),
    evidence: jsonb('evidence').$type<EvidenceItem[]>(),

    approvalToken: text('approval_token'),
    approval: jsonb('approval').$type<Approval>(),
    slack: jsonb('slack').$type<{ channel: string; ts: string }>(),
    gmailDraft: jsonb('gmail_draft').$type<GmailDraft>(),
    gmailError: text('gmail_error'),

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

export type ProspectRow = typeof prospects.$inferSelect;
export type OpportunityRow = typeof opportunities.$inferSelect;
