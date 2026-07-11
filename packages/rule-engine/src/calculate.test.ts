import { describe, expect, it } from 'vitest';
import { activityAward, purchaseCost, rankTeams } from './calculate.js';
import type { RuleDefinition } from './schema.js';
import fixture from '../../../rule-config/hoh-2026/rule.json' with { type: 'json' };

const rule = fixture as RuleDefinition;
describe('HOH rule', () => {
  it('awards ranked games and shop costs', () => {
    expect(activityAward(rule, 'warmup-1', 1)).toEqual({ medals: 14, pieces: 0 });
    expect(activityAward(rule, 'big-game-2', 2)).toEqual({ medals: 60, pieces: 1 });
    expect(purchaseCost(rule, 'piece', 2).medalCost).toBe(280);
  });
  it('allows dynamic team counts with zero awards beyond the table', () => {
    expect(activityAward(rule, 'warmup-1', 5, 5)).toEqual({ medals: 0, pieces: 0 });
    expect(activityAward(rule, 'warmup-1', 3, 3)).toEqual({ medals: 4, pieces: 0 });
    expect(() => activityAward(rule, 'warmup-1', 4, 3)).toThrow(/Rank out of range/);
  });
  it('ranks eligible first and breaks ties deterministically', () => {
    const result = rankTeams(rule, [
      { teamId: 'b', name: 'Mai', medals: 999, pieces: 3, items: 0 },
      { teamId: 'a', name: 'Lan', medals: 10, pieces: 4, items: 0 },
      { teamId: 'c', name: 'Cúc', medals: 20, pieces: 4, items: 0 },
    ]);
    expect(result.map((x) => x.name)).toEqual(['Cúc', 'Lan', 'Mai']);
  });
});
