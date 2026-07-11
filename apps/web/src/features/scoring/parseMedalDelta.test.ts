import { describe, expect, it } from 'vitest';
import { parseMedalDelta } from './parseMedalDelta';

describe('parseMedalDelta', () => {
  it('accepts signed integers', () => {
    expect(parseMedalDelta('+5')).toEqual({ ok: true, value: 5 });
    expect(parseMedalDelta('-2')).toEqual({ ok: true, value: -2 });
    expect(parseMedalDelta('−3')).toEqual({ ok: true, value: -3 });
    expect(parseMedalDelta('10')).toEqual({ ok: true, value: 10 });
  });

  it('rejects invalid input', () => {
    expect(parseMedalDelta('').ok).toBe(false);
    expect(parseMedalDelta('0').ok).toBe(false);
    expect(parseMedalDelta('+').ok).toBe(false);
    expect(parseMedalDelta('1.5').ok).toBe(false);
    expect(parseMedalDelta('abc').ok).toBe(false);
  });
});
