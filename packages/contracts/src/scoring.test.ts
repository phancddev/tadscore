import { describe, expect, it } from 'vitest';
import { validateRankPermutation } from './scoring.js';

describe('validateRankPermutation', () => {
  it('requires every rank exactly once', () => {
    expect(validateRankPermutation([4, 2, 1, 3], 4)).toBe(true);
    expect(validateRankPermutation([1, 2, 2, 4], 4)).toBe(false);
  });
});
