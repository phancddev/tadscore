import { describe, expect, it } from 'vitest';
import { buildAwardPreviewRows } from './awardPreview';
import { ranksValid } from './RankEntry';
import type { Team } from '../../lib/types';

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

describe('rank award preview integration', () => {
  const teams: Team[] = [
    {
      id: 'a',
      teamId: 'a',
      name: 'A',
      displayName: 'Team A',
      medals: 0,
      pieces: 0,
      items: 0,
      eligible: true,
      rank: 0,
    },
    {
      id: 'b',
      teamId: 'b',
      name: 'B',
      displayName: 'Team B',
      medals: 0,
      pieces: 0,
      items: 0,
      eligible: true,
      rank: 0,
    },
  ];

  it('preview is ready when ranksValid and mirrors warmup-style awards', () => {
    const ranks = { a: 1, b: 2 };
    expect(ranksValid(ranks, ['a', 'b'])).toBe(true);
    const rows = buildAwardPreviewRows(teams, ranks, [14, 7], [0, 0]);
    expect(rows).toEqual([
      { teamId: 'a', teamName: 'Team A', rank: 1, medals: 14, pieces: 0 },
      { teamId: 'b', teamName: 'Team B', rank: 2, medals: 7, pieces: 0 },
    ]);
  });
});
