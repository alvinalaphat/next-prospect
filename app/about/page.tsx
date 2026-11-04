import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  FileCheck2,
  Globe2,
  Layers3,
  ShieldCheck,
  Sparkles,
  UserRoundCheck
} from 'lucide-react';
import { OPPORTUNITY_PRODUCTS, PRODUCTS } from '@/lib/catalog/products';

export const metadata = {
  title: 'About · Next Prospect',
  description: 'How NextProspect turns public company evidence into ranked, review-ready Vercel sales opportunities.'
};

const FLOW = [
  {
    icon: Globe2,
    label: 'Observe',
    title: 'Research the account',
    body: 'Inspect the site, host, performance, company profile, region, launches, hiring, and public technical signals.'
  },
  {
    icon: Layers3,
    label: 'Rank',
    title: 'Evaluate the catalog',
    body: 'Match grounded evidence against every Vercel sales motion, score it in code, and keep up to three distinct opportunities.'
  },
  {
    icon: UserRoundCheck,
    label: 'Enrich',
    title: 'Build each opportunity',
    body: 'Find a product-specific buyer, review their public activity, and draft grounded outreach.'
  },
  {
    icon: ShieldCheck,
    label: 'Review',
    title: 'Keep a human in control',
    body: 'Review in the dashboard or Slack. Approval may create a Gmail draft, but nothing sends automatically.'
  }
];

const SCORE_CATEGORIES = [
  { label: 'Product fit', cap: 45, color: 'bg-foreground' },
  { label: 'Timing', cap: 20, color: 'bg-success' },
  { label: 'Account potential', cap: 20, color: 'bg-violet' },
  { label: 'Buyer confidence', cap: 15, color: 'bg-positive' }
];

const ACCOUNT_TIERS = [
  { label: 'Enterprise', points: 20 },
  { label: 'Growth', points: 15 },
  { label: 'Product-led', points: 10 },
  { label: 'Digital SMB', points: 5 },
  { label: 'Other SMB / services', points: 0 }
];

const OPPORTUNITY_CONTENTS = [
  ['Product motion', 'The Vercel product, sales angle, why now, and why Vercel.'],
  ['Score and evidence', 'A plain-language category breakdown with the supporting public evidence beside each point contribution.'],
  ['Buyer context', 'The best grounded named person available, with an explicit target role only as a last resort, plus relevant public activity.'],
  ['Review-ready draft', 'Concise outreach using prospect evidence and approved catalog claims only.']
] as const;

export default function About() {
  return (
    <article className="mx-auto max-w-6xl space-y-16 pb-8 sm:space-y-20">
      <header className="max-w-4xl pt-2 sm:pt-6">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">How it works</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          One domain in. A few credible conversations out.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-3xl text-lg leading-8 text-pretty">
          NextProspect turns public account evidence into ranked Vercel product opportunities, the right buyer for each,
          and grounded outreach for a rep to review.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <Pill>Public evidence</Pill>
          <Pill>Deterministic scoring</Pill>
          <Pill>Human review</Pill>
          <Pill>Never automatic sending</Pill>
        </div>
      </header>

      <section aria-labelledby="scope-title">
        <SectionIntro eyebrow="Current scope" title="Broad catalog, focused output" id="scope-title">
          The system considers the full Vercel product surface, then narrows the result to the conversations a rep can
          actually act on.
        </SectionIntro>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact value={PRODUCTS.length.toString()} label="Catalog entries" detail="Products and capabilities" />
          <Fact value={OPPORTUNITY_PRODUCTS.length.toString()} label="Sales motions" detail="Eligible to lead outreach" />
          <Fact value="3" label="Ranked opportunities" detail="Maximum per account" />
          <Fact value="1" label="Human decision" detail="Per product opportunity" />
        </div>
      </section>

      <section aria-labelledby="workflow-title">
        <SectionIntro eyebrow="Workflow" title="From domain to review" id="workflow-title">
          Each domain runs in its own durable workflow. Missing optional data shrinks the result; it never licenses the
          system to invent facts.
        </SectionIntro>

        <ol className="mt-8 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
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

        <div className="mt-5 flex items-start gap-3 rounded-xl border px-5 py-4">
          <Database className="text-violet mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium">One shared evidence ledger</p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              Website detection, performance, and research become source receipts. Signal matches, buyer context, and
              draft claims must resolve back to those receipts.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="output-title">
        <SectionIntro eyebrow="Output" title="Every recommendation is a complete sales motion" id="output-title">
          The unit of review is the product opportunity, not a generic contact or a pile of account research.
        </SectionIntro>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-xl border">
            {OPPORTUNITY_CONTENTS.map(([title, detail], index) => (
              <div key={title} className="grid grid-cols-[2rem_1fr] gap-3 border-b p-5 last:border-b-0">
                <span className="text-muted-foreground font-mono text-xs">0{index + 1}</span>
                <div>
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-hover p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.14em]">Prioritization</p>
                <h3 className="mt-2 font-semibold tracking-tight">A deterministic 100-point score</h3>
              </div>
              <span className="font-mono text-2xl tabular-nums">/100</span>
            </div>

            <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-border" aria-hidden>
              {SCORE_CATEGORIES.map((category) => (
                <span key={category.label} className={category.color} style={{ width: `${category.cap}%` }} />
              ))}
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {SCORE_CATEGORIES.map((category) => (
                <div key={category.label} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-sm">
                    <span className={`size-2 rounded-full ${category.color}`} aria-hidden />
                    {category.label}
                  </dt>
                  <dd className="font-mono text-sm tabular-nums">{category.cap}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 border-t pt-5">
              <p className="text-sm font-medium">Account potential is positive sales fit</p>
              <div className="mt-3 grid grid-cols-5 overflow-hidden rounded-lg border text-center">
                {ACCOUNT_TIERS.map((tier) => (
                  <div key={tier.label} className="border-r px-1.5 py-3 last:border-r-0">
                    <p className="font-mono text-sm tabular-nums">{tier.points}</p>
                    <p className="text-muted-foreground mt-1 text-[0.65rem] leading-4">{tier.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-4 text-xs leading-5">
                Only the highest supported tier counts. Observed Vercel hosting suppresses only an invalid migration pitch;
                it can add expansion context to other products.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="boundaries-title">
        <SectionIntro eyebrow="Boundaries" title="The model proposes. Code enforces." id="boundaries-title">
          Language models interpret public evidence and write concise copy. Deterministic code owns the decisions that must
          remain repeatable and safe.
        </SectionIntro>

        <div className="mt-8 grid overflow-hidden rounded-xl border md:grid-cols-2">
          <Responsibility icon={Sparkles} title="Model-assisted">
            Research public sources, propose catalog matches, select a grounded buyer, summarize relevant activity, and
            draft from approved context.
          </Responsibility>
          <Responsibility icon={FileCheck2} title="Code-controlled">
            Validate URLs and evidence IDs, apply confidence and freshness, select one account tier, calculate the score,
            suppress invalid motions, and validate approval tokens.
          </Responsibility>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Guardrail title="Public evidence only">Unsupported facts and citations are removed.</Guardrail>
          <Guardrail title="Catalog-owned claims">Product language does not come from model memory.</Guardrail>
          <Guardrail title="Grounded drafting">Every company claim must resolve to public evidence.</Guardrail>
          <Guardrail title="Human control">Approval may create a draft. It never sends it.</Guardrail>
        </ul>
      </section>

      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to prospects
      </Link>
    </article>
  );
}

function SectionIntro({
  eyebrow,
  title,
  id,
  children
}: {
  eyebrow: string;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 text-base leading-7 text-pretty">{children}</p>
    </div>
  );
}

function Fact({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="rounded-xl border p-5">
      <p className="font-mono text-3xl font-medium tabular-nums">{value}</p>
      <h3 className="mt-3 text-sm font-medium">{label}</h3>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{detail}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border px-3 py-1.5">{children}</span>;
}

function Responsibility({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: React.ReactNode }) {
  return (
    <div className="border-b p-5 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0 sm:p-6">
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-6">{children}</p>
    </div>
  );
}

function Guardrail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border p-4">
      <ShieldCheck className="text-positive size-4" aria-hidden />
      <h3 className="mt-3 text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{children}</p>
    </li>
  );
}
