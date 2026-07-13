import { describe, expect, it } from 'vitest';
import { adjustmentSchema, reversalSchema, validateRankPermutation } from './scoring.js';

describe('validateRankPermutation', () => {
  it('requires every rank exactly once', () => {
    expect(validateRankPermutation([4, 2, 1, 3], 4)).toBe(true);
    expect(validateRankPermutation([1, 2, 2, 4], 4)).toBe(false);
  });
});

describe('reversalSchema', () => {
  const key = 'idempotency-key-1';

  it('allows missing or empty reason', () => {
    expect(reversalSchema.parse({ idempotencyKey: key })).toEqual({
      reason: '',
      idempotencyKey: key,
    });
    expect(reversalSchema.parse({ reason: '', idempotencyKey: key })).toEqual({
      reason: '',
      idempotencyKey: key,
    });
    expect(reversalSchema.parse({ reason: '   ', idempotencyKey: key })).toEqual({
      reason: '',
      idempotencyKey: key,
    });
  });

  it('trims and accepts a provided reason up to 500 chars', () => {
    expect(reversalSchema.parse({ reason: '  oops  ', idempotencyKey: key }).reason).toBe('oops');
    expect(
      reversalSchema.parse({ reason: 'x'.repeat(500), idempotencyKey: key }).reason,
    ).toHaveLength(500);
  });

  it('rejects reason longer than 500', () => {
    expect(() => reversalSchema.parse({ reason: 'x'.repeat(501), idempotencyKey: key })).toThrow();
  });
});

describe('adjustmentSchema reason still required', () => {
  it('rejects empty or short reason', () => {
    const base = {
      teamId: '00000000-0000-4000-8000-000000000001',
      kind: 'manual' as const,
      medalDelta: 1,
      idempotencyKey: 'idempotency-key-1',
    };
    expect(() => adjustmentSchema.parse({ ...base, reason: '' })).toThrow();
    expect(() => adjustmentSchema.parse({ ...base, reason: 'x' })).toThrow();
    expect(adjustmentSchema.parse({ ...base, reason: 'ok' }).reason).toBe('ok');
  });
});
