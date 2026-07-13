import type { FastifyInstance } from 'fastify';
import { one, pool, rows } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { economyRoutes } from './economy-routes.js';
import { gameReplaceRoutes } from './game-replace-routes.js';
import { gameRoutes } from './game-routes.js';
import { ledgerEditRoutes } from './ledger-edit-routes.js';
import { getRanking, getTeamDetail } from './ranking.js';

function intArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => Number.isInteger(item)))
    return undefined;
  return value as number[];
}

/** Awards from workspace rule_snapshot by key, falling back to activity.rule_config (submit parity). */
function awardsFromConfig(
  ruleConfig: unknown,
  snapshotActivity: { medalAwards?: number[]; pieceAwards?: number[] } | undefined,
) {
  const config =
    ruleConfig && typeof ruleConfig === 'object' ? (ruleConfig as Record<string, unknown>) : {};
  return {
    medalAwards: intArray(snapshotActivity?.medalAwards) ?? intArray(config.medalAwards),
    pieceAwards: intArray(snapshotActivity?.pieceAwards) ?? intArray(config.pieceAwards),
  };
}

export async function scoringRoutes(app: FastifyInstance) {
  app.get(
    '/:workspaceId/activities',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => {
      const workspaceId = (request.params as { workspaceId: string }).workspaceId;
      const [data, workspace] = await Promise.all([
        rows<{
          id: string;
          activity_key: string;
          name: string;
          activity_type: string;
          sequence_no: number;
          status: string;
          rule_config: unknown;
        }>(
          'SELECT id,activity_key,name,activity_type,sequence_no,status,rule_config FROM activities WHERE workspace_id=$1 ORDER BY sequence_no',
          [workspaceId],
        ),
        one<{ rule_snapshot: unknown }>('SELECT rule_snapshot FROM workspaces WHERE id=$1', [
          workspaceId,
        ]),
      ]);
      const snapshot = workspace?.rule_snapshot as
        | { activities?: Array<{ key: string; medalAwards?: number[]; pieceAwards?: number[] }> }
        | undefined;
      const snapshotByKey = new Map(
        (snapshot?.activities ?? []).map((activity) => [activity.key, activity]),
      );
      return {
        data: data.map((row) => {
          const awards = awardsFromConfig(row.rule_config, snapshotByKey.get(row.activity_key));
          return camelize({
            id: row.id,
            activity_key: row.activity_key,
            name: row.name,
            activity_type: row.activity_type,
            sequence_no: row.sequence_no,
            status: row.status,
            medal_awards: awards.medalAwards,
            piece_awards: awards.pieceAwards,
          });
        }),
      };
    },
  );
  app.get(
    '/:workspaceId/ranking',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => ({
      data: await getRanking((request.params as { workspaceId: string }).workspaceId),
    }),
  );
  app.get(
    '/:workspaceId/ranking/:teamId',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => {
      const { workspaceId, teamId } = request.params as { workspaceId: string; teamId: string };
      return { data: await getTeamDetail(workspaceId, teamId) };
    },
  );
  app.get(
    '/:workspaceId/ledger',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const query = request.query as {
        teamId?: string;
        type?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(query.limit) || 100, 500);
      const offset = Math.max(Number(query.offset) || 0, 0);
      const data = await rows(
        `SELECT l.*,t.display_name team_name,a.name activity_name,u.full_name created_by_name,r.created_at reversed_at FROM score_ledger l JOIN teams t ON t.id=l.team_id LEFT JOIN activities a ON a.id=l.activity_id JOIN users u ON u.id=l.created_by LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id WHERE l.workspace_id=$1 AND ($2::uuid IS NULL OR l.team_id=$2) AND ($3::text IS NULL OR l.entry_type::text=$3) ORDER BY l.created_at DESC LIMIT $4 OFFSET $5`,
        [workspaceId, query.teamId ?? null, query.type ?? null, limit, offset],
      );
      const total = await pool.query<{ count: string }>(
        'SELECT count(*)::text count FROM score_ledger WHERE workspace_id=$1 AND ($2::uuid IS NULL OR team_id=$2) AND ($3::text IS NULL OR entry_type::text=$3)',
        [workspaceId, query.teamId ?? null, query.type ?? null],
      );
      return {
        data: { items: camelize(data), total: Number(total.rows[0]?.count ?? 0), limit, offset },
      };
    },
  );
  app.get(
    '/:workspaceId/export.json',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => {
      const { workspaceId } = request.params as { workspaceId: string };
      return {
        data: {
          ranking: await getRanking(workspaceId),
          ledger: camelize(
            await rows('SELECT * FROM score_ledger WHERE workspace_id=$1 ORDER BY created_at', [
              workspaceId,
            ]),
          ),
        },
      };
    },
  );
  await app.register(gameRoutes);
  await app.register(gameReplaceRoutes);
  await app.register(economyRoutes);
  await app.register(ledgerEditRoutes);
}
