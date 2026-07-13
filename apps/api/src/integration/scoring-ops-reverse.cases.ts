import { expect } from 'vitest';
import type { ApiHarness } from './helpers.js';

type ReverseCtx = {
  api: ApiHarness;
  adminCookie: string;
  scorerCookie: string;
  viewerCookie: string;
  base: string;
  teamId: string;
  post: (path: string, body: unknown, cookie: string) => ReturnType<ApiHarness['request']>;
  adjust: (body: object, cookie: string) => ReturnType<ApiHarness['request']>;
};

/**
 * Ledger/game reverse: empty reason, idempotency, double-reverse, purchase undo.
 * Assumes prior setup left a purchase entry and activity awards for teamId.
 */
export async function runReverseCases(ctx: ReverseCtx) {
  const { request } = ctx.api;
  const { adminCookie, scorerCookie, viewerCookie, base, teamId, post, adjust } = ctx;

  const reverseAdj = await adjust(
    {
      teamId,
      kind: 'manual',
      medalDelta: 3,
      reason: 'to reverse',
      idempotencyKey: 'to-reverse-adj',
    },
    scorerCookie,
  );
  expect(reverseAdj.statusCode).toBe(201);
  const reverseAdjId = reverseAdj.json().data.id as string;
  const emptyReasonReverse = await post(
    `${base}/ledger/${reverseAdjId}/reverse`,
    { reason: '', idempotencyKey: 'reverse-adj-empty' },
    adminCookie,
  );
  expect(emptyReasonReverse.statusCode).toBe(201);
  expect(emptyReasonReverse.json().data.medalDelta).toBe(-3);
  expect(emptyReasonReverse.json().data.metadata.reason).toBe('');
  expect(
    (
      await post(
        `${base}/ledger/${reverseAdjId}/reverse`,
        { reason: '', idempotencyKey: 'reverse-adj-empty' },
        adminCookie,
      )
    ).statusCode,
  ).toBe(200);
  const alreadyReversed = await post(
    `${base}/ledger/${reverseAdjId}/reverse`,
    { reason: 'again', idempotencyKey: 'reverse-adj-again' },
    adminCookie,
  );
  expect(alreadyReversed.statusCode).toBe(409);
  expect(alreadyReversed.json().error.code).toBe('ALREADY_REVERSED');
  const reverseRowId = emptyReasonReverse.json().data.id as string;
  const reverseReversal = await post(
    `${base}/ledger/${reverseRowId}/reverse`,
    { reason: 'nope', idempotencyKey: 'reverse-a-reversal' },
    adminCookie,
  );
  expect(reverseReversal.statusCode).toBe(404);
  const reverseAdj2 = await adjust(
    {
      teamId,
      kind: 'manual',
      medalDelta: 1,
      reason: 'missing reason case',
      idempotencyKey: 'to-reverse-adj-2',
    },
    scorerCookie,
  );
  expect(reverseAdj2.statusCode).toBe(201);
  const missingReasonReverse = await post(
    `${base}/ledger/${reverseAdj2.json().data.id}/reverse`,
    { idempotencyKey: 'reverse-adj-missing-reason' },
    adminCookie,
  );
  expect(missingReasonReverse.statusCode).toBe(201);
  const ledgerForAwards = await request('GET', `${base}/ledger`, undefined, adminCookie);
  const awardEntry = ledgerForAwards
    .json()
    .data.items.find(
      (item: { entryType: string; teamId: string }) =>
        item.entryType === 'activity_award' && item.teamId === teamId,
    );
  expect(awardEntry).toBeTruthy();
  const awardReverse = await post(
    `${base}/ledger/${awardEntry.id}/reverse`,
    { reason: 'single team', idempotencyKey: 'reverse-award-blocked' },
    adminCookie,
  );
  expect(awardReverse.statusCode).toBe(409);
  expect(awardReverse.json().error.code).toBe('GAME_REVERSAL_REQUIRED');
  const ledgerBeforePurchaseReverse = await request(
    'GET',
    `${base}/ledger`,
    undefined,
    adminCookie,
  );
  const purchaseEntry = ledgerBeforePurchaseReverse
    .json()
    .data.items.find((item: { entryType: string }) => item.entryType === 'purchase');
  expect(purchaseEntry).toBeTruthy();
  const medalsBeforePurchaseReverse = (
    await request('GET', `${base}/ranking`, undefined, viewerCookie)
  )
    .json()
    .data.teams.find((team: { teamId: string }) => team.teamId === teamId).medals as number;
  const purchaseReverse = await post(
    `${base}/ledger/${purchaseEntry.id}/reverse`,
    { reason: '', idempotencyKey: 'reverse-purchase-1' },
    adminCookie,
  );
  expect(purchaseReverse.statusCode).toBe(201);
  expect(purchaseReverse.json().data.medalDelta).toBe(-purchaseEntry.medalDelta);
  expect(
    (
      await post(
        `${base}/ledger/${purchaseEntry.id}/reverse`,
        { reason: '', idempotencyKey: 'reverse-purchase-1' },
        adminCookie,
      )
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await post(
        `${base}/ledger/${purchaseEntry.id}/reverse`,
        { reason: '', idempotencyKey: 'reverse-purchase-2' },
        adminCookie,
      )
    ).json().error.code,
  ).toBe('ALREADY_REVERSED');
  const medalsAfterPurchaseReverse = (
    await request('GET', `${base}/ranking`, undefined, viewerCookie)
  )
    .json()
    .data.teams.find((team: { teamId: string }) => team.teamId === teamId).medals as number;
  expect(medalsAfterPurchaseReverse).toBe(medalsBeforePurchaseReverse - purchaseEntry.medalDelta);
}

type GameReverseCtx = {
  api: ApiHarness;
  adminCookie: string;
  scorerCookie: string;
  viewerCookie: string;
  base: string;
  teams: Array<{ id: string }>;
  gameBody: {
    activityKey: string;
    idempotencyKey: string;
    results: { teamId: string; rank: number }[];
  };
  firstGameId: string;
  post: (path: string, body: unknown, cookie: string) => ReturnType<ApiHarness['request']>;
};

/** Game reverse (empty reason), resubmit, replace ranks. */
export async function runGameReverseAndReplaceCases(ctx: GameReverseCtx) {
  const { request } = ctx.api;
  const { adminCookie, scorerCookie, viewerCookie, base, teams, gameBody, firstGameId, post } = ctx;

  const secondGame = await post(
    `${base}/games`,
    { ...gameBody, activityKey: 'warmup-2', idempotencyKey: 'game-two' },
    scorerCookie,
  );
  expect(secondGame.statusCode).toBe(201);
  const reversePath = `${base}/games/${firstGameId}/reverse`;
  expect(
    (await post(reversePath, { reason: '', idempotencyKey: 'reverse-game-1' }, adminCookie))
      .statusCode,
  ).toBe(201);
  expect(
    (await post(reversePath, { reason: '', idempotencyKey: 'reverse-game-1' }, adminCookie))
      .statusCode,
  ).toBe(200);
  const reverseConflict = await post(
    `${base}/games/${secondGame.json().data.id}/reverse`,
    { reason: '', idempotencyKey: 'reverse-game-1' },
    adminCookie,
  );
  expect(reverseConflict.statusCode).toBe(409);
  expect(reverseConflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
  const gameAlreadyReversed = await post(
    reversePath,
    { idempotencyKey: 'reverse-game-1-again' },
    adminCookie,
  );
  expect(gameAlreadyReversed.statusCode).toBe(409);
  expect(gameAlreadyReversed.json().error.code).toBe('ALREADY_REVERSED');

  const resubmit = await post(
    `${base}/games`,
    { ...gameBody, activityKey: 'warmup-1', idempotencyKey: 'game-one-resubmit' },
    scorerCookie,
  );
  expect(resubmit.statusCode).toBe(201);
  const replaceBody = {
    activityKey: 'warmup-1',
    idempotencyKey: 'replace-warmup-1',
    reason: 'fix ranks',
    results: teams.map((team, index) => ({
      teamId: team.id,
      rank: index === 0 ? 2 : index === 1 ? 1 : index + 1,
    })),
  };
  expect((await post(`${base}/games/replace`, replaceBody, viewerCookie)).statusCode).toBe(403);
  const replaced = await post(`${base}/games/replace`, replaceBody, scorerCookie);
  expect(replaced.statusCode).toBe(201);
  expect((await post(`${base}/games/replace`, replaceBody, scorerCookie)).statusCode).toBe(200);
  const savedRanks = await request(
    'GET',
    `${base}/activities/warmup-1/results`,
    undefined,
    viewerCookie,
  );
  expect(savedRanks.statusCode).toBe(200);
  const rankByTeam = Object.fromEntries(
    savedRanks
      .json()
      .data.results.map((row: { teamId: string; rank: number }) => [row.teamId, row.rank]),
  );
  expect(rankByTeam[teams[0]!.id]).toBe(2);
  expect(rankByTeam[teams[1]!.id]).toBe(1);
}
