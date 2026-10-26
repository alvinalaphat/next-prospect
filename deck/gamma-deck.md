# Next Prospect ▲

### Vercel's lead-agent, pointed at outbound

For Drew Bredvick · Alvin Alaphat

nextprospect.vercel.app

---

# The best outbound reps don't spray

They find a **specific, verifiable reason** to reach out:

- A slow real-user TTFB on CloudFront
- A self-hosted App Router site fighting ISR
- A funding round that means traffic is about to grow

Then they write four sentences an engineer would actually read.

That judgment is tribal knowledge. **Next Prospect encodes it.**

---

# The most qualified list Vercel could have

Companies that **already chose Next.js** but run it somewhere else.

The pitch isn't "change your framework." It's "run it on the platform it was built for."

- Detect Next.js + hosting from one polite HTTP request
- Skip existing Vercel customers automatically
- Measure what the current host costs real users

---

# One durable workflow per domain

1. **Detect**: Next.js signals + host from headers and DNS
2. **Measure**: PageSpeed Insights, with real-user CrUX kept separate from lab data
3. **Research**: Exa agent covering company, funding, news, why now
4. **Find the stakeholder**: Exa people search → LinkedIn-verified web/platform leader
5. **Qualify**: fit score 0–100 + the single strongest angle
6. **Draft**: a short email addressed to the stakeholder + 3 rep talking points
7. **Approve in Slack** → a draft lands in the rep's Gmail. Nothing is ever auto-sent.

---

# Built on your stack

Starts from an unmodified import of **vercel-labs/lead-agent**, so every change is a reviewable diff.

| lead-agent | Next Prospect |
|---|---|
| Form → one workflow | CSV → one durable workflow per domain |
| Research returns free text | Structured output, grounded to real URLs |
| `techStackAnalysis` stub | Real detector + precision/recall eval |
| Slack post, then workflow ends | Workflow ends at Needs review; Slack and the dashboard record the decision |
| `sendEmail()` stub | Gmail **draft** on approval |

Workflow DevKit · AI SDK + AI Gateway · Exa · Slack Bolt · Neon via Marketplace

---

# It can't make things up

Every observation goes into an **evidence ledger** with a stable id:

`psi.mobile.field.ttfb` · `detect.host.x-amz-cf-id` · `research.news.0`

- Every claim must cite a ledger id. Unknown ids are rejected **in code**, not just the prompt.
- Research without a retrieved source is dropped.
- Stakeholders must be named on a page the agent actually retrieved.
- Emails are shown only if published verbatim. They're never guessed.
- Every number in the subject and body is checked against the ledger.

---

# Real output (seed batch, production)

| Company | Host | Fit | Strongest angle |
|---|---|---|---|
| MongoDB | AWS CloudFront | 88 | Real-user LCP 7.9s on mobile |
| Linear | Cloudflare | 86 | Slow real-user LCP/TTFB, App Router |
| Plaid | AWS CloudFront | 82 | Mobile Core Web Vitals SLOW |
| Zillow | AWS CloudFront | 82 | Real-user TTFB on CloudFront |
| Supabase | Vercel | — | Skipped: already a customer |

Zero grounding warnings. Every prospect has a LinkedIn-verified stakeholder.

[Add image: brief-mongodb.png]

---

# What a draft looks like

**Subject:** mobile users wait 7.9s on mongodb.com

> Hi [first name],
>
> CrUX shows mongodb.com is rated SLOW, with p75 LCP 7.9s on mobile and p75 TTFB 1.45s; the site runs Next.js on AWS/CloudFront.
>
> That's time your visitors spend waiting before they see the main content, especially on mobile.
>
> I can spin up a side-by-side Next.js test deploy with managed ISR/RSC caching and image optimization to compare real-user TTFB and LCP.
>
> If you have 15 minutes, I can walk the trace and CrUX history with you and outline what I'd change first.
>
> Alvin Alaphat

One idea per line. It sounds like an engineer, not a sequence. Every number traces to evidence.

---

# Honest about accuracy

Detector eval: 15 domains hand-labeled in a real browser vs. one plain HTTP request.

- **Next.js detection:** 100% precision · 90% recall
- **"Already on Vercel":** 100% precision · 75% recall
- **Host accuracy:** 93%

The one miss: a Cloudflare bot challenge hiding a Vercel site. The pipeline marks those "bot-blocked" and never drafts, so a miss **can't become outreach to an existing customer.**

---

# What I'd build next

- **Better inputs:** Clay / BuiltWith / HG Insights; dedupe against Salesforce
- **Learning loop:** approved vs. rejected drafts become few-shot examples and tune the fit rubric
- **Deeper evidence:** PSI on key product pages, Next.js version, ISR/cache headers
- **Hand-off:** approved drafts flow into sequences, owned by the approving rep
- **Metrics:** reply rate by angle, so the playbook improves with data, not opinion

---

# Why me: I build GTM systems that move numbers

**Alvin Alaphat · Founding Engineer & Growth PM at Delphi (employee #3)**

- **0 → $5M ARR** and hundreds of thousands of users with a team of 7, leading to a **Sequoia-led Series A**
- **Already doing GTM engineering:** built a daily usage → Attio pipeline that found the retention signal (5 conversations in 14 days → ~80% retained)
- **Lifecycle that works:** week-4 retention from <2% to 7–10%; AI-personalized follow-ups brought back 33% of inactive users

---

# Why me: I'm built for customer-facing work

- **I'm a master of cold email.** It's how I landed my roles at 20VC and Delphi, and how I got Lenny as a mentor. Next Prospect is that playbook, turned into software.
- **Delphi's cultural foundation.** I ran the culture-fit interview for every candidate and was friends with nearly everyone on the team.
- **I sold, on purpose.** A year of hardcore sales in college, just to learn it firsthand.
- **Seen GTM from every seat:** founder (MOOV, acquired), investor (20VC), operator (Delphi).

---

# Let's build Vercel's next prospect engine

Next Prospect took one weekend on your stack, including finding and fixing its own bugs in production.

**I learn fast, I work hard, and I want to become a great GTM engineer, building with you.**

alvinalaphat@gmail.com · linkedin.com/in/alvinalaphat · github.com/alvinalaphat
