# TadScore

TadScore is a local-first, responsive scoring platform for event workspaces. It provides account
and role management, rule-versioned workspaces, auditable scoring, invitations, and public live
rankings. The full stack runs on one machine with Docker; no cloud service is required.

Comprehensive documentation starts at [docs/README.md](docs/README.md), including backend
[API](docs/api.md), [rules](docs/rules.md), [testing](docs/testing.md), deployment, and operations.

## Local requirements

- Docker Desktop or Docker Engine with Compose v2
- `make` for the convenience commands (optional)
- Node.js, pnpm, PostgreSQL, and Playwright are optional on the host. The documented quality gates
  run in pinned Docker images.

## Start the stack

```bash
make setup
# Edit .env and replace every CHANGE_ME value.
make up
make logs
```

Choose a local database password and put the same value into `POSTGRES_PASSWORD` and the password
segment of `DATABASE_URL`.
Neither `.env.example` nor the application contains a default account or usable secret.

Services become available at:

| Address                 | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `http://localhost:1107` | Responsive web app and API gateway                  |
| `http://localhost:1109` | Mailpit inbox for local email, OTP, and invitations |

PostgreSQL, API, SMTP, and migrations stay on the private Compose network. Only ports 1107 and
1109 are published. On the same LAN, use `http://<host-ip>:1107`; set `WEB_ORIGIN` to that
address so links inside email are correct. Review firewall access before exposing the host.

The startup dependency order is PostgreSQL health check, one-shot dbmate migrations, API health
check, then the web gateway. Migrations never run during Docker image builds.

## Email verification

Set one mode in `.env`:

- `AUTH_EMAIL_VERIFICATION_MODE=otp`: code using the configured length, TTL, and rate limits
  (six digits valid for 24 hours by default).
- `AUTH_EMAIL_VERIFICATION_MODE=link`: single-use verification link.
- `AUTH_EMAIL_VERIFICATION_MODE=off`: new registrations activate without email verification.

Mailpit is the default SMTP server, so OTP, email change, password reset, and invitation flows can
be tested fully offline at port 1109. Production SMTP is optional and configured with the same
`SMTP_*` variables. Restart the API after changing authentication configuration.

## Create an account directly

No account is seeded. Once the stack is healthy, create one through the API's database-aware CLI:

```bash
make account-create
make account-create ARGS="--email admin@example.test --username admin --full-name 'Admin User' --role super_admin"
```

The wrapper always prompts for the password without echoing it and pipes it to the CLI over
standard input. It is never stored in `.env` or exposed as a command argument. Allowed global
roles are `user` and `super_admin`. A `super_admin` administers the platform; workspace access is
separately controlled by the `owner`, `admin`, `scorer`, and `viewer` workspace roles.

## Common commands

```bash
make ps                 # container status
make logs               # follow logs
make migrate            # apply pending migrations
make test               # workspace tests
make build              # build all packages/apps
make validate           # line limits and Compose syntax
make down                # stop containers, preserve data
```

To remove all local data intentionally, run `docker compose down --volumes`. Uploaded avatars,
PostgreSQL data, and Mailpit messages otherwise persist in named Docker volumes.

## Repository layout

```text
apps/api/                 Fastify HTTP API and account CLI
apps/web/                 React responsive web application
packages/contracts/       Shared API schemas and types
packages/rule-engine/     Deterministic scoring and ranking engine
rule-config/              Immutable, versioned rule definitions
database/migrations/      Sequential dbmate SQL migrations
docker/                   Production container and gateway configuration
scripts/                  Account and repository validation tools
rule/                     Original source rules
samples/                  Original spreadsheet samples
```

Handwritten source files warn above 200 lines and fail validation above 300 lines. Generated files,
lockfiles, build artifacts, and untouched shadcn primitives are excluded. Prefer feature modules
and small components rather than splitting cohesive logic solely to satisfy a line count.

## Database and scoring integrity

Migration names use `00001_reason.sql` and are immutable once deployed. dbmate records applied
versions in `schema_migrations`; unexpected schema drift fails instead of being hidden by blanket
`IF NOT EXISTS` statements. See `database/README.md` for migration rules.

Scores are an append-only ledger. Correcting an entry creates an equal and opposite reversal;
records are not edited or deleted. Complete activity results and all derived score entries are
written in a single transaction with an idempotency key, preventing partial results and duplicate
scores from double-clicks or retries.

Workspace rule selection stores an ID, version, JSON snapshot, and SHA-256 hash. Existing
workspaces therefore keep their original behavior if a rule configuration changes later.

## Development quality gates

```bash
make docker-format
make docker-lint
make docker-test
make docker-build
make docker-api-integration
```

These commands build a pinned Docker runner and do not require host Node/pnpm. `make
docker-playwright` runs the Playwright container against an already running stack. CI runs
formatting, linting, tests, builds, line-limit validation, Compose configuration validation, and API
integration with throwaway database resources. Browser/API suites create isolated accounts and
workspaces; no fixture account is supplied through environment configuration.
