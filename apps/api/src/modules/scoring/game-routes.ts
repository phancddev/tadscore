import type { FastifyInstance } from 'fastify';
import { activityAward } from '@tadscore/rule-engine';
import { reversalSchema, submitGameSchema, validateRankPermutation } from '@tadscore/contracts';
import { audit } from '../../lib/audit.js';
import { transaction } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { ApiError } from '../../lib/errors.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { publishRanking } from './events.js';
import { loadMutableRule } from './helpers.js';

export async function gameRoutes(app: FastifyInstance) {
  app.post(
    '/:workspaceId/games',
    { preHandler: requireWorkspaceRole('scorer') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = submitGameSchema.parse(request.body);
      const submission = await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
        const existing = await client.query<{
          id: string;
          activity_id: string;
          activity_key: string;
          created_at: Date;
        }>(
          'SELECT s.id,s.activity_id,a.activity_key,s.created_at FROM result_submissions s JOIN activities a ON a.id=s.activity_id WHERE s.workspace_id=$1 AND s.idempotency_key=$2',
          [workspaceId, input.idempotencyKey],
        );
        if (existing.rows[0]) {
          const prior = existing.rows[0];
          const results = await client.query<{ team_id: string; rank: number }>(
            'SELECT team_id,rank FROM activity_results WHERE submission_id=$1 ORDER BY team_id',
            [prior.id],
          );
          const expected = [...input.results].sort((a, b) => a.teamId.localeCompare(b.teamId));
          const same =
            prior.activity_key === input.activityKey &&
            results.rows.length === expected.length &&
            results.rows.every(
              (row, index) =>
                row.team_id === expected[index]!.teamId && row.rank === expected[index]!.rank,
            );
          if (!same)
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different request',
            );
          return {
            id: prior.id,
            activity_id: prior.activity_id,
            created_at: prior.created_at,
            idempotent: true,
          };
        }
        const rule = await loadMutableRule(client, workspaceId);
        const ranks = input.results.map((result) => result.rank);
        if (
          !validateRankPermutation(ranks, rule.teamCount) ||
          new Set(input.results.map((result) => result.teamId)).size !== rule.teamCount
        )
          throw new ApiError(
            400,
            'INVALID_RANKS',
            `Results must contain each rank 1..${rule.teamCount} exactly once`,
          );
        const teams = await client.query<{ id: string }>(
          'SELECT id FROM teams WHERE workspace_id=$1 AND is_active ORDER BY id FOR SHARE',
          [workspaceId],
        );
        if (
          teams.rowCount !== rule.teamCount ||
          input.results.some((result) => !teams.rows.some((team) => team.id === result.teamId))
        )
          throw new ApiError(
            400,
            'INVALID_TEAMS',
            'Results must contain every active workspace team exactly once',
          );
        const activity = (
          await client.query<{ id: string }>(
            "SELECT id FROM activities WHERE workspace_id=$1 AND activity_key=$2 AND status IN ('open','draft') FOR UPDATE",
            [workspaceId, input.activityKey],
          )
        ).rows[0];
        if (!activity)
          throw new ApiError(
            409,
            'ACTIVITY_UNAVAILABLE',
            'Activity is unavailable or already finalized',
          );
        const created = (
          await client.query<{ id: string; activity_id: string; created_at: Date }>(
            'INSERT INTO result_submissions(workspace_id,activity_id,idempotency_key,submitted_by,notes) VALUES($1,$2,$3,$4,$5) RETURNING id,activity_id,created_at',
            [workspaceId, activity.id, input.idempotencyKey, request.user!.id, input.notes ?? null],
          )
        ).rows[0]!;
        for (const result of input.results) {
          const award = activityAward(rule, input.activityKey, result.rank);
          await client.query(
            'INSERT INTO activity_results(workspace_id,submission_id,team_id,rank,metadata) VALUES($1,$2,$3,$4,$5)',
            [workspaceId, created.id, result.teamId, result.rank, award],
          );
          if (award.medals || award.pieces)
            await client.query(
              `INSERT INTO score_ledger(workspace_id,team_id,activity_id,submission_id,entry_type,medal_delta,piece_delta,metadata,created_by) VALUES($1,$2,$3,$4,'activity_award',$5,$6,$7,$8)`,
              [
                workspaceId,
                result.teamId,
                activity.id,
                created.id,
                award.medals,
                award.pieces,
                { rank: result.rank, activityKey: input.activityKey },
                request.user!.id,
              ],
            );
        }
        await client.query("UPDATE activities SET status='finalized' WHERE id=$1", [activity.id]);
        return { ...created, idempotent: false };
      });
      publishRanking(workspaceId);
      await audit(request, 'score.game.submit', 'result_submission', String(submission.id), {
        workspaceId,
      });
      return reply.status(submission.idempotent ? 200 : 201).send({ data: camelize(submission) });
    },
  );

  app.post(
    '/:workspaceId/games/:submissionId/reverse',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId, submissionId } = request.params as {
        workspaceId: string;
        submissionId: string;
      };
      const input = reversalSchema.parse(request.body);
      const result = await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
        await loadMutableRule(client, workspaceId);
        const duplicate = await client.query<{ id: string; submission_id: string | null }>(
          "SELECT id,metadata->>'submissionId' submission_id FROM score_ledger WHERE workspace_id=$1 AND entry_type='reversal' AND metadata->>'batchKey'=$2",
          [workspaceId, input.idempotencyKey],
        );
        if (duplicate.rowCount) {
          if (duplicate.rows.some((row) => row.submission_id !== submissionId))
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different request',
            );
          return { reversedEntries: duplicate.rows.map((row) => row.id), idempotent: true };
        }
        const submission = (
          await client.query<{ activity_id: string }>(
            'SELECT activity_id FROM result_submissions WHERE id=$1 AND workspace_id=$2 FOR UPDATE',
            [submissionId, workspaceId],
          )
        ).rows[0];
        if (!submission) throw new ApiError(404, 'NOT_FOUND', 'Game submission not found');
        const entries = await client.query<{
          id: string;
          team_id: string;
          medal_delta: number;
          piece_delta: number;
          item_delta: number;
        }>(
          `SELECT l.id,l.team_id,l.medal_delta,l.piece_delta,l.item_delta FROM score_ledger l LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id WHERE l.submission_id=$1 AND l.workspace_id=$2 AND l.entry_type='activity_award' AND r.id IS NULL FOR UPDATE OF l`,
          [submissionId, workspaceId],
        );
        if (!entries.rowCount)
          throw new ApiError(409, 'ALREADY_REVERSED', 'Game submission is already reversed');
        const reversedEntries: string[] = [];
        for (const entry of entries.rows) {
          const created = await client.query<{ id: string }>(
            `INSERT INTO score_ledger(workspace_id,team_id,entry_type,medal_delta,piece_delta,item_delta,metadata,idempotency_key,created_by,reverses_entry_id) VALUES($1,$2,'reversal',$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [
              workspaceId,
              entry.team_id,
              -entry.medal_delta,
              -entry.piece_delta,
              -entry.item_delta,
              { reason: input.reason, batchKey: input.idempotencyKey, submissionId },
              `${input.idempotencyKey.slice(0, 50)}:${entry.id}`,
              request.user!.id,
              entry.id,
            ],
          );
          reversedEntries.push(created.rows[0]!.id);
        }
        await client.query("UPDATE activities SET status='open' WHERE id=$1 AND workspace_id=$2", [
          submission.activity_id,
          workspaceId,
        ]);
        return { reversedEntries, idempotent: false };
      });
      publishRanking(workspaceId);
      await audit(request, 'score.game.reverse', 'result_submission', submissionId, {
        workspaceId,
        after: { reason: input.reason },
      });
      return reply.status(result.idempotent ? 200 : 201).send({ data: result });
    },
  );
}
