import type { FastifyInstance } from 'fastify';
import { createPublicLinkSchema } from '@tadscore/contracts';
import { pool, rows, transaction } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { camelize } from '../../lib/dto.js';
import { hashToken, randomToken } from '../../lib/security.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { onRankingChange } from '../scoring/events.js';
import { getPublicTeamDetail, getRanking } from '../scoring/ranking.js';

async function workspaceForToken(token: string) {
  const result = await pool.query<{ id: string; workspace_id: string }>(
    `UPDATE public_ranking_links SET last_accessed_at=now() WHERE token_hash=$1 AND is_enabled AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) RETURNING id,workspace_id`,
    [hashToken(token)],
  );
  if (!result.rows[0])
    throw new ApiError(404, 'NOT_FOUND', 'Public ranking link not found or expired');
  return result.rows[0].workspace_id;
}

export async function publicLinkManagementRoutes(app: FastifyInstance) {
  app.get(
    '/:workspaceId/public-links',
    { preHandler: requireWorkspaceRole('admin') },
    async (request) => ({
      data: camelize(
        await rows(
          'SELECT id,slug,label,is_enabled,expires_at,created_at,last_accessed_at FROM public_ranking_links WHERE workspace_id=$1 ORDER BY created_at DESC',
          [(request.params as { workspaceId: string }).workspaceId],
        ),
      ),
    }),
  );
  app.post(
    '/:workspaceId/public-links',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = createPublicLinkSchema.parse(request.body);
      const token = randomToken();
      const workspace = await pool.query(
        "SELECT 1 FROM workspaces WHERE id=$1 AND status='active'",
        [workspaceId],
      );
      if (!workspace.rowCount)
        throw new ApiError(409, 'WORKSPACE_READ_ONLY', 'Only active workspaces can be changed');
      const link = (
        await pool.query(
          `INSERT INTO public_ranking_links(workspace_id,token_hash,slug,label,expires_at,created_by) VALUES($1,$2,$3,$4,CASE WHEN $5::int IS NULL THEN NULL ELSE now()+($5*interval '1 hour') END,$6) RETURNING id,slug,label,is_enabled,expires_at,created_at`,
          [
            workspaceId,
            hashToken(token),
            input.slug ?? null,
            input.label ?? null,
            input.expiresInHours ?? null,
            request.user!.id,
          ],
        )
      ).rows[0];
      await audit(request, 'workspace.public_link.create', 'public_ranking_link', String(link.id), {
        workspaceId,
      });
      return reply
        .status(201)
        .send({ data: { ...camelize(link), token, url: `/ranking/${token}` } });
    },
  );
  app.delete(
    '/:workspaceId/public-links/:linkId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId, linkId } = request.params as { workspaceId: string; linkId: string };
      const result = await pool.query(
        'UPDATE public_ranking_links SET is_enabled=false,revoked_at=now() WHERE id=$1 AND workspace_id=$2 AND is_enabled',
        [linkId, workspaceId],
      );
      if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Enabled public link not found');
      await audit(request, 'workspace.public_link.revoke', 'public_ranking_link', linkId, {
        workspaceId,
      });
      return reply.status(204).send();
    },
  );
  app.post(
    '/:workspaceId/public-links/:linkId/regenerate',
    { preHandler: requireWorkspaceRole('admin') },
    async (request) => {
      const { workspaceId, linkId } = request.params as { workspaceId: string; linkId: string };
      const token = randomToken();
      const result = await pool.query(
        "UPDATE public_ranking_links l SET token_hash=$1,is_enabled=true,revoked_at=NULL FROM workspaces w WHERE l.id=$2 AND l.workspace_id=$3 AND w.id=l.workspace_id AND w.status='active' RETURNING l.id,l.slug,l.label,l.is_enabled,l.expires_at",
        [hashToken(token), linkId, workspaceId],
      );
      if (!result.rows[0])
        throw new ApiError(404, 'NOT_FOUND', 'Public link not found or workspace is read-only');
      await audit(request, 'workspace.public_link.regenerate', 'public_ranking_link', linkId, {
        workspaceId,
      });
      return { data: { ...camelize(result.rows[0]), token, url: `/ranking/${token}` } };
    },
  );
}

export async function publicRankingRoutes(app: FastifyInstance) {
  app.get('/:token', async (request) => ({
    data: await getRanking(await workspaceForToken((request.params as { token: string }).token)),
  }));
  app.get('/:token/teams/:teamId', async (request) => {
    const { token, teamId } = request.params as { token: string; teamId: string };
    return { data: await getPublicTeamDetail(await workspaceForToken(token), teamId) };
  });
  app.get('/:token/events', async (request, reply) => {
    const { token } = request.params as { token: string };
    const workspaceId = await workspaceForToken(token);
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = async () => {
      try {
        reply.raw.write(
          `event: ranking\ndata: ${JSON.stringify(await getRanking(workspaceId))}\n\n`,
        );
      } catch {
        reply.raw.end();
      }
    };
    await send();
    const unsubscribe = onRankingChange(workspaceId, () => void send());
    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 20_000);
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
