import { z } from 'zod';

/**
 * ------------------------------------------------------------
 * Evidence ledger
 *
 * Every fact the pipeline observes (a header, a Core Web Vital, a news
 * article) is recorded as an EvidenceItem with a stable id. LLM outputs may
 * only make claims that cite ids from this ledger — see lib/grounding.ts.
 * ------------------------------------------------------------
 */

export const evidenceSourceSchema = z.enum(['detect', 'psi', 'research']);

export type EvidenceItem = {
  id: string; // e.g. "detect.host.cf-ray", "psi.mobile.lcp", "research.news.0"
  source: z.infer<typeof evidenceSourceSchema>;
  label: string;
  value: string;
  url?: string;
};

/**
 * ------------------------------------------------------------
 * Detection (step 2)
 * ------------------------------------------------------------
 */

export const hostIds = [
  'vercel',
  'netlify',
  'cloudflare',
  'aws',
  'fastly',
  'akamai',
  'gcp',
  'azure',
  'render',
  'fly',
  'railway',
  'heroku',
  'unknown'
] as const;
export type HostId = (typeof hostIds)[number];

export type Signal = {
  id: string; // stable signal id, used as the evidence id suffix
  label: string;
  match: string; // the header value / HTML snippet that matched
};

export type NextjsDetection = {
  isNextjs: boolean;
  confidence: number; // 0–1
  router: 'app' | 'pages' | 'unknown' | null;
  signals: Signal[];
};

export type HostDetection = {
  primary: HostId; // where the app most likely runs
  cdn: HostId | null; // CDN in front, if different from primary
  signals: (Signal & { host: HostId })[];
};

export type Detection = {
  domain: string;
  fetchedUrl: string | null;
  finalUrl: string | null;
  status: number | null;
  outcome: 'ok' | 'robots_disallowed' | 'unreachable' | 'blocked';
  error?: string;
  headers: Record<string, string>;
  dns: { cname: string[]; a: string[] };
  nextjs: NextjsDetection;
  host: HostDetection;
  fetchedAt: string;
};

/**
 * ------------------------------------------------------------
 * Performance (step 3)
 * ------------------------------------------------------------
 */

export type Strategy = 'mobile' | 'desktop';

export type PerfResult = {
  strategy: Strategy;
  score: number | null; // Lighthouse performance score 0–100
  // Lab metrics (Lighthouse). INP is not measurable in a lab run.
  lab: { lcpMs: number | null; clsScore: number | null; ttfbMs: number | null; tbtMs: number | null };
  // Field metrics (CrUX p75), null when Google has no field data for the origin.
  field: {
    lcpMs: number | null;
    inpMs: number | null;
    clsScore: number | null;
    ttfbMs: number | null;
    category: string | null;
    scope: 'url' | 'origin' | null;
  };
  fetchedAt: string;
  error?: string;
};

export type Perf = { mobile: PerfResult; desktop: PerfResult };

/**
 * ------------------------------------------------------------
 * Research (step 4)
 * ------------------------------------------------------------
 */

const sourced = z.object({
  text: z.string(),
  sourceUrl: z.string().describe('URL returned by a search/fetch tool call')
});

export const regionSchema = z.object({
  group: z.enum(['americas', 'emea', 'apac', 'unknown']),
  label: z.string(),
  sourceUrl: z.string().nullable()
});

export type Region = z.infer<typeof regionSchema>;

export const researchSchema = z.object({
  companyName: z.string(),
  summary: sourced.describe('What the company does, one or two sentences'),
  sizeSignals: z
    .array(sourced)
    .describe('Business model, headcount, customers, traffic, funding, engineering footprint, global operations, and digital workload importance'),
  news: z
    .array(
      sourced.extend({
        date: z.string().nullable().describe('ISO date if known')
      })
    )
    .describe('Recent (last ~12 months) news, launches, hires, funding'),
  whyNow: z.array(sourced).describe('Time-sensitive reasons to reach out now')
  ,
  region: regionSchema
    .describe('Best-supported company headquarters region; unknown when public evidence is insufficient'),
  productSignals: z
    .array(
      sourced.extend({
        kind: z.enum(['technology', 'launch', 'hire', 'job_posting', 'company', 'other']),
        date: z.string().nullable()
      })
    )
    .describe('Public signals that may support any Vercel product opportunity')
});

export type Research = z.infer<typeof researchSchema>;

export type ContactActivity = {
  id: string;
  personName: string;
  text: string;
  sourceUrl: string;
  sourceType: 'linkedin-post' | 'blog' | 'talk' | 'podcast' | 'github' | 'other';
  publishedAt: string | null;
  relevance: string;
};

const cited = z.object({
  text: z.string(),
  citations: z
    .array(z.string())
    .describe('Evidence ids from the ledger that support this claim')
});

/**
 * ------------------------------------------------------------
 * Draft
 * ------------------------------------------------------------
 */

export const draftSchema = z.object({
  subjectOptions: z
    .array(z.string())
    .length(3)
    .describe('Three genuinely different subject lines'),
  subject: z.string().describe('The most compelling of subjectOptions'),
  body: z.string(),
  emailCitations: z
    .array(z.string())
    .describe('Evidence ids for every fact referenced in the email'),
  talkingPoints: z.array(cited).length(3)
});

export type Draft = z.infer<typeof draftSchema> & {
  warnings: string[];
  editedBy?: string;
  /** Recipient, from grounded research — shown to the reviewer to verify. */
  to?: { name: string; title: string | null; email: string | null; linkedinUrl: string | null } | null;
};

/**
 * ------------------------------------------------------------
 * Approval (step 7)
 * ------------------------------------------------------------
 */

export const approvalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  by: z.string(),
  via: z.enum(['slack', 'dashboard']),
  editedDraft: z
    .object({ subject: z.string(), body: z.string() })
    .optional()
});

export type Approval = z.infer<typeof approvalSchema>;

/**
 * ------------------------------------------------------------
 * V2 opportunities — one account can have several independently reviewed
 * product/person/draft combinations.
 * ------------------------------------------------------------
 */

export const opportunityContactSchema = z.object({
  name: z.string().nullable(),
  title: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  email: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  region: z.object({
    group: z.enum(['americas', 'emea', 'apac']),
    label: z.string(),
    sourceUrl: z.string()
  }).nullable(),
  rationale: z.string()
});

export type OpportunityContact = z.infer<typeof opportunityContactSchema>;

export const opportunityStatusSchema = z.enum([
  'candidate',
  'researching_contact',
  'drafting',
  'awaiting_approval',
  'approved',
  'rejected',
  'expired',
  'error'
]);

export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;

export type SalesMotion = 'new_business' | 'expansion';

/**
 * ------------------------------------------------------------
 * Prospect status
 * ------------------------------------------------------------
 */

export const prospectStatuses = [
  'queued',
  'detecting',
  'measuring',
  'researching',
  'qualifying',
  'drafting',
  'awaiting_approval',
  'approved',
  'rejected',
  'disqualified',
  'error'
] as const;

export type ProspectStatus = (typeof prospectStatuses)[number];

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) =>
    s
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
  )
  .pipe(
    z
      .string()
      .regex(
        /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/,
        'Invalid domain'
      )
  );
