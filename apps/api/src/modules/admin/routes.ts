import type { FastifyInstance } from 'fastify';
import { globalRoleSchema } from '@tadscore/contracts';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { pool, rows } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { camelize } from '../../lib/dto.js';
import { requireSuperAdmin } from '../auth/guards.js';
import { ruleRegistry } from '../rules/registry.js';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireSuperAdmin);
  app.get('/users', async (request) => {
    const q = request.query as {
      search?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
    const search = `%${q.search ?? ''}%`;
    const limit = Math.min(Number(q.limit) || 100, 500);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const where = `($1='%%' OR email ILIKE $1 OR username ILIKE $1 OR full_name ILIKE $1) AND ($2::text IS NULL OR status::text=$2)`;
    const data = await rows<Record<string, unknown>>(
      `SELECT id,email,username,full_name,global_role,status,avatar_path,email_verified_at,created_at,updated_at FROM users WHERE ${where} ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [search, q.status ?? null, limit, offset],
    );
    const total = await pool.query<{ count: string }>(
      `SELECT count(*)::text count FROM users WHERE ${where}`,
      [search, q.status ?? null],
    );
    return {
      data: {
        items: data.map((row) => {
          const item = camelize(row) as Record<string, unknown>;
          delete item.avatarPath;
          return {
            ...item,
            avatarUrl: row.avatar_path ? `/uploads/${row.avatar_path}` : null,
          };
        }),
        total: Number(total.rows[0]?.count ?? 0),
        limit,
        offset,
      },
    };
  });
  app.patch('/users/:userId', async (request) => {
    const { userId } = request.params as { userId: string };
    const input = z
      .object({
        role: globalRoleSchema.optional(),
        status: z.enum(['pending', 'active', 'suspended']).optional(),
        markVerified: z.boolean().optional(),
      })
      .parse(request.body);
    if (userId === request.user!.id && (input.status === 'suspended' || input.role === 'user'))
      throw new ApiError(409, 'SELF_LOCKOUT', 'You cannot remove your own administrator access');
    const result = await pool.query(
      `UPDATE users SET global_role=COALESCE($1,global_role),status=COALESCE($2,status),email_verified_at=CASE WHEN $3 THEN COALESCE(email_verified_at,now()) ELSE email_verified_at END WHERE id=$4 RETURNING id,email,username,full_name,global_role,status,email_verified_at`,
      [input.role ?? null, input.status ?? null, input.markVerified ?? false, userId],
    );
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'User not found');
    await audit(request, 'admin.user.update', 'user', userId, { after: camelize(result.rows[0]) });
    return { data: camelize(result.rows[0]) };
  });
  app.get('/workspaces', async (request) => {
    const q = request.query as { search?: string };
    const data = await rows(
      "SELECT w.id,w.name,w.slug,w.status,w.rule_id,w.rule_version,w.rule_snapshot->>'name' rule_name,w.created_at,u.email owner_email,(SELECT count(*) FROM workspace_members m WHERE m.workspace_id=w.id AND m.status='active')::int member_count FROM workspaces w JOIN users u ON u.id=w.owner_user_id WHERE $1='%%' OR w.name ILIKE $1 OR w.slug ILIKE $1 ORDER BY w.created_at DESC",
      [`%${q.search ?? ''}%`],
    );
    return { data: { items: camelize(data), total: data.length } };
  });
  app.patch('/workspaces/:workspaceId/status', async (request) => {
    const status = z.object({ status: z.enum(['active', 'suspended']) }).parse(request.body).status;
    const workspaceId = (request.params as { workspaceId: string }).workspaceId;
    const result = await pool.query(
      'UPDATE workspaces SET status=$1 WHERE id=$2 RETURNING id,name,slug,status',
      [status, workspaceId],
    );
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
    await audit(request, 'admin.workspace.status', 'workspace', workspaceId, {
      workspaceId,
      after: { status },
    });
    return { data: camelize(result.rows[0]) };
  });
  app.get('/audit-logs', async (request) => {
    const q = request.query as { workspaceId?: string; actorId?: string; limit?: string };
    const data = await rows(
      'SELECT a.id,a.workspace_id,a.actor_user_id,u.full_name actor_name,a.action,a.entity_type,a.entity_id,a.request_id,a.created_at,a.before_data,a.after_data,a.metadata FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id WHERE ($1::uuid IS NULL OR a.workspace_id=$1) AND ($2::uuid IS NULL OR a.actor_user_id=$2) ORDER BY a.created_at DESC LIMIT $3',
      [q.workspaceId ?? null, q.actorId ?? null, Math.min(Number(q.limit) || 200, 1000)],
    );
    return { data: { items: camelize(data), total: data.length } };
  });
  app.get('/rules', async () => ({ data: ruleRegistry.health }));
  app.get('/outbox', async (request) => {
    const q = request.query as { status?: string };
    const data = await rows(
      'SELECT id,to_email,template,status,attempt_count,max_attempts,next_attempt_at,sent_at,last_error,created_at FROM email_outbox WHERE ($1::text IS NULL OR status::text=$1) ORDER BY created_at DESC LIMIT 500',
      [q.status ?? null],
    );
    return { data: { items: camelize(data), total: data.length } };
  });
  app.post('/outbox/:id/retry', async (request) => {
    const id = (request.params as { id: string }).id;
    const result = await pool.query(
      "UPDATE email_outbox SET status='pending',next_attempt_at=now(),last_error=NULL WHERE id=$1 AND status='failed' RETURNING id,status",
      [id],
    );
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Failed outbox item not found');
    await audit(request, 'admin.outbox.retry', 'email_outbox', id);
    return { data: camelize(result.rows[0]) };
  });
  app.get('/health', async () => {
    const db = await pool.query(
      "SELECT now() time,(SELECT count(*) FROM email_outbox WHERE status='failed')::int failed_emails",
    );
    return {
      data: {
        status: 'ok',
        database: true,
        time: db.rows[0].time,
        failedEmails: db.rows[0].failed_emails,
        rulesHealthy: ruleRegistry.health.every((item) => item.ok),
        emailVerificationMode: env().AUTH_EMAIL_VERIFICATION_MODE,
      },
    };
  });
}
