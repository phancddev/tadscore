import type { FastifyInstance } from 'fastify';
import { updateLedgerEntrySchema } from '@tadscore/contracts';
import { audit } from '../../lib/audit.js';
import { transaction } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { ApiError } from '../../lib/errors.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { publishRanking } from './events.js';
import { loadMutableRule } from './helpers.js';

/** In-place edit of adjustment/penalty medal delta + reason (scorer+). */
export async function ledgerEditRoutes(app: FastifyInstance) {
  app.patch(
    '/:workspaceId/ledger/:entryId',
    { preHandler: requireWorkspaceRole('scorer') },
    async (request) => {
      const { workspaceId, entryId } = request.params as { workspaceId: string; entryId: string };
      const input = updateLedgerEntrySchema.parse(request.body);
      const { before, entry } = await transaction(async (client) => {
        await loadMutableRule(client, workspaceId);
        const original = (
          await client.query<{
            id: string;
            entry_type: string;
            medal_delta: number;
            metadata: Record<string, unknown>;
          }>(
            `SELECT id,entry_type,medal_delta,metadata FROM score_ledger
             WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
            [entryId, workspaceId],
          )
        ).rows[0];
        if (!original) throw new ApiError(404, 'NOT_FOUND', 'Ledger entry not found');
        if (!['adjustment', 'penalty'].includes(original.entry_type))
          throw new ApiError(
            409,
            'NOT_EDITABLE',
            'Only adjustment and penalty entries can be edited',
          );
        const reversed = await client.query(
          'SELECT 1 FROM score_ledger WHERE reverses_entry_id=$1',
          [entryId],
        );
        if (reversed.rowCount)
          throw new ApiError(409, 'ALREADY_REVERSED', 'Reversed entries cannot be edited');
        const metadata = { ...original.metadata, reason: input.reason };
        const updated = (
          await client.query(
            `UPDATE score_ledger SET medal_delta=$1, metadata=$2
             WHERE id=$3 AND workspace_id=$4 RETURNING *`,
            [input.medalDelta, metadata, entryId, workspaceId],
          )
        ).rows[0];
        return {
          before: {
            medalDelta: original.medal_delta,
            reason: original.metadata?.reason ?? null,
          },
          entry: updated,
        };
      });
      publishRanking(workspaceId);
      await audit(request, 'score.ledger.update', 'score_ledger', entryId, {
        workspaceId,
        before,
        after: { medalDelta: input.medalDelta, reason: input.reason },
      });
      return { data: camelize(entry) };
    },
  );
}
