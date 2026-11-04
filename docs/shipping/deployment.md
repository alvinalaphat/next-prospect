# Deployment and CI/CD

NextProspect uses GitHub Actions for continuous integration and Vercel Git
integration for continuous deployment. Pull requests and pushes to `main` run
the read-only `Verify` job in `.github/workflows/ci.yml`. Vercel independently
creates preview deployments for branches and a production deployment for
`main`.

CI does not deploy with the Vercel CLI and needs no deployment token. Keeping a
single deployment owner prevents duplicate builds and mismatched artifacts.

## Production shape

- Framework: Next.js with `withWorkflow` from `workflow/next`.
- Database: Neon Postgres through `DATABASE_URL`.
- Durable runs: Vercel Workflow endpoints generated under `.well-known`.
- Weekly maintenance: Vercel Cron starts the durable customer-proof workflow.
- Primary public alias: `https://nextprospect.vercel.app`.
- Production branch: `main`.

Confirm the linked team, project, branch, commit, and target before an explicit
CLI deployment or promotion. `.vercel/project.json` is local linkage metadata
and must not be committed.

## Release sequence

1. Run `pnpm verify` plus any browser or integration checks required by
   [the verification guide](../testing/verification.md).
2. Commit only the intended files and push the reviewed commit to `main`.
3. Let the Git integration create the production deployment. Do not start a
   duplicate `vercel --prod` deployment unless there is a specific reason.
4. Inspect the deployment until it reports `Ready`.
5. Verify the production alias resolves to that deployment.
6. Open the changed production route and test the changed behavior.
7. Scan deployment logs for runtime errors.

Typical read-only verification commands:

```bash
vercel ls
vercel inspect <deployment-url> --wait
vercel inspect https://nextprospect.vercel.app
vercel logs <deployment-url> --level error --since 1h --no-follow
```

## Environment variables

The names and operator setup live in `README.md` and `.env.example`. Never put
secret values in documentation, terminal output, commits, screenshots, or
prompts.

- `.env.local` is the local source and is ignored by Git.
- Vercel has separate development, preview, and production values.
- Changing Vercel environment variables requires a new deployment before the
  running application sees them.
- `CRON_SECRET` is required in production. Vercel Cron sends it as the bearer
  token to the proof refresh route; requests without the exact token receive
  `401 Unauthorized`.
- Pulling or overwriting env files is a state-changing operation. Preserve
  local-only values and confirm the intended Vercel target first.

## Database migrations

Vercel deployment does not automatically run Drizzle migrations. A schema
release requires a committed migration and an explicit migration step before
code that depends on the new schema serves production traffic.

```bash
pnpm db:generate
pnpm db:migrate
```

`pnpm db:migrate` loads `.env.local`: when `DATABASE_URL` exists, it changes
that Neon database; otherwise it changes local `.pglite`. Resolve and state the
target before running it. Prefer additive, backwards-compatible migrations so
old and new deployments can overlap safely.

## Rollback cautions

Rolling back code does not roll back database schema or external side effects.
Inspect the migration compatibility and any approval/Gmail actions before a
rollback. Vercel rollback or promotion can also change automatic domain
assignment behavior, so inspect the target deployment and aliases afterward.

## Production gating

GitHub CI and the Vercel build start from the same commit but may run in
parallel. To prevent a production alias from moving before `Verify` succeeds,
configure a Vercel GitHub Deployment Check for the `Verify` check run under
**Project Settings → Build and Deployment → Deployment Checks**. Availability
depends on the Vercel plan. Keep automatic domain assignment enabled so the
check, rather than a second deploy workflow, controls promotion.

If that feature is unavailable, protect `main` in GitHub and require `Verify`
before merge. Direct pushes to `main` remain an explicit release action and are
not blocked by this repository file alone.
