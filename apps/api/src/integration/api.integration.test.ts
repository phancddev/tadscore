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

    const teamLimit = await request(
      'POST',
      `/api/workspaces/${workspaceId}/teams`,
      { code: 'extra', name: 'Extra', displayName: 'Extra', sortOrder: 5 },
      adminCookie,
    );
    expect(teamLimit.statusCode).toBe(409);
    expect(teamLimit.json().error.code).toBe('TEAM_LIMIT');
    expect(
      (await request('POST', `/api/workspaces/${workspaceId}/invitations`, {}, scorerCookie))
        .statusCode,
    ).toBe(403);
  });

  test('scoring, public privacy, idempotency, and operations', async () => {
    const { request } = api;
    const gameBody = {
      activityKey: 'warmup-1',
      idempotencyKey: 'game-one',
      results: teams.map((team, index) => ({ teamId: team.id, rank: index + 1 })),
    };
    expect(
      (await request('POST', `/api/workspaces/${workspaceId}/games`, gameBody, viewerCookie))
        .statusCode,
    ).toBe(403);
    const game = await request(
      'POST',
      `/api/workspaces/${workspaceId}/games`,
      gameBody,
      scorerCookie,
    );
    expect(game.statusCode).toBe(201);
    expect(
      (await request('POST', `/api/workspaces/${workspaceId}/games`, gameBody, scorerCookie))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          'POST',
          `/api/workspaces/${workspaceId}/games`,
          { ...gameBody, activityKey: 'warmup-2' },
          scorerCookie,
        )
      ).statusCode,
    ).toBe(409);

    const teamId = teams[0]!.id;
    expect(
      (
        await request(
          'POST',
          `/api/workspaces/${workspaceId}/adjustments`,
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
    const grant = await request(
      'POST',
      `/api/workspaces/${workspaceId}/adjustments`,
      { teamId, kind: 'manual', medalDelta: 126, reason: 'grant', idempotencyKey: 'grant-piece' },
      adminCookie,
    );
    expect(grant.statusCode).toBe(201);
    expect(
      (
        await request(
          'POST',
          `/api/workspaces/${workspaceId}/purchases`,
          { teamId, itemKey: 'piece', quantity: 2, idempotencyKey: 'piece-too-many' },
          scorerCookie,
        )
      ).statusCode,
    ).toBe(409);
    const purchase = await request(
      'POST',
      `/api/workspaces/${workspaceId}/purchases`,
      { teamId, itemKey: 'piece', quantity: 1, idempotencyKey: 'piece-one' },
      scorerCookie,
    );
    expect(purchase.statusCode).toBe(201);

    const ranking = await request(
      'GET',
      `/api/workspaces/${workspaceId}/ranking`,
      undefined,
      viewerCookie,
    );
    expect(ranking.json().data.teams[0].medals).toBe(0);
    const publicLink = await request(
      'POST',
      `/api/workspaces/${workspaceId}/public-links`,
      { label: 'public' },
      ownerCookie,
    );
    const publicToken = publicLink.json().data.token;
    expect((await request('GET', `/api/public/rankings/${publicToken}`)).statusCode).toBe(200);
    const publicTeam = await request('GET', `/api/public/rankings/${publicToken}/teams/${teamId}`);
    expect(publicTeam.statusCode).toBe(200);
    const publicTeamText = JSON.stringify(publicTeam.json());
    expect(publicTeamText).not.toContain('createdByName');
    expect(publicTeamText).not.toContain('metadata');
    expect(publicTeamText).not.toContain('@example.test');
    expect(
      (
        await request(
          'DELETE',
          `/api/workspaces/${workspaceId}/public-links/${publicLink.json().data.id}`,
          undefined,
          ownerCookie,
        )
      ).statusCode,
    ).toBe(204);
    expect((await request('GET', `/api/public/rankings/${publicToken}`)).statusCode).toBe(404);

    const secondGame = await request(
      'POST',
      `/api/workspaces/${workspaceId}/games`,
      { ...gameBody, activityKey: 'warmup-2', idempotencyKey: 'game-two' },
      scorerCookie,
    );
    expect(secondGame.statusCode).toBe(201);
    const reversed = await request(
      'POST',
      `/api/workspaces/${workspaceId}/games/${game.json().data.id}/reverse`,
      { reason: 'mistake', idempotencyKey: 'reverse-game-1' },
      adminCookie,
    );
    expect(reversed.statusCode).toBe(201);
    expect(
      (
        await request(
          'POST',
          `/api/workspaces/${workspaceId}/games/${game.json().data.id}/reverse`,
          { reason: 'mistake', idempotencyKey: 'reverse-game-1' },
          adminCookie,
        )
      ).statusCode,
    ).toBe(200);
    const reverseConflict = await request(
      'POST',
      `/api/workspaces/${workspaceId}/games/${secondGame.json().data.id}/reverse`,
      { reason: 'mistake', idempotencyKey: 'reverse-game-1' },
      adminCookie,
    );
    expect(reverseConflict.statusCode).toBe(409);
    expect(reverseConflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');

    await request('PATCH', `/api/workspaces/${workspaceId}`, { status: 'locked' }, ownerCookie);
    expect(
      (await request('GET', `/api/workspaces/${workspaceId}/ranking`, undefined, viewerCookie))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          'POST',
          `/api/workspaces/${workspaceId}/adjustments`,
          {
            teamId,
            kind: 'speech',
            medalDelta: 1,
            reason: 'speech',
            idempotencyKey: 'locked-key',
          },
          scorerCookie,
        )
      ).statusCode,
    ).toBe(409);
    await request('PATCH', `/api/workspaces/${workspaceId}`, { status: 'archived' }, ownerCookie);
    expect(
      (await request('GET', `/api/workspaces/${workspaceId}/export.json`, undefined, viewerCookie))
        .statusCode,
    ).toBe(200);

    const audit = await request('GET', '/api/admin/audit-logs', undefined, ownerCookie);
    expect(audit.json().data.total).toBeGreaterThan(0);
    const outbox = await request('GET', '/api/admin/outbox', undefined, ownerCookie);
    expect(outbox.json().data.total).toBeGreaterThan(0);
    expect((await request('GET', '/api/admin/health', undefined, ownerCookie)).statusCode).toBe(
      200,
    );
  });
});
