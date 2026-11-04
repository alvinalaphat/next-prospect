# Verification and testing

`pnpm verify` is the complete non-browser verification contract. GitHub Actions
runs the same gates on every pull request and push to `main`. Vercel still owns
preview and production deployments through its Git integration; a successful
Vercel build does not replace behavior or browser testing.

## Automated CI

`.github/workflows/ci.yml` runs one read-only `Verify` job on Ubuntu 24.04 and
Node 22.17, with the pnpm version pinned in `package.json`. It performs a
frozen-lockfile install, then runs:

1. `pnpm check`
2. `pnpm test`
3. `pnpm build`

Concurrent runs for the same branch cancel older in-progress runs. CI has no
application, Vercel, database, Gmail, Slack, or AI credentials. The end-to-
end test creates a temporary isolated PGlite database and does not need them.

## Core checks

| Change | Required checks |
| --- | --- |
| Markdown only | Link/path review and `git diff --check` |
| TypeScript or React | `pnpm check` |
| Production-facing code | `pnpm build` |
| Scoring, catalog, decisions, or persistence | `pnpm test` |
| Detection | `pnpm detect` and targeted `pnpm detect:domain <domain>` when network access is available |
| UI or interaction | Core checks plus Chrome desktop/mobile interaction and console review |
| Schema or migration | `pnpm db:migrate` against an isolated/local database, then the relevant tests |

Run the narrow checks while iterating, then the complete scoped set before
claiming the change is done.

```bash
pnpm verify
```

## What the commands prove

### `pnpm check`

Runs TypeScript without emitting files and enables unused-local and
unused-parameter checks. This is the repository's lightweight typecheck and
lint gate; it does not add a separate style linter. It catches type errors,
server/client import errors, unused imports, unused variables, and unused
parameters, but it does not prove that Next.js can bundle the app or that a
workflow behaves.

### `pnpm build`

Runs the configured Next.js production build, including Workflow compilation.
It may need network access for configured `next/font` assets. In a restricted
environment where Turbopack cannot create its internal process or bind a local
port, use the supported fallback:

```bash
pnpm exec next build --webpack
```

The fallback is for verification constraints; do not silently change the
project's build script to work around an agent sandbox.

### `pnpm test`

Runs deterministic catalog, scoring, auth, formatting, and buyer-activity
assertions, then creates an isolated temporary PGlite database and proves the
account to scored opportunity to grounded draft fixture to approval path. It
deliberately removes Gmail credentials. A Slack-not-configured warning is
expected when Slack env vars are absent.

### `pnpm detect`

Runs the labelled detector fixture in `tests/labels.csv`. The dataset is a
small regression check, not an unbiased benchmark; read `tests/README.md`
before quoting its metrics. It makes live network requests, so it is excluded
from the isolated default gate.

## Browser QA

For a changed page or interaction:

1. Start `pnpm dev` and open the exact affected route in Chrome.
2. Exercise the changed controls with the mouse.
3. Verify native keyboard behavior for interactive disclosures or menus.
4. Inspect both light and dark themes when color or hierarchy changed.
5. Test a narrow viewport around 390 × 844 and confirm no horizontal overflow.
6. Inspect the browser console for application errors.
7. Look at the rendered result; passing DOM assertions do not prove visual
   hierarchy, spacing, clipping, or readability.

Restore temporary viewport and theme changes when using a user-owned browser
tab.

## Database safety during tests

`pnpm db:reset` is destructive. It uses `DATABASE_URL` when present and local
`.pglite` otherwise. Never run it as a generic test setup without resolving the
target database first. The end-to-end script is safer because it supplies an
isolated temporary `PGLITE_PATH` and deletes `DATABASE_URL` in-process.

## Automation boundaries

CI deliberately excludes live detector requests, paid model research, Slack,
Gmail, production database access, and visual browser assertions. Those checks
either require external credentials, spend money, mutate external state, or
need human visual judgment. Run the scoped local checks above when a change
touches those areas.
