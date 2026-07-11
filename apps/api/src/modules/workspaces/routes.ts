import type { FastifyInstance } from 'fastify';
import {
  createInvitationSchema,
  createWorkspaceSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from '@tadscore/contracts';
import { audit } from '../../lib/audit.js';
import { one, pool, rows, transaction } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { camelize } from '../../lib/dto.js';
import { queueEmail } from '../../lib/outbox.js';
import { hashToken, randomToken } from '../../lib/security.js';
import { authenticate, requireWorkspaceRole } from '../auth/guards.js';
import { ruleRegistry } from '../rules/registry.js';
import { requireActiveWorkspace, workspaceDto } from './helpers.js';
import { teamRoutes } from './team-routes.js';

export async function workspaceRoutes(app: FastifyInstance) {
  await teamRoutes(app);
  app.get('/', { preHandler: authenticate }, async (request) => {
    const data = await rows<Record<string, unknown>>(
      `SELECT w.*,m.role,(SELECT count(*) FROM workspace_members x WHERE x.workspace_id=w.id AND x.status='active') member_count FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=$1 AND m.status='active' WHERE w.status<>'suspended' ORDER BY w.created_at DESC`,
      [request.user!.id],
    );
    return { data: data.map(workspaceDto) };
  });

  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const input = createWorkspaceSchema.parse(request.body);
    const rule = ruleRegistry.get(input.ruleId, input.ruleVersion);
    if (!rule)
      throw new ApiError(400, 'RULE_NOT_FOUND', 'The selected rule is unavailable or invalid');
    const workspace = await transaction(async (client) => {
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO workspaces(name,slug,description,owner_user_id,rule_id,rule_version,rule_snapshot,rule_snapshot_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          input.name,
          input.slug,
          input.description ?? null,
          request.user!.id,
          input.ruleId,
          input.ruleVersion,
          rule.definition,
          rule.hash,
        ],
      );
      const row = inserted.rows[0]!;
      await client.query(
        "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",
        [row.id, request.user!.id],
      );
      const defaults: Array<[string, string, string, string, string, number]> = [
        ['lan', 'Lan', 'Nhà Lan', '#6366f1', 'flower', 1],
        ['mai', 'Mai', 'Nhà Mai', '#eab308', 'flower', 2],
        ['cuc', 'Cúc', 'Nhà Cúc', '#f97316', 'flower', 3],
        ['truc', 'Trúc', 'Nhà Trúc', '#22c55e', 'leaf', 4],
      ];
      while (defaults.length < rule.definition.teamCount) {
        const index = defaults.length + 1;
        defaults.push([
          `team-${index}`,
          `Team ${index}`,
          `Đội ${index}`,
          '#64748b',
          'shield',
          index,
        ]);
      }
      for (const team of defaults.slice(0, rule.definition.teamCount))
        await client.query(
          'INSERT INTO teams(workspace_id,code,name,display_name,color,icon,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [row.id, ...team],
        );
      for (const activity of rule.definition.activities)
        await client.query(
          "INSERT INTO activities(workspace_id,activity_key,name,activity_type,sequence_no,rule_config,status,created_by) VALUES($1,$2,$3,$4,$5,$6,'open',$7)",
          [
            row.id,
            activity.key,
            activity.name,
            activity.type,
            activity.sequence,
            activity,
            request.user!.id,
          ],
        );
      return row;
    });
    await audit(request, 'workspace.create', 'workspace', String(workspace.id), {
      workspaceId: String(workspace.id),
      after: { name: workspace.name },
    });
    return reply.status(201).send({ data: workspaceDto({ ...workspace, role: 'owner' }) });
  });

  app.get('/:workspaceId', { preHandler: requireWorkspaceRole('viewer') }, async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const workspace = await one<Record<string, unknown>>(
      "SELECT w.*,(SELECT count(*) FROM workspace_members m WHERE m.workspace_id=w.id AND m.status='active') member_count FROM workspaces w WHERE id=$1",
      [workspaceId],
    );
    if (!workspace) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
    return { data: workspaceDto({ ...workspace, role: request.workspaceRole }) };
  });
  app.patch('/:workspaceId', { preHandler: requireWorkspaceRole('admin') }, async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const input = updateWorkspaceSchema.parse(request.body);
    if (input.status === 'suspended' && request.user!.globalRole !== 'super_admin')
      throw new ApiError(403, 'FORBIDDEN', 'Only platform administrators can suspend workspaces');
    const updated = await one<Record<string, unknown>>(
      `UPDATE workspaces SET name=COALESCE($1,name),description=CASE WHEN $2::boolean THEN $3 ELSE description END,status=COALESCE($4,status),archived_at=CASE WHEN $4='archived' THEN now() ELSE archived_at END WHERE id=$5 RETURNING *`,
      [
        input.name ?? null,
        'description' in input,
        input.description ?? null,
        input.status ?? null,
        workspaceId,
      ],
    );
    await audit(request, 'workspace.update', 'workspace', workspaceId, {
      workspaceId,
      after: camelize(updated ?? {}),
    });
    return { data: workspaceDto({ ...updated!, role: request.workspaceRole }) };
  });
  app.get(
    '/:workspaceId/members',
    { preHandler: requireWorkspaceRole('viewer') },
    async (request) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const members = await rows(
        `SELECT u.id,u.email,u.username,u.full_name,u.avatar_path,m.role,m.status,m.joined_at FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY m.joined_at`,
        [workspaceId],
      );
      return { data: camelize(members) };
    },
  );
  app.patch(
    '/:workspaceId/members/:userId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request) => {
      const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
      await requireActiveWorkspace(workspaceId);
      const { role } = updateMemberSchema.parse(request.body);
      const result = await pool.query(
        "UPDATE workspace_members SET role=$1 WHERE workspace_id=$2 AND user_id=$3 AND role<>'owner' RETURNING user_id,role,status",
        [role, workspaceId, userId],
      );
      if (!result.rowCount)
        throw new ApiError(404, 'NOT_FOUND', 'Member not found or owner cannot be changed');
      await audit(request, 'workspace.member.role', 'user', userId, {
        workspaceId,
        after: { role },
      });
      return { data: camelize(result.rows[0]) };
    },
  );
  app.delete(
    '/:workspaceId/members/:userId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
      await requireActiveWorkspace(workspaceId);
      const result = await pool.query(
        "UPDATE workspace_members SET status='removed',removed_at=now() WHERE workspace_id=$1 AND user_id=$2 AND role<>'owner' AND status='active'",
        [workspaceId, userId],
      );
      if (!result.rowCount)
        throw new ApiError(404, 'NOT_FOUND', 'Active member not found or owner cannot be removed');
      await audit(request, 'workspace.member.remove', 'user', userId, { workspaceId });
      return reply.status(204).send();
    },
  );

  app.post(
    '/:workspaceId/invitations',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = createInvitationSchema.parse(request.body);
      const token = randomToken();
      await requireActiveWorkspace(workspaceId);
      const maxUses = input.kind === 'email' ? 1 : input.maxUses;
      const invite = await one<Record<string, unknown>>(
        `INSERT INTO workspace_invitations(workspace_id,kind,email,role,token_hash,expires_at,max_uses,invited_by) VALUES($1,$2,$3,$4,$5,now()+($6*interval '1 hour'),$7,$8) RETURNING id,kind,email,role,expires_at,max_uses,status`,
        [
          workspaceId,
          input.kind,
          input.email ?? null,
          input.role,
          hashToken(token),
          input.expiresInHours,
          maxUses,
          request.user!.id,
        ],
      );
      if (input.email) await queueEmail(pool, input.email, 'workspace_invite', { token });
      await audit(request, 'workspace.invitation.create', 'invitation', String(invite?.id), {
        workspaceId,
        after: { kind: input.kind, role: input.role },
      });
      return reply
        .status(201)
        .send({ data: { ...camelize(invite), token, inviteUrl: `/invite/${token}` } });
    },
  );
  app.get(
    '/:workspaceId/invitations',
    { preHandler: requireWorkspaceRole('admin') },
    async (request) => ({
      data: camelize(
        await rows(
          'SELECT id,kind,email,role,expires_at,max_uses,use_count,status,created_at FROM workspace_invitations WHERE workspace_id=$1 ORDER BY created_at DESC',
          [(request.params as { workspaceId: string }).workspaceId],
        ),
      ),
    }),
  );
  app.delete(
    '/:workspaceId/invitations/:inviteId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId, inviteId } = request.params as { workspaceId: string; inviteId: string };
      const result = await pool.query(
        "UPDATE workspace_invitations SET status='revoked',revoked_at=now() WHERE id=$1 AND workspace_id=$2 AND status='pending'",
        [inviteId, workspaceId],
      );
      if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Pending invitation not found');
      await audit(request, 'workspace.invitation.revoke', 'invitation', inviteId, { workspaceId });
      return reply.status(204).send();
    },
  );
}
