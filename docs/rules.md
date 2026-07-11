# Rule configuration

TadScore treats rules as versioned code. The API loads JSON files from `rule-config`, validates
them with `packages/rule-engine`, and snapshots the selected rule into each workspace at creation
time. Existing workspaces do not silently change when a rule file is edited later.

## HOH 2026

The bundled rule is `rule-config/hoh-2026/rule.json`:

- `id`: `hoh-2026`
- `version`: `1.0.0`
- `teamCount`: 4
- activities: five warm-ups, five midterms, two big games
- shop: `piece` and `item`
- ranking: teams with at least four pieces rank ahead of ineligible teams

The rule file also records assumptions that resolve source discrepancies. For HOH 2026, the Excel
sample is treated as authoritative where it conflicts with the PDF: warm-up first place is 14
medals, not the PDF example value 140. The file also documents the final award total and tie-break
ordering.

## Schema shape

A rule definition must include:

- stable `id`, semantic-ish `version`, display `name`, and fixed `teamCount`;
- ordered `activities` with unique `key`, `sequence`, `type`, medal awards, piece awards, and
  optional phase metadata;
- `adjustments` for speech and violation values;
- `shop` entries with medal cost and ledger deltas;
- `constraints`, including phase limits for piece purchases;
- deterministic `ranking` rules;
- `assumptions` for source notes and decisions.

The rule engine validates this shape and exposes pure helpers for activity awards, purchase costs,
and ranking. API routes never trust client-supplied award values; they derive every ledger delta
from the workspace rule snapshot.

## Versioning

Do not mutate a deployed rule version to change event math. Add a new version instead:

1. Copy the rule directory or add a new JSON file under `rule-config/<rule-id>/`.
2. Bump `version` and update assumptions.
3. Add or update rule-engine tests for awards, purchase constraints, and ranking.
4. Run validation, unit tests, and API integration tests.
5. Deploy with migration-free code if schema is unchanged.

If a running event needs a correction, prefer operational reversals or adjustments in the workspace
ledger. Only create a new rule version when future workspaces should use different rules.

## Adding a rule safely

1. Keep source artifacts in `rule/` or `samples/` and reference them from the rule README.
2. Encode the smallest deterministic rule needed by the API.
3. Document every ambiguous source decision in `assumptions`.
4. Confirm `teamCount` matches default team creation needs.
5. Verify activity keys are stable; clients and idempotency history rely on them.
6. Run:

```bash
npx -y pnpm@10.13.1 --filter @tadscore/rule-engine test
npx -y pnpm@10.13.1 --filter @tadscore/api test
```

7. Create a test workspace through the API and inspect activities, teams, ranking, and purchases.

Never use a rule edit to repair historical scores. Scores are append-only ledger entries; history is
corrected with reversal entries and explicit audit trails.
