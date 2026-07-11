import type { FastifyInstance } from 'fastify';
import { purchaseCost } from '@tadscore/rule-engine';
import { adjustmentSchema, purchaseSchema, reversalSchema } from '@tadscore/contracts';
import { audit } from '../../lib/audit.js';
import { transaction } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { ApiError } from '../../lib/errors.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { publishRanking } from './events.js';
import { loadMutableRule } from './helpers.js';

export async function economyRoutes(app: FastifyInstance) {
  app.post(
    '/:workspaceId/adjustments',
    { preHandler: requireWorkspaceRole('scorer') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = adjustmentSchema.parse(request.body);
      const entry = await transaction(async (client) => {
        const rule = await loadMutableRule(client, workspaceId);
        if (input.kind === 'speech' && input.medalDelta !== rule.adjustments.speech)
          throw new ApiError(
            400,
            'INVALID_ADJUSTMENT',
            `Speech adjustment must be ${rule.adjustments.speech}`,
          );
        if (input.kind === 'violation' && !rule.adjustments.violations.includes(input.medalDelta))
          throw new ApiError(400, 'INVALID_ADJUSTMENT', 'Unsupported violation value');
        if (input.kind === 'manual' && input.medalDelta === 0)
          throw new ApiError(400, 'INVALID_ADJUSTMENT', 'Manual adjustment cannot be zero');
        const existing = await client.query<{
          team_id: string;
          medal_delta: number;
          metadata: { kind?: string };
        }>('SELECT * FROM score_ledger WHERE workspace_id=$1 AND idempotency_key=$2', [
          workspaceId,
          input.idempotencyKey,
        ]);
        if (existing.rows[0]) {
          const prior = existing.rows[0];
          if (
            prior.team_id !== input.teamId ||
            prior.medal_delta !== input.medalDelta ||
            prior.metadata.kind !== input.kind
          )
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different request',
            );
          return prior;
        }
        const team = await client.query(
          'SELECT 1 FROM teams WHERE id=$1 AND workspace_id=$2 AND is_active',
          [input.teamId, workspaceId],
        );
        if (!team.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Active team not found');
        return (
          await client.query(
            `INSERT INTO score_ledger(workspace_id,team_id,entry_type,medal_delta,metadata,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [
              workspaceId,
              input.teamId,
              input.kind === 'violation' ? 'penalty' : 'adjustment',
              input.medalDelta,
              { kind: input.kind, reason: input.reason },
              input.idempotencyKey,
              request.user!.id,
            ],
          )
        ).rows[0];
      });
      publishRanking(workspaceId);
      await audit(request, 'score.adjustment.create', 'score_ledger', String(entry.id), {
        workspaceId,
        after: { kind: input.kind, medalDelta: input.medalDelta },
      });
      return reply.status(201).send({ data: camelize(entry) });
    },
  );

  app.post(
    '/:workspaceId/purchases',
    { preHandler: requireWorkspaceRole('scorer') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = purchaseSchema.parse(request.body);
      const purchase = await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `${workspaceId}:${input.teamId}`,
        ]);
        const existing = await client.query<{
          team_id: string;
          item_key: string;
          quantity: number;
        }>(
          'SELECT p.* FROM purchases p JOIN score_ledger l ON l.id=p.ledger_entry_id WHERE p.workspace_id=$1 AND l.idempotency_key=$2',
          [workspaceId, input.idempotencyKey],
        );
        if (existing.rows[0]) {
          const prior = existing.rows[0];
          if (
            prior.team_id !== input.teamId ||
            prior.item_key !== input.itemKey ||
            prior.quantity !== input.quantity
          )
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different request',
            );
          return prior;
        }
        const rule = await loadMutableRule(client, workspaceId);
        const cost = purchaseCost(rule, input.itemKey, input.quantity);
        const team = await client.query(
          'SELECT 1 FROM teams WHERE id=$1 AND workspace_id=$2 AND is_active FOR SHARE',
          [input.teamId, workspaceId],
        );
        if (!team.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Active team not found');
        const balance = await client.query<{ medals: string }>(
          'SELECT COALESCE(SUM(medal_delta),0)::text medals FROM score_ledger WHERE workspace_id=$1 AND team_id=$2',
          [workspaceId, input.teamId],
        );
        if (Number(balance.rows[0]?.medals ?? 0) < cost.medalCost)
          throw new ApiError(409, 'INSUFFICIENT_MEDALS', 'Team cannot afford this purchase');
        if (input.itemKey === 'piece') {
          const constraint = rule.constraints.purchasePieceLimitBeforeActivity;
          const passed = await client.query(
            "SELECT 1 FROM activities WHERE workspace_id=$1 AND activity_key=$2 AND status='finalized'",
            [workspaceId, constraint.activityKey],
          );
          if (!passed.rowCount) {
            const bought = await client.query<{ total: string }>(
              "SELECT COALESCE(SUM(quantity),0)::text total FROM purchases WHERE workspace_id=$1 AND team_id=$2 AND item_key='piece' AND status='completed'",
              [workspaceId, input.teamId],
            );
            if (Number(bought.rows[0]?.total ?? 0) + input.quantity > constraint.max)
              throw new ApiError(
                409,
                'PIECE_LIMIT',
                `At most ${constraint.max} piece may be purchased before ${constraint.activityKey}`,
              );
          }
        }
        const ledger = (
          await client.query<{ id: string }>(
            `INSERT INTO score_ledger(workspace_id,team_id,entry_type,medal_delta,piece_delta,item_delta,metadata,idempotency_key,created_by) VALUES($1,$2,'purchase',$3,$4,$5,$6,$7,$8) RETURNING id`,
            [
              workspaceId,
              input.teamId,
              cost.medalDelta,
              cost.pieceDelta,
              cost.itemDelta,
              { itemKey: input.itemKey, quantity: input.quantity },
              input.idempotencyKey,
              request.user!.id,
            ],
          )
        ).rows[0]!;
        await client.query(
          `INSERT INTO team_inventory(workspace_id,team_id,item_key,quantity) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,team_id,item_key) DO UPDATE SET quantity=team_inventory.quantity+excluded.quantity`,
          [workspaceId, input.teamId, input.itemKey, input.quantity],
        );
        return (
          await client.query(
            'INSERT INTO purchases(workspace_id,team_id,item_key,quantity,medal_cost,ledger_entry_id,purchased_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [
              workspaceId,
              input.teamId,
              input.itemKey,
              input.quantity,
              cost.medalCost,
              ledger.id,
              request.user!.id,
            ],
          )
        ).rows[0];
      });
      publishRanking(workspaceId);
      await audit(request, 'score.purchase.create', 'purchase', String(purchase.id), {
        workspaceId,
        after: { itemKey: input.itemKey, quantity: input.quantity },
      });
      return reply.status(201).send({ data: camelize(purchase) });
    },
  );

  app.post(
    '/:workspaceId/ledger/:entryId/reverse',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId, entryId } = request.params as { workspaceId: string; entryId: string };
      const input = reversalSchema.parse(request.body);
      const reversal = await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
        await loadMutableRule(client, workspaceId);
        const duplicate = await client.query<{ reverses_entry_id: string | null }>(
          'SELECT * FROM score_ledger WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, input.idempotencyKey],
        );
        if (duplicate.rows[0]) {
          if (duplicate.rows[0].reverses_entry_id !== entryId)
            throw new ApiError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different request',
            );
          return duplicate.rows[0];
        }
        const original = (
          await client.query<{
            id: string;
            team_id: string;
            medal_delta: number;
            piece_delta: number;
            item_delta: number;
            entry_type: string;
          }>(
            "SELECT id,team_id,medal_delta,piece_delta,item_delta,entry_type FROM score_ledger WHERE id=$1 AND workspace_id=$2 AND entry_type<>'reversal' FOR UPDATE",
            [entryId, workspaceId],
          )
        ).rows[0];
        if (!original) throw new ApiError(404, 'NOT_FOUND', 'Ledger entry not found');
        if (original.entry_type === 'activity_award')
          throw new ApiError(
            409,
            'GAME_REVERSAL_REQUIRED',
            'Reverse the complete game submission instead of one team award',
          );
        const prior = await client.query('SELECT 1 FROM score_ledger WHERE reverses_entry_id=$1', [
          entryId,
        ]);
        if (prior.rowCount)
          throw new ApiError(409, 'ALREADY_REVERSED', 'Ledger entry has already been reversed');
        const created = (
          await client.query(
            `INSERT INTO score_ledger(workspace_id,team_id,entry_type,medal_delta,piece_delta,item_delta,metadata,idempotency_key,created_by,reverses_entry_id) VALUES($1,$2,'reversal',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [
              workspaceId,
              original.team_id,
              -original.medal_delta,
              -original.piece_delta,
              -original.item_delta,
              { reason: input.reason },
              input.idempotencyKey,
              request.user!.id,
              entryId,
            ],
          )
        ).rows[0];
        if (original.entry_type === 'purchase') {
          const purchase = (
            await client.query<{ item_key: string; quantity: number }>(
              "UPDATE purchases SET status='reversed',reversed_at=now() WHERE ledger_entry_id=$1 AND status='completed' RETURNING item_key,quantity",
              [entryId],
            )
          ).rows[0];
          if (purchase)
            await client.query(
              'UPDATE team_inventory SET quantity=quantity-$1 WHERE workspace_id=$2 AND team_id=$3 AND item_key=$4',
              [purchase.quantity, workspaceId, original.team_id, purchase.item_key],
            );
        }
        return created;
      });
      publishRanking(workspaceId);
      await audit(request, 'score.entry.reverse', 'score_ledger', entryId, {
        workspaceId,
        after: { reason: input.reason },
      });
      return reply.status(201).send({ data: camelize(reversal) });
    },
  );
}
