import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { GmailDraft } from '@/lib/gmail';
import type {
  Approval,
  Detection,
  Draft,
  EvidenceItem,
  Perf,
  PerfResult,
  ProspectStatus,
  Qualification,
  Research
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

export type ProspectRow = typeof prospects.$inferSelect;
