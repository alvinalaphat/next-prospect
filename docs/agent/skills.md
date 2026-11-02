# Agent skills and task routing

Skills are task-specific instruction packages, not application dependencies.
Agents should inspect the skills available in their current environment and
load only the ones relevant to the requested change.

## Repo-local skills currently present

The repository includes these packages under `.agents/skills/`:

| Skill | Use when |
| --- | --- |
| `neon` | Managing or diagnosing the Neon project, branches, auth, logs, or SDK behavior |
| `neon-postgres` | Designing PostgreSQL schemas, indexes, queries, search, or Drizzle integration |

These packages are intended to remain in source control so a fresh clone
carries the same database guidance. The session still has to expose and load a
skill before using it; do not assume availability without checking that
session's skills inventory.

## Common runtime skills

Depending on the agent environment, the following skills are particularly
relevant to this repository:

| Task | Preferred skill or guidance |
| --- | --- |
| Next.js component work | Read the versioned guide in `node_modules/next/dist/docs/`; use Vercel React best-practices review when available |
| Workflow orchestration | Vercel Workflow guidance plus `workflows/outbound/README.md` |
| AI SDK structured output or agents | Vercel AI SDK guidance |
| Vercel release or incident | Vercel deployments/CI-CD guidance |
| Environment variables | Vercel environment-variable guidance |
| Neon schema or query change | Repo-local `neon-postgres` skill |
| Neon platform operation | Repo-local `neon` skill |
| Significant UI redesign | A design-engineering skill, followed by real Chrome QA |
| Browser interaction testing | The available Chrome/browser automation skill |

## Selection rules

- Read `AGENTS.md` before selecting a skill; repository invariants override
  generic examples.
- A skill can explain an API, but source code and installed package docs remain
  authoritative for versions.
- Do not load every skill preemptively. Use the smallest set that covers the
  task and follow its referenced files only as needed.
- If a named skill is missing, say so and continue with the closest documented
  workflow rather than inventing its instructions.
- Skills never grant permission to deploy, delete data, change secrets, or send
  outreach beyond the user's request.

## Maintaining this map

Update this file when a project-level skill is added, removed, renamed, or
becomes required for a recurring class of changes. Keep detailed skill content
inside the skill package rather than copying it here.
