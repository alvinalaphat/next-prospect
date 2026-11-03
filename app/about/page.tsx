import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  ChevronDown,
  Cloud,
  Database,
  FileCheck2,
  Globe2,
  Layers3,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Workflow
} from 'lucide-react';
import { AnimatedDetails } from '@/components/disclosure';
import { getProduct, OPPORTUNITY_PRODUCTS, PRODUCTS } from '@/lib/catalog/products';
import { scoreOpportunity, type ScoredSignal, type SignalMatch } from '@/lib/scoring';

export const metadata = {
  title: 'About · Next Prospect',
  description: 'How NextProspect turns public company evidence into ranked, review-ready Vercel sales opportunities.'
};

const FLOW = [
  {
    icon: Globe2,
    label: 'Collect',
    title: 'Observe the account',
    body: 'Inspect the public site, hosting, performance, company activity, hiring, launches, and region.'
  },
  {
    icon: FileCheck2,
    label: 'Ground',
    title: 'Build an evidence ledger',
    body: 'Normalize each supported observation into a stable record with its source and collection context.'
  },
  {
    icon: Layers3,
    label: 'Evaluate',
    title: 'Compare the full catalog',
    body: 'Match evidence to known product signals, score each valid motion, and keep the strongest distinct opportunities.'
  },
  {
    icon: UserRoundCheck,
    label: 'Enrich',
    title: 'Pair product and buyer',
    body: 'Find a relevant person or target role, then draft concise outreach from selected evidence and approved claims.'
  },
  {
    icon: ShieldCheck,
    label: 'Review',
    title: 'Put a human in control',
    body: 'A rep can approve, edit, or reject each opportunity. Approval may create a Gmail draft. Nothing is sent.'
  }
];

const SCORE_CATEGORIES = [
  { label: 'Product fit', cap: 45, color: 'bg-foreground' },
  { label: 'Timing trigger', cap: 20, color: 'bg-success' },
  { label: 'Account potential', cap: 20, color: 'bg-violet' },
  { label: 'Buyer confidence', cap: 15, color: 'bg-positive' }
];

const EXAMPLE_MATCHES = [
  {
    ruleId: 'multi-model-ai',
    evidenceIds: ['research.technical.0'],
    confidence: 'high',
    explanation: 'The engineering blog documents multiple model providers.'
  },
  {
    ruleId: 'customer-ai-product',
    evidenceIds: ['research.product.0'],
    confidence: 'medium',
    explanation: 'A public product page describes a customer-facing AI agent.'
  },
  {
    ruleId: 'ai-product-launch',
    evidenceIds: ['research.news.0'],
    confidence: 'high',
    observedAt: '2026-09-18',
    explanation: 'The company launched the AI feature 45 days ago.'
  },
  {
    ruleId: 'account.growth-scale',
    evidenceIds: ['research.size.0'],
    confidence: 'high',
    explanation: 'Public company data supports meaningful growth-stage scale.'
  }
] satisfies SignalMatch[];

const AI_GATEWAY = getProduct('ai-gateway');
if (!AI_GATEWAY) throw new Error('AI Gateway must exist in the product catalog');

const EXAMPLE_SCORE = scoreOpportunity({
  product: AI_GATEWAY,
  matches: EXAMPLE_MATCHES,
  usesVercel: true,
  buyerQuality: 15,
  now: new Date('2026-11-02T00:00:00Z')
});

const EXAMPLE_SIGNALS = Object.fromEntries(
  EXAMPLE_SCORE.signals.map((signal) => [signal.ruleId, signal])
) as Record<string, ScoredSignal>;

const RESPONSIBILITIES = [
  {
    concern: 'Product signals',
    model: 'Proposes rule and evidence matches',
    code: 'Rejects unknown rules, missing evidence, and unsupported product fit'
  },
  {
    concern: 'Opportunity score',
    model: 'Does not choose the number',
    code: 'Applies weights, confidence, freshness, category caps, and one account tier'
  },
  {
    concern: 'Buyer',
    model: 'Selects from retrieved people',
    code: 'Requires the selected name to exist in retrieved public content'
  },
  {
    concern: 'Outreach',
    model: 'Writes from selected context',
    code: 'Checks citations, numbers, approved claims, formatting, and leaks'
  }
];

export default function About() {
  return (
    <article className="mx-auto max-w-6xl space-y-16 pb-8 sm:space-y-20">
      <header className="max-w-4xl pt-2 sm:pt-6">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">System overview</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          From public evidence to a review-ready sales motion
        </h1>
        <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8 text-pretty">
          NextProspect turns a company domain into ranked, product-specific Vercel opportunities. It explains why each
          conversation matters, identifies the relevant buyer, and prepares grounded outreach for human review.
        </p>
      </header>

      <section aria-labelledby="system-scale-title">
        <div className="max-w-3xl">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Current scope</p>
          <h2 id="system-scale-title" className="mt-2 text-2xl font-semibold tracking-tight">
            One account, several possible conversations
          </h2>
        </div>
        <div className="mt-6 grid overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            value={PRODUCTS.length.toString()}
            label="Catalog entries"
            detail="Products and supporting capabilities"
          />
          <Fact
            value={OPPORTUNITY_PRODUCTS.length.toString()}
            label="Independent motions"
            detail="Eligible to lead a product pitch"
          />
          <Fact value="3" label="Ranked opportunities" detail="Maximum returned for one company" />
          <Fact value="1" label="Human review gate" detail="Required before optional Gmail drafting" />
        </div>
      </section>

      <section aria-labelledby="workflow-title">
        <SectionIntro
          eyebrow="Workflow"
          title="How the system works"
          description="Each domain gets an independent durable workflow. External work is checkpointed in retry-safe steps, while the account and its product opportunities are persisted separately."
          id="workflow-title"
        />

        <ol className="mt-8 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {FLOW.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.label} className="contents">
                <div className="rounded-xl bg-hover p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground font-mono text-xs">0{index + 1}</span>
                    <Icon className="text-muted-foreground size-4" aria-hidden />
                  </div>
                  <p className="text-muted-foreground mt-5 text-xs font-medium uppercase tracking-[0.14em]">{step.label}</p>
                  <h3 className="mt-2 font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">{step.body}</p>
                </div>
                {index < FLOW.length - 1 && (
                  <div className="flex items-center justify-center py-1 lg:py-0" aria-hidden>
                    <ArrowRight className="text-muted-foreground size-4 rotate-90 lg:rotate-0" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border px-5 py-4 text-sm">
          <StackItem icon={Braces}>Next.js App Router</StackItem>
          <StackItem icon={Workflow}>Vercel Workflow</StackItem>
          <StackItem icon={Sparkles}>AI SDK and AI Gateway</StackItem>
          <StackItem icon={Cloud}>Vercel Functions</StackItem>
          <StackItem icon={Database}>Neon Postgres, PGlite locally</StackItem>
          <StackItem icon={Search}>Exa, PageSpeed, DNS and HTTP signals</StackItem>
          <StackItem icon={Mail}>Dashboard, Slack and optional Gmail drafts</StackItem>
        </div>
      </section>

      <section aria-labelledby="scoring-title">
        <SectionIntro
          eyebrow="Prioritization"
          title="A deterministic score with visible inputs"
          description="The model interprets evidence, but it never chooses the final score. Code applies a small shared weighting model so the same evidence is treated consistently across the catalog."
          id="scoring-title"
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-xl border p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">Category caps</h3>
                <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-6">
                  Evidence activates catalog rules. Adjusted rule points are added inside their category, then limited by
                  that category&apos;s cap.
                </p>
              </div>
            </div>

            <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-border" aria-hidden>
              {SCORE_CATEGORIES.map((category) => (
                <span key={category.label} className={category.color} style={{ width: `${category.cap}%` }} />
              ))}
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {SCORE_CATEGORIES.map((category) => (
                <div key={category.label} className="flex items-center justify-between rounded-lg bg-hover px-4 py-3">
                  <dt className="flex items-center gap-2 text-sm">
                    <span className={`size-2 rounded-full ${category.color}`} aria-hidden />
                    {category.label}
                  </dt>
                  <dd className="font-mono text-sm tabular-nums">{category.cap} max</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex items-start justify-between gap-6 rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Sales-fit account tier</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  Only the highest evidence-backed company profile contributes. Traditional SMB and professional-services
                  profiles receive no account points by default.
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm">0 to 20</span>
            </div>
            <p className="text-muted-foreground mt-4 text-xs leading-5">
              Scores are stored on a 0 to 100 scale, and the four positive category caps total 100 points.
            </p>
          </div>

          <div className="rounded-xl bg-hover p-5 sm:p-6">
            <h3 className="font-semibold tracking-tight">Calculation order</h3>
            <ol className="mt-5 space-y-5">
              <FormulaStep number="1" title="Validate the match" formula="evidence → known rule">
                A signal is discarded unless it cites known evidence and a rule defined for that product.
              </FormulaStep>
              <FormulaStep number="2" title="Adjust each rule" formula="round(base × confidence × freshness)">
                Confidence is 1.0, 0.7, or 0.4. Time-sensitive signals use 1.0, 0.85, 0.6, or 0.3 as they age.
              </FormulaStep>
              <FormulaStep number="3" title="Calculate each category" formula="min(sum of rule points, category cap)">
                A rule ID scores only once. Product and timing rules can combine, while only the highest supported account
                tier contributes.
              </FormulaStep>
              <FormulaStep number="4" title="Calculate the final score" formula="clamp(fit + timing + account + buyer)">
                Zero product fit suppresses the motion. Other grounded candidates remain visible with their lower score.
              </FormulaStep>
            </ol>
            <p className="text-muted-foreground mt-6 border-t pt-4 text-xs leading-5">
              Observed Vercel hosting suppresses an incorrect platform migration pitch. For other products, it adds 5
              account-potential points as expansion context without implying a private contract or broader adoption.
            </p>
          </div>
        </div>

        <AnimatedDetails
          className="mt-5 overflow-hidden rounded-xl border"
          summaryClassName="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 [&::-webkit-details-marker]:hidden"
          summary={
            <>
              <span className="min-w-0">
                <span className="text-muted-foreground block text-xs font-medium uppercase tracking-[0.14em]">
                  Worked example
                </span>
                <span className="mt-1 block font-semibold tracking-tight">How an AI Gateway opportunity scores</span>
                <span className="text-muted-foreground mt-1 block text-sm leading-6">
                  Trace six grounded inputs through adjustments, category caps, and the final result.
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-lg font-medium tabular-nums">{EXAMPLE_SCORE.score}/100</span>
                <ChevronDown className="disclosure-chevron text-muted-foreground size-4 group-open:rotate-180" aria-hidden />
              </span>
            </>
          }
        >
          <div className="border-t p-5 sm:p-6">
            <p className="text-muted-foreground max-w-3xl text-sm leading-6">
              This illustrative account has an existing Vercel footprint, a public AI product, a recent launch, meaningful
              company scale, and a verified buyer. Each row below shows the evidence, the rule it activates, and the points
              produced before category caps.
            </p>

            <div className="mt-5 rounded-lg bg-hover p-4 sm:p-5">
              <p className="text-sm font-semibold">Where the base points come from</p>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
                Base points are code-reviewed product-policy weights stored with each rule in{' '}
                <code className="text-foreground font-mono text-xs">ProductDefinition.signals</code>. They are not generated
                by the model or inferred from this company&apos;s evidence. The exact values should be calibrated against reply
                and conversion data over time.
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-background p-3">
                  <dt className="font-mono text-sm font-medium">24 catalog points</dt>
                  <dd className="text-muted-foreground mt-1 text-xs leading-5">
                    Multiple model providers directly match AI Gateway&apos;s routing and unified model-access value.
                  </dd>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <dt className="font-mono text-sm font-medium">21 catalog points</dt>
                  <dd className="text-muted-foreground mt-1 text-xs leading-5">
                    A customer-facing AI product supports likely demand, but does not alone prove multi-provider complexity.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <ExampleCategory
                title="Product fit"
                score={`${EXAMPLE_SCORE.breakdown.productFit}/45`}
                note="39 adjusted points remain below the 45-point cap."
              >
                <EvidenceCalculation
                  evidence="Engineering blog documents multiple model providers"
                  rule="multi-model-ai"
                  signal={EXAMPLE_SIGNALS['multi-model-ai']}
                />
                <EvidenceCalculation
                  evidence="Product page describes a customer-facing AI agent"
                  rule="customer-ai-product"
                  signal={EXAMPLE_SIGNALS['customer-ai-product']}
                />
              </ExampleCategory>

              <ExampleCategory title="Timing trigger" score={`${EXAMPLE_SCORE.breakdown.trigger}/20`}>
                <EvidenceCalculation
                  evidence="AI feature launched 45 days ago"
                  rule="ai-product-launch"
                  signal={EXAMPLE_SIGNALS['ai-product-launch']}
                />
              </ExampleCategory>

              <ExampleCategory title="Account potential" score={`${EXAMPLE_SCORE.breakdown.accountValue}/20`}>
                <EvidenceCalculation
                  evidence="Public company data supports growth-stage scale"
                  rule="account.growth-scale"
                  signal={EXAMPLE_SIGNALS['account.growth-scale']}
                />
                <EvidenceCalculation
                  evidence="Host detection confirms an existing Vercel footprint"
                  rule="expansion context"
                  formula="5 point bonus"
                  points={5}
                />
              </ExampleCategory>

              <ExampleCategory title="Buyer confidence" score={`${EXAMPLE_SCORE.breakdown.buyerQuality}/15`}>
                <EvidenceCalculation
                  evidence="Retrieved public content verifies the Head of AI"
                  rule="buyer confidence"
                  formula="verified buyer"
                  points={EXAMPLE_SCORE.breakdown.buyerQuality}
                />
              </ExampleCategory>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-lg bg-hover px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Final opportunity score</p>
                <p className="text-muted-foreground mt-1 font-mono text-xs">
                  {EXAMPLE_SCORE.breakdown.productFit} fit + {EXAMPLE_SCORE.breakdown.trigger} timing +{' '}
                  {EXAMPLE_SCORE.breakdown.accountValue} account + {EXAMPLE_SCORE.breakdown.buyerQuality} buyer
                </p>
              </div>
              <p className="font-mono text-2xl font-medium tabular-nums">= {EXAMPLE_SCORE.score}/100</p>
            </div>
          </div>
        </AnimatedDetails>
      </section>

      <section aria-labelledby="boundaries-title">
        <SectionIntro
          eyebrow="Control plane"
          title="The model interprets. Code enforces."
          description="The language model is useful for connecting evidence to a plausible sales motion. Deterministic code owns the boundaries that must be repeatable and auditable."
          id="boundaries-title"
        />

        <div className="mt-8 overflow-hidden rounded-xl border">
          <div className="hidden grid-cols-[0.7fr_1fr_1.25fr] border-b bg-hover text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground sm:grid">
            <div className="px-5 py-3">Decision</div>
            <div className="border-l px-5 py-3">Model</div>
            <div className="border-l px-5 py-3">Deterministic code</div>
          </div>
          {RESPONSIBILITIES.map((row) => (
            <div
              key={row.concern}
              className="grid gap-4 border-b p-5 text-sm last:border-b-0 sm:grid-cols-[0.7fr_1fr_1.25fr] sm:gap-0 sm:p-0"
            >
              <div className="font-medium sm:px-5 sm:py-4">{row.concern}</div>
              <div className="sm:border-l sm:px-5 sm:py-4">
                <p className="text-muted-foreground mb-1 text-xs sm:hidden">Model</p>
                <p className="text-muted-foreground leading-6">{row.model}</p>
              </div>
              <div className="sm:border-l sm:px-5 sm:py-4">
                <p className="text-muted-foreground mb-1 text-xs sm:hidden">Deterministic code</p>
                <p className="leading-6">{row.code}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="guardrails-title" className="rounded-xl bg-hover p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Safety</p>
            <h2 id="guardrails-title" className="mt-2 text-2xl font-semibold tracking-tight">
              Guardrails that survive prompt changes
            </h2>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            <Guardrail title="Public evidence only">Unsupported research URLs and unknown evidence references are removed.</Guardrail>
            <Guardrail title="Approved product claims">Product language comes from the catalog, not model memory.</Guardrail>
            <Guardrail title="Honest degradation">Missing research or performance data produces a smaller brief, not invented context.</Guardrail>
            <Guardrail title="Human control">Approval records a decision and may create a draft. It never sends the email.</Guardrail>
          </ul>
        </div>
      </section>
    </article>
  );
}

function Fact({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="border-b p-5 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0">
      <p className="font-mono text-3xl font-medium tabular-nums">{value}</p>
      <h3 className="mt-3 text-sm font-medium">{label}</h3>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{detail}</p>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  id
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 text-base leading-7 text-pretty">{description}</p>
    </div>
  );
}

function StackItem({ icon: Icon, children }: { icon: typeof Database; children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2">
      <Icon className="size-4" aria-hidden /> {children}
    </span>
  );
}

function FormulaStep({
  number,
  title,
  formula,
  children
}: {
  number: string;
  title: string;
  formula: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-3">
      <span className="flex size-6 items-center justify-center rounded-full bg-background font-mono text-xs" aria-hidden>
        {number}
      </span>
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        <code className="text-foreground mt-1 block font-mono text-xs leading-5">{formula}</code>
        <p className="text-muted-foreground mt-1 text-sm leading-6">{children}</p>
      </div>
    </li>
  );
}

function ExampleCategory({
  title,
  score,
  note,
  children
}: {
  title: string;
  score: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="shrink-0 font-mono text-sm tabular-nums">{score}</span>
      </div>
      <div className="mt-4 divide-y">{children}</div>
      {note ? <p className="text-muted-foreground mt-3 text-xs leading-5">{note}</p> : null}
    </section>
  );
}

function EvidenceCalculation({
  evidence,
  rule,
  signal,
  formula,
  points
}: {
  evidence: string;
  rule: string;
  signal?: ScoredSignal;
  formula?: string;
  points?: number;
}) {
  const resolvedPoints = signal?.points ?? points ?? 0;
  const resolvedFormula = signal
    ? `${signal.basePoints} base × ${signal.multiplier.toFixed(2)} adjustment`
    : formula ?? 'direct adjustment';

  return (
    <div className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <p className="text-sm leading-6">{evidence}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Maps to <code className="font-mono">{rule}</code>
        </p>
      </div>
      <p className="font-mono text-xs tabular-nums sm:text-right">
        {resolvedFormula} = <span className="text-sm font-medium">{resolvedPoints}</span>
      </p>
    </div>
  );
}

function Guardrail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <ShieldCheck className="text-positive mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-6">{children}</p>
      </div>
    </li>
  );
}
