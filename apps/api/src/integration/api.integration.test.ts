import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createApiHarness } from './helpers.js';

const run = process.env.TADSCORE_INTEGRATION === '1' && process.env.DATABASE_URL;
const describeIf = run ? describe : describe.skip;

describeIf.sequential('API integration', () => {
  let app: Awaited<ReturnType<typeof import('../app.js').buildApp>>;
  let pool: typeof import('../lib/db.js').pool;
  let resetEnvForTest: typeof import('../config/env.js').resetEnvForTest;
  let api: ReturnType<typeof createApiHarness>;
  let ownerCookie: string;
  let adminCookie: string;
  let scorerCookie: string;
  let viewerCookie: string;
  let workspaceId: string;
  let teams: Array<{ id: string }>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.WEB_ORIGIN = 'http://localhost:1107';
    process.env.RULE_CONFIG_PATH = join(process.cwd(), '../../rule-config');
    process.env.UPLOAD_DIR = '/tmp/tadscore-api-it';
    process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS = '0';
    ({ resetEnvForTest } = await import('../config/env.js'));
    resetEnvForTest();
    ({ pool } = await import('../lib/db.js'));
    const { buildApp } = await import('../app.js');
    app = await buildApp();
    api = createApiHarness(app, pool, resetEnvForTest);
    await pool.query(`
      TRUNCATE audit_logs,email_outbox,public_ranking_links,invitation_acceptances,
      workspace_invitations,team_inventory,purchases,score_ledger,activity_results,
      result_submissions,activities,teams,workspace_members,workspaces,email_verifications,
      auth_sessions,auth_rate_limits,users RESTART IDENTITY CASCADE
    `);
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
    expect(
      (await request('POST', `/api/workspaces/${workspaceId}/invitations`, {}, scorerCookie))
        .statusCode,
    ).toBe(403);
  });

  test('scoring, public privacy, idempotency, and operations', async () => {
    const { request } = api;
    const base = `/api/workspaces/${workspaceId}`;
    const gameBody = {
      activityKey: 'warmup-1',
      idempotencyKey: 'game-one',
      results: teams.map((team, index) => ({ teamId: team.id, rank: index + 1 })),
    };
    const post = (path: string, body: unknown, cookie: string) =>
      request('POST', path, body, cookie);
    expect((await post(`${base}/games`, gameBody, viewerCookie)).statusCode).toBe(403);
    const game = await post(`${base}/games`, gameBody, scorerCookie);
    expect(game.statusCode).toBe(201);
    expect((await post(`${base}/games`, gameBody, scorerCookie)).statusCode).toBe(200);
    expect(
      (await post(`${base}/games`, { ...gameBody, activityKey: 'warmup-2' }, scorerCookie))
        .statusCode,
    ).toBe(409);

    const teamId = teams[0]!.id;
    const adjust = (body: object, cookie: string) => post(`${base}/adjustments`, body, cookie);
    expect(
      (
        await adjust(
          {
            teamId,
            kind: 'manual',
            medalDelta: 1,
            reason: 'manual',
            idempotencyKey: 'viewer-manual',
          },
          viewerCookie,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await adjust(
          {
            teamId,
            kind: 'manual',
            medalDelta: -2,
            reason: 'manual minus',
            idempotencyKey: 'scorer-manual-minus',
          },
          scorerCookie,
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await adjust(
          {
            teamId,
            kind: 'manual',
            medalDelta: 128,
            reason: 'grant',
            idempotencyKey: 'grant-piece',
          },
          adminCookie,
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await post(
          `${base}/purchases`,
          { teamId, itemKey: 'piece', quantity: 2, idempotencyKey: 'piece-too-many' },
          scorerCookie,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await post(
          `${base}/purchases`,
          { teamId, itemKey: 'piece', quantity: 1, idempotencyKey: 'piece-one' },
          scorerCookie,
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (await request('GET', `${base}/ranking`, undefined, viewerCookie)).json().data.teams[0]
        .medals,
    ).toBe(0);

    const publicSlug = `pub-${Date.now().toString(36)}`;
    const publicLink = await post(
      `${base}/public-links`,
      { label: 'public', slug: publicSlug },
      ownerCookie,
    );
    expect(publicLink.statusCode).toBe(201);
    const publicToken = publicLink.json().data.token as string;
    const publicLinkId = publicLink.json().data.id as string;
    expect(publicLink.json().data.slugUrl).toBe(`/ranking/${publicSlug}`);
    // Create-once: second POST returns the same link (does not insert another row).
    const again = await post(`${base}/public-links`, { label: 'ignored' }, ownerCookie);
    expect(again.statusCode).toBe(200);
    expect(again.json().data.id).toBe(publicLinkId);
    expect(again.json().data.token).toBe(publicToken);
    // Token is re-displayed on list without regenerate.
    const listed = await request('GET', `${base}/public-links`, undefined, ownerCookie);
    expect(listed.json().data).toHaveLength(1);
    expect(listed.json().data[0].token).toBe(publicToken);
    expect((await request('GET', `/api/public/rankings/${publicToken}`)).statusCode).toBe(200);
    expect((await request('GET', `/api/public/rankings/${publicSlug}`)).statusCode).toBe(200);
    const publicTeam = await request('GET', `/api/public/rankings/${publicToken}/teams/${teamId}`);
    expect(publicTeam.statusCode).toBe(200);
    expect(Array.isArray(publicTeam.json().data.wins)).toBe(true);
    expect(publicTeam.json().data.ledger[0]).toHaveProperty('activityRank');
    expect(JSON.stringify(publicTeam.json())).not.toMatch(
      /createdByName|"metadata"|@example\.test/,
    );
    // Independent visibility: token private keeps slug public, and vice versa.
    expect(
      (
        await request(
          'PATCH',
          `${base}/public-links/${publicLinkId}`,
          { tokenEnabled: false },
          ownerCookie,
        )
      ).statusCode,
    ).toBe(200);
    expect((await request('GET', `/api/public/rankings/${publicToken}`)).statusCode).toBe(404);
    expect((await request('GET', `/api/public/rankings/${publicSlug}`)).statusCode).toBe(200);
    expect(
      (
        await request(
          'PATCH',
          `${base}/public-links/${publicLinkId}`,
          { tokenEnabled: true, slugEnabled: false },
          ownerCookie,
        )
      ).statusCode,
    ).toBe(200);
    expect((await request('GET', `/api/public/rankings/${publicToken}`)).statusCode).toBe(200);
    expect((await request('GET', `/api/public/rankings/${publicSlug}`)).statusCode).toBe(404);
    expect(
      (
        await request(
          'PATCH',
          `${base}/public-links/${publicLinkId}`,
          { slugEnabled: true },
          ownerCookie,
        )
      ).statusCode,
    ).toBe(200);
    expect((await request('GET', `/api/public/rankings/${publicSlug}`)).statusCode).toBe(200);
    const regenerated = await post(
      `${base}/public-links/${publicLinkId}/regenerate`,
      {},
      ownerCookie,
    );
    expect(regenerated.statusCode).toBe(200);
    const newToken = regenerated.json().data.token as string;
    expect(newToken).not.toBe(publicToken);
    expect(regenerated.json().data.slug).toBe(publicSlug);
    expect((await request('GET', `/api/public/rankings/${publicToken}`)).statusCode).toBe(404);
    expect((await request('GET', `/api/public/rankings/${newToken}`)).statusCode).toBe(200);
    expect((await request('GET', `/api/public/rankings/${publicSlug}`)).statusCode).toBe(200);
    expect(
      (
        await request(
          'DELETE',
          `${base}/public-links/${publicLinkId}`,
          undefined,
          ownerCookie,
        )
      ).statusCode,
    ).toBe(204);
    expect((await request('GET', `/api/public/rankings/${newToken}`)).statusCode).toBe(404);
    expect((await request('GET', `/api/public/rankings/${publicSlug}`)).statusCode).toBe(404);

    const secondGame = await post(
      `${base}/games`,
      { ...gameBody, activityKey: 'warmup-2', idempotencyKey: 'game-two' },
      scorerCookie,
    );
    expect(secondGame.statusCode).toBe(201);
    const reversePath = `${base}/games/${game.json().data.id}/reverse`;
    expect(
      (
        await post(
          reversePath,
          { reason: 'mistake', idempotencyKey: 'reverse-game-1' },
          adminCookie,
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await post(
          reversePath,
          { reason: 'mistake', idempotencyKey: 'reverse-game-1' },
          adminCookie,
        )
      ).statusCode,
    ).toBe(200);
    const reverseConflict = await post(
      `${base}/games/${secondGame.json().data.id}/reverse`,
      { reason: 'mistake', idempotencyKey: 'reverse-game-1' },
      adminCookie,
    );
    expect(reverseConflict.statusCode).toBe(409);
    expect(reverseConflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');

    await request('PATCH', base, { status: 'locked' }, ownerCookie);
    expect((await request('GET', `${base}/ranking`, undefined, viewerCookie)).statusCode).toBe(200);
    expect(
      (
        await adjust(
          { teamId, kind: 'speech', medalDelta: 1, reason: 'speech', idempotencyKey: 'locked-key' },
          scorerCookie,
        )
      ).statusCode,
    ).toBe(409);
    await request('PATCH', base, { status: 'archived' }, ownerCookie);
    expect((await request('GET', `${base}/export.json`, undefined, viewerCookie)).statusCode).toBe(
      200,
    );
    expect(
      (await request('GET', '/api/admin/audit-logs', undefined, ownerCookie)).json().data.total,
    ).toBeGreaterThan(0);
    expect(
      (await request('GET', '/api/admin/outbox', undefined, ownerCookie)).json().data.total,
    ).toBeGreaterThan(0);
    expect((await request('GET', '/api/admin/health', undefined, ownerCookie)).statusCode).toBe(
      200,
    );
  });
});
