import { describe, expect, it } from 'vitest';
import { parseArgs } from './account-create.js';

describe('account:create arguments', () => {
  it('parses explicit account fields', () => {
    expect(parseArgs(['--email', 'a@b.co', '--role', 'super_admin', '--password-stdin'])).toEqual({
      email: 'a@b.co',
      role: 'super_admin',
      'password-stdin': true,
    });
  });
  it('rejects missing values', () => {
    expect(() => parseArgs(['--email'])).toThrow('Missing value');
  });
});
