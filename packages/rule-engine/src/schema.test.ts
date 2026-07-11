import { describe, expect, it } from 'vitest';
import fixture from '../../../rule-config/hoh-2026/rule.json' with { type: 'json' };
import { ruleDefinitionSchema } from './schema.js';

describe('rule definition invariants', () => {
  it('accepts the shipped HOH rule', () => {
    expect(ruleDefinitionSchema.safeParse(fixture).success).toBe(true);
  });

  it('rejects award counts that differ from teamCount', () => {
    const changed = structuredClone(fixture);
    changed.activities[0]!.medalAwards = [14, 7];
    expect(ruleDefinitionSchema.safeParse(changed).success).toBe(false);
  });

  it('rejects duplicate activity keys and non-negative violations', () => {
    const changed = structuredClone(fixture);
    changed.activities[1]!.key = changed.activities[0]!.key;
    changed.adjustments.violations = [-1, 2, -5];
    const parsed = ruleDefinitionSchema.safeParse(changed);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.length).toBeGreaterThanOrEqual(2);
  });
});
