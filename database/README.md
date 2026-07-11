# TadScore database

Migrations are plain PostgreSQL SQL managed by dbmate. They run once, in lexical/version order,
and dbmate records applied versions in `schema_migrations`.

## Rules

- Use `00001_reason.sql`, incrementing the five-digit version for every change.
- Never edit a migration that has been deployed. Add a new migration instead.
- Do not use blanket `IF NOT EXISTS`; unexpected drift must fail visibly.
- Keep both `-- migrate:up` and `-- migrate:down` sections.
- Migration execution happens at container startup/deploy, never during image build.

Run migrations with `make migrate`. To inspect status:

```bash
docker compose run --rm migrate status
```

The immutable `score_ledger` is the scoring source of truth. Corrections append an equal and
opposite `reversal` row referencing the original row. API writes for a complete activity result
must wrap `result_submissions`, `activity_results`, and all corresponding ledger entries in one
database transaction.
