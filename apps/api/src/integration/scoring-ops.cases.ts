import { expect } from 'vitest';
import type { ApiHarness } from './helpers.js';
import { runGameReverseAndReplaceCases, runReverseCases } from './scoring-ops-reverse.cases.js';

type Ctx = {
  api: ApiHarness;
  ownerCookie: string;
  adminCookie: string;
  scorerCookie: string;
  viewerCookie: string;
  workspaceId: string;
  teams: Array<{ id: string }>;
};

/** Scoring, public privacy, idempotency, lock/archive, and admin ops assertions. */
export async function runScoringOpsCases(ctx: Ctx) {
  const { request } = ctx.api;
  const { ownerCookie, adminCookie, scorerCookie, viewerCookie, workspaceId, teams } = ctx;
  const base = `/api/workspaces/${workspaceId}`;
  const gameBody = {
    activityKey: 'warmup-1',
    idempotencyKey: 'game-one',
    results: teams.map((team, index) => ({ teamId: team.id, rank: index + 1 })),
  };
  const post = (path: string, body: unknown, cookie: string) => request('POST', path, body, cookie);
  expect((await post(`${base}/games`, gameBody, viewerCookie)).statusCode).toBe(403);
  const game = await post(`${base}/games`, gameBody, scorerCookie);
  expect(game.statusCode).toBe(201);
  expect((await post(`${base}/games`, gameBody, scorerCookie)).statusCode).toBe(200);
  expect(
    (await post(`${base}/games`, { ...gameBody, activityKey: 'warmup-2' }, scorerCookie))
      .statusCode,
  ).toBe(409);

  // Activities list exposes medalAwards from rule_snapshot (HOH2026 warmup-1).
  const activitiesRes = await request('GET', `${base}/activities`, undefined, viewerCookie);
  expect(activitiesRes.statusCode).toBe(200);
  const warmup1 = activitiesRes
    .json()
    .data.find((a: { activityKey: string }) => a.activityKey === 'warmup-1');
  expect(warmup1?.medalAwards).toEqual([14, 7, 4, 2]);

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
  const manualMinus = await adjust(
    {
      teamId,
      kind: 'manual',
      medalDelta: -2,
      reason: 'manual minus',
      idempotencyKey: 'scorer-manual-minus',
    },
    scorerCookie,
  );
  expect(manualMinus.statusCode).toBe(201);
  const manualMinusId = manualMinus.json().data.id as string;
  expect(
    (
      await request(
        'PATCH',
        `${base}/ledger/${manualMinusId}`,
        { medalDelta: 5, reason: 'flipped to plus' },
        viewerCookie,
      )
    ).statusCode,
  ).toBe(403);
  const scorerEdit = await request(
    'PATCH',
    `${base}/ledger/${manualMinusId}`,
    { medalDelta: 5, reason: 'flipped to plus' },
    scorerCookie,
  );
  expect(scorerEdit.statusCode).toBe(200);
  expect(scorerEdit.json().data.medalDelta).toBe(5);
  expect(scorerEdit.json().data.metadata.reason).toBe('flipped to plus');
  // Flip + → − and restore the original −2 so later purchase/ranking math still holds.
  const adminEdit = await request(
    'PATCH',
    `${base}/ledger/${manualMinusId}`,
    { medalDelta: -2, reason: 'admin fix minus' },
    adminCookie,
  );
  expect(adminEdit.statusCode).toBe(200);
  expect(adminEdit.json().data.medalDelta).toBe(-2);
  expect(adminEdit.json().data.metadata.reason).toBe('admin fix minus');
  const ledgerAfterEdit = await request('GET', `${base}/ledger`, undefined, viewerCookie);
  const editedRow = ledgerAfterEdit
    .json()
    .data.items.find((item: { id: string }) => item.id === manualMinusId);
  expect(editedRow?.medalDelta).toBe(-2);
  expect(editedRow?.metadata?.reason).toBe('admin fix minus');
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
    (await request('GET', `${base}/ranking`, undefined, viewerCookie)).json().data.teams[0].medals,
  ).toBe(0);

  await runReverseCases({
    api: ctx.api,
    adminCookie,
    scorerCookie,
    viewerCookie,
    base,
    teamId,
    post,
    adjust,
  });

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
  expect(JSON.stringify(publicTeam.json())).not.toMatch(/createdByName|"metadata"|@example\.test/);
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
    (await request('DELETE', `${base}/public-links/${publicLinkId}`, undefined, ownerCookie))
      .statusCode,
  ).toBe(204);
  expect((await request('GET', `/api/public/rankings/${newToken}`)).statusCode).toBe(404);
  expect((await request('GET', `/api/public/rankings/${publicSlug}`)).statusCode).toBe(404);

  await runGameReverseAndReplaceCases({
    api: ctx.api,
    adminCookie,
    scorerCookie,
    viewerCookie,
    base,
    teams,
    gameBody,
    firstGameId: game.json().data.id as string,
    post,
  });

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
  expect((await request('GET', '/api/admin/health', undefined, ownerCookie)).statusCode).toBe(200);
}
