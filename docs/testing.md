# Testing

The project has three testing layers: package unit tests, API integration tests against real
PostgreSQL, and browser full-stack smoke tests. Tests must create their own users and workspaces;
there are no sample accounts and no passwords in environment files.

## Unit and build gates

Docker is the default test path. Host Node, pnpm, PostgreSQL and Playwright are not required for
normal validation. Use the Docker runner targets:

```bash
make docker-format
make docker-lint
make docker-test
make docker-build
make docker-check
```

The runner is built from `docker/test.Dockerfile` using pinned Node, pnpm, and Playwright images.
It excludes host `dist` output and builds shared workspace packages before API tests, so the result
does not depend on stale host artifacts. Host `npx -y pnpm@10.13.1 ...` remains useful for local
development, but it is optional and not the documented verification path. `lint` includes
line-limit and migration-layout checks. Files above 200 lines warn; files above 300 lines fail
unless excluded as generated or vendor-style artifacts.

## API integration

API integration tests live in `apps/api/src/integration`. They are gated by:

```bash
TADSCORE_INTEGRATION=1
DATABASE_URL=postgresql://...
```

Without those variables, the tests are skipped so normal unit runs stay fast. When enabled, the
tests use Fastify inject for HTTP calls and the configured PostgreSQL database for persistence.

Expected coverage includes:

- auth modes `off`, `otp`, and `link`;
- login by email and username;
- `super_admin` and workspace `owner/admin/scorer/viewer` RBAC;
- email invitation, share link invitation, and forced email `maxUses=1`;
- default `teamCount` and `TEAM_LIMIT`;
- scoring, ranking, idempotency conflicts, purchases, affordability, and phase limits;
- locked/archived read-only behavior;
- atomic game reversal and reverse-key conflict on a different submission;
- public ranking privacy, link revoke, and public team detail redaction;
- audit logs, outbox, health, Swagger JSON, and stdin account CLI unit coverage.

## Isolated Docker database

Run integration against a throwaway Docker network and PostgreSQL container, not the main UI stack:

```bash
make docker-api-integration
```

The script builds the Docker runner, creates a throwaway network, starts `postgres:17-alpine`
without publishing any host port, runs migrations `up`, derives rollback count from migration
files, rolls back each migration in reverse order, applies `up` again, runs API integration, and
cleans up the container/network with a trap. It uses only disposable credentials inside the
isolated network and does not write sample credentials to `.env`.

If a local diagnostic ever must publish a host port, first check that the candidate is free and keep
it inside `1007..1117`, for example:

```bash
lsof -nP -iTCP:1112 -sTCP:LISTEN
```

Prefer no published port for automated API integration.

## Full-stack browser checks

The web app has Playwright e2e specs under `apps/web/e2e`. Run them from the Playwright Docker
runner after a full stack is healthy:

```bash
make docker-playwright
```

By default the runner uses host networking and targets `http://localhost:1107` plus Mailpit at
`http://localhost:1109`, matching the default `WEB_ORIGIN` so authenticated browser POSTs pass
origin checks. Set `TADSCORE_FULLSTACK=1` to include the full-stack smoke spec. Full-stack checks
should validate external gateway `/health`, `/api/auth/config`, Swagger `/api/docs/json`, public SSE
behavior, account CLI creation with password over stdin, and container-internal API `/health`. Use
unique ports in `1007..1117` and project names for local verification so a developer's main stack
remains intact.

If overriding `PLAYWRIGHT_BASE_URL` to `http://host.docker.internal:1107`, configure the API with a
matching origin too, for example:

```bash
WEB_ORIGIN=http://localhost:1107,http://host.docker.internal:1107
```

The Playwright wrapper prints the browser origin and performs fail-fast checks for gateway health,
auth config, Swagger JSON, and Mailpit before running browser tests. These checks do not create
accounts or print secrets; they only confirm that the Docker browser can reach the expected stack.
