import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.restoreAllMocks());

function respond(data: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('API adapter', () => {
  it('normalizes snake_case user fields and unwraps the user envelope', async () => {
    respond({
      user: {
        id: 'u1',
        email: 'a@example.test',
        username: 'alice',
        full_name: 'Alice',
        global_role: 'super_admin',
        status: 'active',
        email_verified_at: '2026-01-01',
      },
    });
    const user = await api.auth.me();
    expect(user).toMatchObject({
      fullName: 'Alice',
      globalRole: 'super_admin',
      emailVerifiedAt: '2026-01-01',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('unwraps paginated admin collections', async () => {
    respond({ items: [{ id: 'u1', full_name: 'Alice', global_role: 'user' }], total: 1 });
    await expect(api.admin.users()).resolves.toEqual([
      expect.objectContaining({ fullName: 'Alice', globalRole: 'user' }),
    ]);
  });

  it('surfaces canonical API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Không có quyền' } }), {
        status: 403,
      }),
    );
    await expect(api.rules.list()).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Không có quyền',
    });
  });
});
