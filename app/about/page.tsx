import Link from 'next/link';

export const metadata = { title: 'About · Next Prospect' };

const STAGES: { n: string; title: string; tech: string; body: string; stop?: string }[] = [
  {
    n: '01',
    title: 'Detect',
    tech: 'fetch + DNS',
    body: 'One polite GET of the homepage (robots.txt respected, no headless browser). Next.js signals such as __NEXT_DATA__, self.__next_f, /_next/static and x-powered-by are combined into a confidence score. Host signals come from headers and CNAME/A records.',
    stop: 'Already on Vercel, not Next.js, blocked'
  },
  {
    n: '02',
    title: 'Measure',
    tech: 'PageSpeed Insights',
    body: 'Mobile and desktop Lighthouse lab runs, plus CrUX real-user p75 for LCP, INP, CLS and TTFB. Results are cached for 24h in Postgres.'
  },
  {
    n: '03',
    title: 'Research',
    tech: 'AI SDK Agent + Exa',
    body: "lead-agent's research agent with structured output: company summary, size and funding, recent news, likely buyer, and why now. Every item must cite a URL the tools actually returned."
  },
  {
    n: '04',
    title: 'Qualify',
    tech: 'AI SDK · Output.object',
    body: 'Fit score 0–100, reasoning, and the single strongest angle. Each claim cites evidence-ledger ids, and unknown ids are rejected in code.',
    stop: 'Disqualified'
  },
  {
    n: '05',
    title: 'Draft',
    tech: 'AI SDK',
    body: 'A 60–120 word email written like a helpful engineer, plus 3 rep talking points. Numbers in the email are checked against the ledger.'
  },
  {
    n: '06',
    title: 'Approve',
    tech: 'Slack + dashboard',
    body: 'The workflow ends once the draft is ready. Approve, Edit or Reject in Slack or on the dashboard. An approval creates a Gmail draft. Nothing is ever sent.'
  }
];

export default function About() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 break-words">
      <header className="space-y-4">
        <h1 className="text-3xl font-medium sm:text-4xl">
          Next Prospect
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Vercel&apos;s <a className="text-foreground underline underline-offset-4" href="https://github.com/vercel-labs/lead-agent">lead-agent</a>,
          pointed at outbound. It finds companies that already chose Next.js but run it somewhere else, measures what that
          costs their users, and drafts outreach a top rep would be proud of. A human approves every draft.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">The idea</h2>
        <div className="text-muted-foreground space-y-4 leading-relaxed">
          <p>
            The best outbound reps don&apos;t spray. They find a <em>specific, verifiable</em> reason to reach out: a slow
            TTFB on CloudFront, a self-hosted App Router site fighting ISR, a Series B that means traffic is about to
            triple. Then they write two sentences an engineer would actually read.
          </p>
          <p>
            That judgment is usually tribal knowledge. This agent encodes it as a pipeline with a playbook in one file
            (<code className="text-foreground font-mono text-sm">lib/prompts.ts</code>), evidence with receipts, and a
            human in the loop. The part that matters most is that <span className="text-foreground">it cannot make things up</span>.
            Every stage writes to an evidence ledger, and the qualifier and drafter may only cite ledger ids. Code, not
            the prompt, rejects anything else.
          </p>
          <p>
            The target list is the most qualified one Vercel could have. These teams already picked Next.js, so the
            conversation is &ldquo;run it on the platform it was built for&rdquo;, not &ldquo;change your
            framework.&rdquo;
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-medium">Architecture</h2>
          <p className="text-muted-foreground mt-2">
            One durable Workflow DevKit run per domain. Each stage is a <code className="font-mono text-sm">&apos;use step&apos;</code>, so
            it&apos;s retried, checkpointed and observable. A batch of 100 domains is 100 independent runs, staggered to
            respect API quotas.
          </p>
        </div>

        <div className="rounded-lg border p-4 font-mono text-xs sm:p-6">
          <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-4">
            <span className="rounded-lg border px-3 py-2">CSV / dashboard</span>→
            <span className="rounded-lg border px-3 py-2">POST /api/run</span>→
            <span className="rounded-lg border px-3 py-2">start(workflowOutbound) × N</span>
          </div>
          <ol className="relative space-y-0 border-l pl-6">
            {STAGES.map((s) => (
              <li key={s.n} className="relative pb-6 last:pb-0">
                <span className="bg-background absolute top-0 -left-[31px] flex size-3.5 items-center justify-center rounded-full border">
                  <span className="bg-foreground size-1.5 rounded-full" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">{s.n}</span>
                  <span className="font-sans text-sm font-semibold">{s.title}</span>
                  <span className="text-muted-foreground rounded-lg bg-hover px-3 py-1">{s.tech}</span>
                </div>
                <p className="text-muted-foreground mt-1.5 font-sans text-sm leading-relaxed">{s.body}</p>
                {s.stop && (
                  <p className="text-warning mt-2 text-xs">Stops here if: {s.stop}</p>
                )}
              </li>
            ))}
          </ol>
          <div className="text-muted-foreground mt-6 border-t pt-4">
            Every stage appends to the evidence ledger → qualify &amp; draft may only cite ledger ids → Neon Postgres → dashboard
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">What&apos;s reused from lead-agent, and what changed</h2>
        <ul className="space-y-3 md:hidden">
          {[
            ['Form submit → start(workflowInbound)', 'CSV / dashboard → start(workflowOutbound) per domain, staggered'],
            ['Research Agent + Exa tools, free-text report', 'Same agent + tools, structured output, URLs grounded to tool results'],
            ['techStackAnalysis tool: empty stub', 'Real detector: Next.js confidence + host from headers/DNS, with an eval'],
            ['generateObject → category', 'Output.object → fit score, angle, cited claims; one repair pass'],
            ['Slack post, then workflow ends', 'Workflow ends at Needs review; Slack and the dashboard record the decision'],
            ['Approve → sendEmail() stub', 'Approve / Edit (modal) / Reject → recorded; never sends'],
            ['No storage', 'Neon Postgres via Marketplace; embedded PGlite locally']
          ].map(([a, b]) => (
            <li key={a} className="rounded-lg border p-4 text-sm">
              <p className="text-muted-foreground text-xs">lead-agent</p>
              <p className="mt-1">{a}</p>
              <p className="text-muted-foreground mt-3 text-xs">Next Prospect</p>
              <p className="mt-1">{b}</p>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-muted-foreground border-b bg-hover text-left text-xs">
              <tr>
                <th className="px-4 py-4 font-medium">lead-agent</th>
                <th className="px-4 py-4 font-medium">Next Prospect</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['Form submit → start(workflowInbound)', 'CSV / dashboard → start(workflowOutbound) per domain, staggered'],
                ['Research Agent + Exa tools, free-text report', 'Same agent + tools, structured output, URLs grounded to tool results'],
                ['techStackAnalysis tool: empty stub', 'Real detector: Next.js confidence + host from headers/DNS, with an eval'],
                ['generateObject → category', 'Output.object → fit score, angle, cited claims; one repair pass'],
                ['Slack post, then workflow ends', 'Workflow ends at Needs review; Slack and the dashboard record the decision'],
                ['Approve → sendEmail() stub', 'Approve / Edit (modal) / Reject → recorded; never sends'],
                ['No storage', 'Neon Postgres via Marketplace; embedded PGlite locally']
              ].map(([a, b]) => (
                <tr key={a}>
                  <td className="text-muted-foreground px-4 py-4 align-top">{a}</td>
                  <td className="px-4 py-4 align-top">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Guardrails</h2>
        <ul className="text-muted-foreground list-disc space-y-4 pl-5 leading-relaxed">
          <li><span className="text-foreground">No invented facts.</span> Research items without a retrieved source are dropped. Claims citing unknown ids are repaired once, then pruned. Unverified numbers in an email are flagged to the reviewer.</li>
          <li><span className="text-foreground">Lab ≠ field.</span> Lighthouse lab numbers and CrUX real-user p75 are kept separate end to end, and the prompt forbids presenting one as the other.</li>
          <li><span className="text-foreground">Customers are skipped.</span> Any Vercel signal (for example x-vercel-id behind Cloudflare) short-circuits the run. Bot-blocked sites are skipped rather than guessed.</li>
          <li><span className="text-foreground">Polite crawling.</span> robots.txt, one homepage request, identifying User-Agent, timeouts, a size cap, and no private IPs.</li>
          <li><span className="text-foreground">Humans decide.</span> Drafts only. Approval is a recorded decision, not a send.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Detection eval</h2>
        <p className="text-muted-foreground leading-relaxed">
          15 domains were hand-labelled in a real browser (JS executed, DOM inspected) and compared with the detector&apos;s
          single plain GET. Result: <span className="text-foreground font-mono">Next.js precision 100%, recall 90%</span>;
          <span className="text-foreground font-mono"> on-Vercel precision 100%, recall 75%</span>; host accuracy 93%. The one miss is a
          Cloudflare bot challenge hiding a Vercel site. The pipeline marks those &ldquo;bot-blocked&rdquo; and never
          drafts for them. Run <code className="font-mono text-sm">pnpm eval</code>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Where it goes next</h2>
        <ul className="text-muted-foreground list-disc space-y-4 pl-5 leading-relaxed">
          <li>Feed domains from Clay / BuiltWith / HG Insights instead of a CSV. Dedupe against Salesforce (lead-agent&apos;s <code className="font-mono text-sm">crmSearch</code> stub).</li>
          <li>Learn from decisions: approved vs. rejected drafts become few-shot examples and tune the fit-score rubric.</li>
          <li>Deeper, still polite evidence: PSI on a key product page, Next.js version from the build manifest, ISR/cache headers.</li>
          <li>Route approved drafts into Outreach/Salesloft sequences, owned by the rep who approved them.</li>
        </ul>
      </section>

      <footer className="text-muted-foreground border-t pt-6 text-sm">
        <Link href="/" className="hover:text-foreground">← Back to prospects</Link>
      </footer>
    </article>
  );
}
