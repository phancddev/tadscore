import type { FastifyInstance } from 'fastify';
import { activityAward } from '@tadscore/rule-engine';
import { replaceGameSchema, validateRankPermutation } from '@tadscore/contracts';
import { audit } from '../../lib/audit.js';
import { one, rows, transaction } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { ApiError } from '../../lib/errors.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { publishRanking } from './events.js';
import { loadMutableRule } from './helpers.js';

/** Prefill ranks + replace finalized game (reverse prior awards, submit new) in one TX. */
export async function gameReplaceRoutes(app: FastifyInstance) {
  app.get(
    '/:workspaceId/activities/:activityKey/results',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => {
      const { workspaceId, activityKey } = request.params as {
        workspaceId: string;
        activityKey: string;
      };
      const activity = await one<{ id: string; status: string; name: string }>(
        'SELECT id,status,name FROM activities WHERE workspace_id=$1 AND activity_key=$2',
        [workspaceId, activityKey],
      );
      if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
      const submission = await one<{ id: string; created_at: Date }>(
        `SELECT s.id,s.created_at FROM result_submissions s
         WHERE s.workspace_id=$1 AND s.activity_id=$2
           AND (
             EXISTS (
               SELECT 1 FROM score_ledger l
               LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id
               WHERE l.submission_id=s.id AND l.entry_type='activity_award' AND r.id IS NULL
             )
             OR NOT EXISTS (
               SELECT 1 FROM score_ledger l
               WHERE l.submission_id=s.id AND l.entry_type='activity_award'
             )
           )
         ORDER BY s.created_at DESC LIMIT 1`,
        [workspaceId, activity.id],
      );
      if (!submission) {
        return {
          data: {
            activityKey,
            activityName: activity.name,
            status: activity.status,
            submissionId: null,
            results: [],
          },
        };
      }
      const results = await rows<{ team_id: string; rank: number }>(
        'SELECT team_id,rank FROM activity_results WHERE submission_id=$1 ORDER BY rank',
        [submission.id],
      );
      return {
        data: camelize({
          activity_key: activityKey,
          activity_name: activity.name,
          status: activity.status,
          submission_id: submission.id,
          created_at: submission.created_at,
          results: results.map((row) => ({ team_id: row.team_id, rank: row.rank })),
        }),
      };
    },
  );

  app.post(
    '/:workspaceId/games/replace',
    { preHandler: requireWorkspaceRole('scorer') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = replaceGameSchema.parse(request.body);
      const submission = await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
        const existing = await client.query<{
          id: string;
          activity_id: string;
          created_at: Date;
        }>(
          'SELECT id,activity_id,created_at FROM result_submissions WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, input.idempotencyKey],
        );
        if (existing.rows[0]) {
          const prior = existing.rows[0];
          const priorResults = await client.query<{ team_id: string; rank: number }>(
            'SELECT team_id,rank FROM activity_results WHERE submission_id=$1 ORDER BY team_id',
            [prior.id],
          );
          const expected = [...input.results].sort((a, b) => a.teamId.localeCompare(b.teamId));
          const same =
            priorResults.rows.length === expected.length &&
            priorResults.rows.every(
              (row, index) =>
                row.team_id === expected[index]!.teamId && row.rank === expected[index]!.rank,
            );
          if (!same)
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different request',
            );
          return { ...prior, idempotent: true, replaced_submission_id: null as string | null };
        }
        const rule = await loadMutableRule(client, workspaceId);
        const teams = await client.query<{ id: string }>(
          'SELECT id FROM teams WHERE workspace_id=$1 AND is_active ORDER BY id FOR SHARE',
          [workspaceId],
        );
        const activeTeamCount = teams.rowCount ?? 0;
        if (activeTeamCount < 2)
          throw new ApiError(409, 'TEAM_COUNT', 'At least two active teams are required');
        const rankList = input.results.map((result) => result.rank);
        if (
          !validateRankPermutation(rankList, activeTeamCount) ||
          new Set(input.results.map((result) => result.teamId)).size !== activeTeamCount
        )
          throw new ApiError(
            400,
            'INVALID_RANKS',
            `Results must contain each rank 1..${activeTeamCount} exactly once`,
          );
        if (input.results.some((result) => !teams.rows.some((team) => team.id === result.teamId)))
          throw new ApiError(
            400,
            'INVALID_TEAMS',
            'Results must contain every active workspace team exactly once',
          );
        const activity = (
          await client.query<{ id: string; status: string }>(
            'SELECT id,status FROM activities WHERE workspace_id=$1 AND activity_key=$2 FOR UPDATE',
            [workspaceId, input.activityKey],
          )
        ).rows[0];
        if (!activity) throw new ApiError(404, 'NOT_FOUND', 'Activity not found');
        if (activity.status !== 'finalized')
          throw new ApiError(
            409,
            'NOT_FINALIZED',
            'Only finalized games can be replaced; submit a new result instead',
          );
        const priorSubmission = (
          await client.query<{ id: string }>(
            `SELECT s.id FROM result_submissions s
             WHERE s.workspace_id=$1 AND s.activity_id=$2
             ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE OF s`,
            [workspaceId, activity.id],
          )
        ).rows[0];
        if (!priorSubmission)
          throw new ApiError(409, 'NO_SUBMISSION', 'No prior game submission to replace');
        const awards = await client.query<{
          id: string;
          team_id: string;
          medal_delta: number;
          piece_delta: number;
          item_delta: number;
        }>(
          `SELECT l.id,l.team_id,l.medal_delta,l.piece_delta,l.item_delta FROM score_ledger l
           LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id
           WHERE l.submission_id=$1 AND l.workspace_id=$2 AND l.entry_type='activity_award' AND r.id IS NULL
           FOR UPDATE OF l`,
          [priorSubmission.id, workspaceId],
        );
        for (const entry of awards.rows) {
          await client.query(
            `INSERT INTO score_ledger(workspace_id,team_id,entry_type,medal_delta,piece_delta,item_delta,metadata,idempotency_key,created_by,reverses_entry_id)
             VALUES($1,$2,'reversal',$3,$4,$5,$6,$7,$8,$9)`,
            [
              workspaceId,
              entry.team_id,
              -entry.medal_delta,
              -entry.piece_delta,
              -entry.item_delta,
              {
                reason: input.reason,
                batchKey: input.idempotencyKey,
                submissionId: priorSubmission.id,
                replace: true,
              },
              `${input.idempotencyKey.slice(0, 40)}:rev:${entry.id}`,
              request.user!.id,
              entry.id,
            ],
          );
        }
        const created = (
          await client.query<{ id: string; activity_id: string; created_at: Date }>(
            `INSERT INTO result_submissions(workspace_id,activity_id,idempotency_key,submitted_by,notes)
             VALUES($1,$2,$3,$4,$5) RETURNING id,activity_id,created_at`,
            [
              workspaceId,
              activity.id,
              input.idempotencyKey,
              request.user!.id,
              input.notes ?? `Replace: ${input.reason}`,
            ],
          )
        ).rows[0]!;
        for (const result of input.results) {
          const award = activityAward(rule, input.activityKey, result.rank, activeTeamCount);
          await client.query(
            'INSERT INTO activity_results(workspace_id,submission_id,team_id,rank,metadata) VALUES($1,$2,$3,$4,$5)',
            [workspaceId, created.id, result.teamId, result.rank, award],
          );
          if (award.medals || award.pieces)
            await client.query(
              `INSERT INTO score_ledger(workspace_id,team_id,activity_id,submission_id,entry_type,medal_delta,piece_delta,metadata,created_by)
               VALUES($1,$2,$3,$4,'activity_award',$5,$6,$7,$8)`,
              [
                workspaceId,
                result.teamId,
                activity.id,
                created.id,
                award.medals,
                award.pieces,
                { rank: result.rank, activityKey: input.activityKey, replaced: true },
                request.user!.id,
              ],
            );
        }
        await client.query("UPDATE activities SET status='finalized' WHERE id=$1", [activity.id]);
        return {
          ...created,
          idempotent: false,
          replaced_submission_id: priorSubmission.id,
        };
      });
      publishRanking(workspaceId);
      await audit(request, 'score.game.replace', 'result_submission', String(submission.id), {
        workspaceId,
        after: {
          reason: input.reason,
          activityKey: input.activityKey,
          replacedSubmissionId: submission.replaced_submission_id,
        },
      });
      return reply.status(submission.idempotent ? 200 : 201).send({ data: camelize(submission) });
    },
  );
}
