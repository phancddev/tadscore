import type { FastifyInstance } from 'fastify';
import { pool, rows } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { economyRoutes } from './economy-routes.js';
import { gameRoutes } from './game-routes.js';
import { ledgerEditRoutes } from './ledger-edit-routes.js';
import { getRanking, getTeamDetail } from './ranking.js';

export async function scoringRoutes(app: FastifyInstance) {
  app.get(
    '/:workspaceId/activities',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => {
      const workspaceId = (request.params as { workspaceId: string }).workspaceId;
      const data = await rows(
        'SELECT id,activity_key,name,activity_type,sequence_no,status FROM activities WHERE workspace_id=$1 ORDER BY sequence_no',
        [workspaceId],
      );
      return { data: camelize(data) };
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
  await app.register(economyRoutes);
  await app.register(ledgerEditRoutes);
}
