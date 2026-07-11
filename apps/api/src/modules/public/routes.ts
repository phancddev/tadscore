import type { FastifyInstance } from 'fastify';
import { createPublicLinkSchema, updatePublicLinkSchema } from '@tadscore/contracts';
import { pool } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { hashToken, randomToken } from '../../lib/security.js';
import { requireWorkspaceRole } from '../auth/guards.js';
import { onRankingChange } from '../scoring/events.js';
import { getPublicTeamDetail, getRanking } from '../scoring/ranking.js';
import {
  assertPathStillPublic,
  LINK_SELECT,
  linkPayload,
  listWorkspaceLinks,
  requireActiveWorkspace,
  resolvePublicLink,
  type LinkRow,
} from './link-helpers.js';

export async function publicLinkManagementRoutes(app: FastifyInstance) {
  app.get(
    '/:workspaceId/public-links',
    { preHandler: requireWorkspaceRole('admin') },
    async (request) => {
      const links = await listWorkspaceLinks(
        (request.params as { workspaceId: string }).workspaceId,
      );
      return { data: links.map((link) => linkPayload(link)) };
    },
  );

  app.post(
    '/:workspaceId/public-links',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const input = createPublicLinkSchema.parse(request.body);
      await requireActiveWorkspace(workspaceId);
      const token = randomToken();
      const both = input.isEnabled;
      const tokenEnabled = input.tokenEnabled ?? both ?? true;
      const slugEnabled = input.slugEnabled ?? both ?? true;
      const inserted = await pool.query<LinkRow>(
        `INSERT INTO public_ranking_links(
           workspace_id,token,token_hash,slug,label,is_enabled,token_enabled,slug_enabled,expires_at,created_by
         ) VALUES(
           $1,$2,$3,$4,$5,($6 OR $7),$6,$7,
           CASE WHEN $8::int IS NULL THEN NULL ELSE now()+($8*interval '1 hour') END,$9
         )
         ON CONFLICT (workspace_id) DO NOTHING
         RETURNING ${LINK_SELECT}`,
        [
          workspaceId,
          token,
          hashToken(token),
          input.slug ?? null,
          input.label ?? null,
          tokenEnabled,
          slugEnabled,
          input.expiresInHours ?? null,
          request.user!.id,
        ],
      );
      if (inserted.rows[0]) {
        await audit(
          request,
          'workspace.public_link.create',
          'public_ranking_link',
          String(inserted.rows[0].id),
          { workspaceId },
        );
        return reply.status(201).send({ data: linkPayload(inserted.rows[0], token) });
      }
      const existing = await pool.query<LinkRow>(
        `SELECT ${LINK_SELECT} FROM public_ranking_links WHERE workspace_id=$1`,
        [workspaceId],
      );
      if (!existing.rows[0]) throw new ApiError(500, 'INTERNAL_ERROR', 'Public link create failed');
      return { data: linkPayload(existing.rows[0]) };
    },
  );

  app.patch(
    '/:workspaceId/public-links/:linkId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request) => {
      const { workspaceId, linkId } = request.params as { workspaceId: string; linkId: string };
      const input = updatePublicLinkSchema.parse(request.body);
      await requireActiveWorkspace(workspaceId);

      const tokenEnabledPatch =
        input.tokenEnabled !== undefined
          ? input.tokenEnabled
          : input.isEnabled !== undefined
            ? input.isEnabled
            : undefined;
      const slugEnabledPatch =
        input.slugEnabled !== undefined
          ? input.slugEnabled
          : input.isEnabled !== undefined
            ? input.isEnabled
            : undefined;

      const result = await pool.query<LinkRow>(
        `UPDATE public_ranking_links SET
           slug=CASE WHEN $1::boolean THEN $2 ELSE slug END,
           label=CASE WHEN $3::boolean THEN $4 ELSE label END,
           token_enabled=CASE WHEN $5::boolean THEN $6 ELSE token_enabled END,
           slug_enabled=CASE WHEN $7::boolean THEN $8 ELSE slug_enabled END,
           is_enabled=(
             CASE WHEN $5::boolean THEN $6 ELSE token_enabled END
             OR CASE WHEN $7::boolean THEN $8 ELSE slug_enabled END
           ),
           revoked_at=CASE
             WHEN (
               CASE WHEN $5::boolean THEN $6 ELSE token_enabled END
               OR CASE WHEN $7::boolean THEN $8 ELSE slug_enabled END
             ) THEN NULL
             WHEN $5::boolean OR $7::boolean THEN COALESCE(revoked_at, now())
             ELSE revoked_at
           END,
           expires_at=CASE
             WHEN $9::boolean AND $10::int IS NULL THEN NULL
             WHEN $9::boolean THEN now()+($10*interval '1 hour')
             ELSE expires_at
           END
         WHERE id=$11 AND workspace_id=$12
         RETURNING ${LINK_SELECT}`,
        [
          input.slug !== undefined,
          input.slug === undefined ? null : input.slug,
          input.label !== undefined,
          input.label === undefined ? null : input.label,
          tokenEnabledPatch !== undefined,
          tokenEnabledPatch ?? null,
          slugEnabledPatch !== undefined,
          slugEnabledPatch ?? null,
          input.expiresInHours !== undefined,
          input.expiresInHours ?? null,
          linkId,
          workspaceId,
        ],
      );
      if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Public link not found');
      await audit(request, 'workspace.public_link.update', 'public_ranking_link', linkId, {
        workspaceId,
        after: input,
      });
      return { data: linkPayload(result.rows[0]) };
    },
  );

  app.delete(
    '/:workspaceId/public-links/:linkId',
    { preHandler: requireWorkspaceRole('admin') },
    async (request, reply) => {
      const { workspaceId, linkId } = request.params as { workspaceId: string; linkId: string };
      const result = await pool.query(
        `UPDATE public_ranking_links
         SET is_enabled=false,token_enabled=false,slug_enabled=false,revoked_at=now()
         WHERE id=$1 AND workspace_id=$2`,
        [linkId, workspaceId],
      );
      if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Public link not found');
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
      const result = await pool.query<LinkRow>(
        `UPDATE public_ranking_links l
         SET token=$1,token_hash=$2
         FROM workspaces w
         WHERE l.id=$3 AND l.workspace_id=$4 AND w.id=l.workspace_id AND w.status='active'
         RETURNING l.id,l.token,l.slug,l.label,l.is_enabled,l.token_enabled,l.slug_enabled,
                   l.expires_at,l.created_at,l.last_accessed_at`,
        [token, hashToken(token), linkId, workspaceId],
      );
      if (!result.rows[0])
        throw new ApiError(404, 'NOT_FOUND', 'Public link not found or workspace is read-only');
      await audit(request, 'workspace.public_link.regenerate', 'public_ranking_link', linkId, {
        workspaceId,
      });
      return { data: linkPayload(result.rows[0], token) };
    },
  );
}

export async function publicRankingRoutes(app: FastifyInstance) {
  app.get('/:token', async (request) => ({
    data: await getRanking(
      (await resolvePublicLink((request.params as { token: string }).token)).workspaceId,
    ),
  }));
  app.get('/:token/teams/:teamId', async (request) => {
    const { token, teamId } = request.params as { token: string; teamId: string };
    return {
      data: await getPublicTeamDetail((await resolvePublicLink(token)).workspaceId, teamId),
    };
  });
  app.get('/:token/events', async (request, reply) => {
    const { token } = request.params as { token: string };
    const { linkId, workspaceId, via } = await resolvePublicLink(token);
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    };
    const send = async () => {
      try {
        await assertPathStillPublic(linkId, via);
        reply.raw.write(
          `event: ranking\ndata: ${JSON.stringify(await getRanking(workspaceId))}\n\n`,
        );
      } catch {
        close();
      }
    };
    const unsubscribe = onRankingChange(workspaceId, () => void send());
    const heartbeat = setInterval(() => {
      void assertPathStillPublic(linkId, via)
        .then(() => {
          if (!closed) reply.raw.write(': heartbeat\n\n');
        })
        .catch(() => close());
    }, 20_000);
    request.raw.on('close', close);
    await send();
  });
}
