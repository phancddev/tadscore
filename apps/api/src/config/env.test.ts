import { afterEach, describe, expect, it } from 'vitest';
import { env, resetEnvForTest } from './env.js';

describe('email verification configuration', () => {
  const original = process.env.AUTH_EMAIL_VERIFICATION_MODE;
  afterEach(() => {
    process.env.AUTH_EMAIL_VERIFICATION_MODE = original;
    resetEnvForTest();
  });
  it.each(['off', 'otp', 'link'] as const)('supports %s mode', (mode) => {
    process.env.AUTH_EMAIL_VERIFICATION_MODE = mode;
    resetEnvForTest();
    expect(env().AUTH_EMAIL_VERIFICATION_MODE).toBe(mode);
  });
  it('rejects invalid modes', () => {
    process.env.AUTH_EMAIL_VERIFICATION_MODE = 'maybe';
    resetEnvForTest();
    expect(() => env()).toThrow();
  });
});
