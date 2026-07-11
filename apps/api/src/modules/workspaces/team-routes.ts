import type { FastifyInstance } from 'fastify';
import { MAX_WORKSPACE_TEAMS, teamSchema, updateTeamSchema } from '@tadscore/contracts';
import { audit } from '../../lib/audit.js';
import { one, rows } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { ApiError } from '../../lib/errors.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { requireActiveWorkspace } from './helpers.js';

export async function teamRoutes(app: FastifyInstance) {
  app.get(
    '/:workspaceId/teams',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => ({
      data: camelize(
        await rows(
          `SELECT t.id,t.code,t.name,t.display_name,t.color,t.icon,t.sort_order,t.is_active,
            COALESCE(sum(l.medal_delta),0)::int medals,
            COALESCE(sum(l.piece_delta),0)::int pieces,
            COALESCE(sum(l.item_delta),0)::int items
           FROM teams t
           LEFT JOIN score_ledger l ON l.workspace_id=t.workspace_id AND l.team_id=t.id
           WHERE t.workspace_id=$1
           GROUP BY t.id
           ORDER BY t.sort_order,t.name`,
          [(request.params as { workspaceId: string }).workspaceId],
        ),
      ),
    }),
  );

  app.post(
    '/:workspaceId/teams',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = teamSchema.parse(request.body);
      const capacity = await one<{ count: string; status: string }>(
        `SELECT (SELECT count(*) FROM teams WHERE workspace_id=w.id AND is_active)::text count,w.status
         FROM workspaces w WHERE w.id=$1`,
        [workspaceId],
      );
      if (!capacity || capacity.status !== 'active')
        throw new ApiError(409, 'WORKSPACE_READ_ONLY', 'Only active workspaces can be changed');
      if (Number(capacity.count) >= MAX_WORKSPACE_TEAMS)
        throw new ApiError(
          409,
          'TEAM_LIMIT',
          `A workspace can have at most ${MAX_WORKSPACE_TEAMS} active teams`,
        );
      let team: Record<string, unknown> | undefined;
      try {
        team = (await one(
          `INSERT INTO teams(workspace_id,code,name,display_name,color,icon,sort_order)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            workspaceId,
            input.code.toLowerCase(),
            input.name,
            input.displayName,
            input.color || null,
            input.icon ?? null,
            input.sortOrder,
          ],
        )) as Record<string, unknown>;
      } catch (error) {
        if ((error as { code?: string }).code === '23505')
          throw new ApiError(409, 'TEAM_CONFLICT', 'Team code or name already exists');
        throw error;
      }
      await audit(request, 'workspace.team.create', 'team', String(team.id), { workspaceId });
      return reply.status(201).send({ data: camelize(team) });
    },
  );

  app.patch(
    '/:workspaceId/teams/:teamId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request) => {
      const { workspaceId, teamId } = request.params as { workspaceId: string; teamId: string };
      const input = updateTeamSchema.parse(request.body);
      await requireActiveWorkspace(workspaceId);
      const existing = await one<{ id: string; is_active: boolean }>(
        'SELECT id,is_active FROM teams WHERE id=$1 AND workspace_id=$2',
        [teamId, workspaceId],
      );
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
      if (input.isActive === true && !existing.is_active) {
        const capacity = await one<{ count: string }>(
          'SELECT count(*)::text count FROM teams WHERE workspace_id=$1 AND is_active',
          [workspaceId],
        );
        if (Number(capacity?.count ?? 0) >= MAX_WORKSPACE_TEAMS)
          throw new ApiError(
            409,
            'TEAM_LIMIT',
            `A workspace can have at most ${MAX_WORKSPACE_TEAMS} active teams`,
          );
      }
      if (input.isActive === false) {
        const active = await one<{ count: string }>(
          'SELECT count(*)::text count FROM teams WHERE workspace_id=$1 AND is_active AND id<>$2',
          [workspaceId, teamId],
        );
        if (Number(active?.count ?? 0) < 2)
          throw new ApiError(409, 'TEAM_COUNT', 'At least two active teams must remain');
      }
      let team: Record<string, unknown> | undefined;
      try {
        team = (await one(
          `UPDATE teams SET
            code=COALESCE($3,code),
            name=COALESCE($4,name),
            display_name=COALESCE($5,display_name),
            color=CASE WHEN $6::boolean THEN $7 ELSE color END,
            icon=CASE WHEN $8::boolean THEN $9 ELSE icon END,
            sort_order=COALESCE($10,sort_order),
            is_active=COALESCE($11,is_active),
            updated_at=now()
          WHERE id=$1 AND workspace_id=$2
          RETURNING *`,
          [
            teamId,
            workspaceId,
            input.code?.toLowerCase() ?? null,
            input.name ?? null,
            input.displayName ?? null,
            input.color !== undefined,
            input.color === undefined ? null : input.color,
            input.icon !== undefined,
            input.icon === undefined ? null : input.icon,
            input.sortOrder ?? null,
            input.isActive ?? null,
          ],
        )) as Record<string, unknown>;
      } catch (error) {
        if ((error as { code?: string }).code === '23505')
          throw new ApiError(409, 'TEAM_CONFLICT', 'Team code or name already exists');
        throw error;
      }
      await audit(request, 'workspace.team.update', 'team', teamId, {
        workspaceId,
        after: input,
      });
      return { data: camelize(team) };
    },
  );

  app.delete(
    '/:workspaceId/teams/:teamId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId, teamId } = request.params as { workspaceId: string; teamId: string };
      await requireActiveWorkspace(workspaceId);
      const existing = await one<{ id: string; is_active: boolean }>(
        'SELECT id,is_active FROM teams WHERE id=$1 AND workspace_id=$2',
        [teamId, workspaceId],
      );
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
      if (existing.is_active) {
        const active = await one<{ count: string }>(
          'SELECT count(*)::text count FROM teams WHERE workspace_id=$1 AND is_active AND id<>$2',
          [workspaceId, teamId],
        );
        if (Number(active?.count ?? 0) < 2)
          throw new ApiError(409, 'TEAM_COUNT', 'At least two active teams must remain');
      }
      const hasHistory = await one<{ has: boolean }>(
        `SELECT (
           EXISTS(SELECT 1 FROM score_ledger WHERE workspace_id=$1 AND team_id=$2)
           OR EXISTS(SELECT 1 FROM activity_results WHERE workspace_id=$1 AND team_id=$2)
         ) AS has`,
        [workspaceId, teamId],
      );
      if (hasHistory?.has) {
        await one(
          'UPDATE teams SET is_active=false, updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING id',
          [teamId, workspaceId],
        );
        await audit(request, 'workspace.team.deactivate', 'team', teamId, { workspaceId });
        return reply.status(200).send({ data: { id: teamId, deleted: false, deactivated: true } });
      }
      await one('DELETE FROM teams WHERE id=$1 AND workspace_id=$2 RETURNING id', [
        teamId,
        workspaceId,
      ]);
      await audit(request, 'workspace.team.delete', 'team', teamId, { workspaceId });
      return reply.status(204).send();
    },
  );
}
