import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bootIntegrationApp, createApiHarness } from './helpers.js';
import { runScoringOpsCases } from './scoring-ops.cases.js';

const run = process.env.TADSCORE_INTEGRATION === '1' && process.env.DATABASE_URL;
const describeIf = run ? describe : describe.skip;

describeIf.sequential('API integration', () => {
  let app: Awaited<ReturnType<typeof import('../app.js').buildApp>>;
  let pool: typeof import('../lib/db.js').pool;
  let api: ReturnType<typeof createApiHarness>;
  let ownerCookie: string;
  let adminCookie: string;
  let scorerCookie: string;
  let viewerCookie: string;
  let workspaceId: string;
  let teams: Array<{ id: string }>;

  beforeAll(async () => {
    ({ app, pool, api } = await bootIntegrationApp());
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  test('auth, invitations, and RBAC', async () => {
    const { createWorkspace, invite, login, register, request } = api;
    expect((await request('GET', '/health')).statusCode).toBe(200);
    expect((await request('GET', '/api/docs/json')).statusCode).toBe(200);

    await register('otp-it@example.test', 'otpit', 'otp');
    await register('link-it@example.test', 'linkit', 'link');
    const owner = await register('owner-it@example.test', 'ownerit');
    const admin = await register('admin-it@example.test', 'adminit');
    const scorer = await register('scorer-it@example.test', 'scorerit');
    const viewer = await register('viewer-it@example.test', 'viewerit');
    const outsider = await register('outsider-it@example.test', 'outsiderit');
    await pool.query("UPDATE users SET global_role='super_admin' WHERE id=$1", [owner.id]);

    ownerCookie = await login(owner.email);
    adminCookie = await login(admin.username);
    scorerCookie = await login(scorer.email);
    viewerCookie = await login(viewer.email);
    const outsiderCookie = await login(outsider.email);
    expect((await request('GET', '/api/admin/users', undefined, ownerCookie)).statusCode).toBe(200);
    expect((await request('GET', '/api/admin/users', undefined, viewerCookie)).statusCode).toBe(
      403,
    );

    workspaceId = (await createWorkspace(ownerCookie)).id;
    for (const [role, email, cookie] of [
      ['admin', admin.email, adminCookie],
      ['scorer', scorer.email, scorerCookie],
      ['viewer', viewer.email, viewerCookie],
    ] as const) {
      const created = await invite(workspaceId, ownerCookie, role, email);
      expect(created.maxUses).toBe(1);
      const accepted = await request(
        'POST',
        `/api/invitations/${created.token}/accept`,
        {},
        cookie,
      );
      expect(accepted.statusCode).toBe(200);
    }
    const share = await invite(workspaceId, ownerCookie, 'viewer');
    expect(share.maxUses).toBe(3);
    expect(
      (await request('POST', `/api/invitations/${share.token}/accept`, {}, outsiderCookie))
        .statusCode,
    ).toBe(200);

    const workspaceRes = await request(
      'GET',
      `/api/workspaces/${workspaceId}`,
      undefined,
      viewerCookie,
    );
    expect(workspaceRes.json().data.memberCount).toBe(5);
    teams = (
      await request('GET', `/api/workspaces/${workspaceId}/teams`, undefined, viewerCookie)
    ).json().data as Array<{ id: string }>;
    expect(teams).toHaveLength(4);

    const teamPath = `/api/workspaces/${workspaceId}/teams`;
    const extraTeam = await request(
      'POST',
      teamPath,
      { code: 'extra', name: 'Extra', displayName: 'Nhà Extra', sortOrder: 5, color: '#111827' },
      adminCookie,
    );
    expect(extraTeam.statusCode).toBe(201);
    const extraId = extraTeam.json().data.id as string;
    expect(
      (
        await request(
          'PATCH',
          `${teamPath}/${extraId}`,
          { displayName: 'Nhà Extra 2' },
          adminCookie,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await request('DELETE', `${teamPath}/${extraId}`, undefined, adminCookie)).statusCode,
    ).toBe(204);
    teams = (await request('GET', teamPath, undefined, viewerCookie)).json().data;
    expect(teams).toHaveLength(4);

    const membersPath = `/api/workspaces/${workspaceId}/members`;
    const membersBefore = (await request('GET', membersPath, undefined, ownerCookie)).json()
      .data as Array<{ id: string; email: string; role: string; status: string }>;
    expect(membersBefore.some((m) => m.email === outsider.email)).toBe(true);
    const outsiderMember = membersBefore.find((m) => m.email === outsider.email)!;
    expect(
      (await request('DELETE', `${membersPath}/${outsiderMember.id}`, undefined, ownerCookie))
        .statusCode,
    ).toBe(204);
    const membersAfter = (await request('GET', membersPath, undefined, ownerCookie)).json()
      .data as Array<{ id: string; email: string }>;
    expect(membersAfter.some((m) => m.email === outsider.email)).toBe(false);
    expect(
      (await request('DELETE', `${membersPath}/${outsiderMember.id}`, undefined, ownerCookie))
        .statusCode,
    ).toBe(404);
    expect(
      (await request('GET', `/api/workspaces/${workspaceId}`, undefined, outsiderCookie))
        .statusCode,
    ).toBe(403);
    expect(
      (await request('POST', `/api/workspaces/${workspaceId}/invitations`, {}, scorerCookie))
        .statusCode,
    ).toBe(403);
  });

  test('scoring, public privacy, idempotency, and operations', async () => {
    await runScoringOpsCases({
      api,
      ownerCookie,
      adminCookie,
      scorerCookie,
      viewerCookie,
      workspaceId,
      teams,
    });
  });
});
