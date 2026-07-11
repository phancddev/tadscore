import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

export const password = 'TestPass123!';

type InjectResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  json(): any;
};

export function createApiHarness(
  app: { inject(input: object): Promise<unknown> },
  pool: {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  },
  resetEnvForTest: () => void,
) {
  async function request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    cookie?: string,
  ): Promise<InjectResponse> {
    return (await app.inject({
      method,
      url,
      headers: cookie ? { cookie } : undefined,
      payload: body as Record<string, unknown> | undefined,
    })) as InjectResponse;
  }

  async function register(email: string, username: string, mode = 'off') {
    process.env.AUTH_EMAIL_VERIFICATION_MODE = mode;
    resetEnvForTest();
    const res = await request('POST', '/api/auth/register', {
      email,
      username,
      fullName: username,
      password,
    });
    expect(res.statusCode).toBe(201);
    if (mode !== 'off') {
      const outbox = await pool.query<{ payload: { code?: string; token?: string } }>(
        'SELECT payload FROM email_outbox WHERE to_email=$1 ORDER BY created_at DESC LIMIT 1',
        [email],
      );
      const payload = outbox.rows[0]!.payload;
      const verify = await request('POST', '/api/auth/verify', {
        email,
        code: payload.code,
        token: payload.token,
      });
      expect(verify.statusCode).toBe(200);
    }
    process.env.AUTH_EMAIL_VERIFICATION_MODE = 'off';
    resetEnvForTest();
    return res.json().data.user as { id: string; email: string; username: string };
  }

  async function login(identifier: string) {
    const res = await request('POST', '/api/auth/login', { identifier, password });
    expect(res.statusCode).toBe(200);
    return res.headers['set-cookie']!.toString().split(';')[0]!;
  }

  async function createWorkspace(cookie: string) {
    const slug = `it-${randomUUID().slice(0, 8)}`;
    const res = await request(
      'POST',
      '/api/workspaces',
      {
        name: 'Integration Workspace',
        slug,
        ruleId: 'hoh-2026',
        ruleVersion: '1.0.0',
      },
      cookie,
    );
    expect(res.statusCode).toBe(201);
    return res.json().data as { id: string };
  }

  async function invite(workspaceId: string, cookie: string, role: string, email?: string) {
    const res = await request(
      'POST',
      `/api/workspaces/${workspaceId}/invitations`,
      {
        kind: email ? 'email' : 'share_link',
        email,
        role,
        expiresInHours: 24,
        maxUses: 3,
      },
      cookie,
    );
    expect(res.statusCode).toBe(201);
    return res.json().data as { id: string; token: string; maxUses: number };
  }

  return { createWorkspace, invite, login, register, request };
}
