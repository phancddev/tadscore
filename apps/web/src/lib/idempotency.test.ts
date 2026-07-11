import { describe, expect, it } from 'vitest';
import { createIdempotencyKey } from './idempotency';

describe('createIdempotencyKey', () => {
  it('uses native randomUUID when available', () => {
    const native = '123e4567-e89b-42d3-a456-426614174000';
    const getRandomValues = () => {
      throw new Error('fallback must not run');
    };

    expect(createIdempotencyKey({ randomUUID: () => native, getRandomValues })).toBe(native);
  });

  it('creates a strong UUID v4 when randomUUID is unavailable on an HTTP origin', () => {
    const key = createIdempotencyKey({
      getRandomValues: (bytes) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });

    expect(key).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('fails clearly instead of using weak randomness', () => {
    expect(() => createIdempotencyKey({})).toThrow(
      'Trình duyệt không hỗ trợ bộ sinh số ngẫu nhiên an toàn.',
    );
  });
});
