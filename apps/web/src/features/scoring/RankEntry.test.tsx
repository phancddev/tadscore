import { describe, expect, it } from 'vitest';
import { ranksValid } from './RankEntry';

describe('ranksValid', () => {
  const teams = ['lan', 'mai', 'cuc', 'truc'];

  it('accepts a complete rank permutation', () => {
    expect(ranksValid({ lan: 2, mai: 1, cuc: 4, truc: 3 }, teams)).toBe(true);
  });

  it('rejects duplicate or missing ranks', () => {
    expect(ranksValid({ lan: 1, mai: 1, cuc: 3, truc: 4 }, teams)).toBe(false);
    expect(ranksValid({ lan: 1, mai: 2, cuc: 3 }, teams)).toBe(false);
  });

  it('supports rule-defined team counts', () => {
    expect(ranksValid({ a: 1, b: 3, c: 2 }, ['a', 'b', 'c'])).toBe(true);
  });
});
