import { pool, rows } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { camelize } from '../../lib/dto.js';
import { hashToken } from '../../lib/security.js';

export type AccessVia = 'token' | 'slug';

export type LinkRow = {
  id: string;
  token: string | null;
  slug: string | null;
  label: string | null;
  is_enabled: boolean;
  token_enabled: boolean;
  slug_enabled: boolean;
  expires_at: Date | null;
  created_at: Date;
  last_accessed_at: Date | null;
};

export const LINK_SELECT =
  'id,token,slug,label,is_enabled,token_enabled,slug_enabled,expires_at,created_at,last_accessed_at' as const;

export function linkPayload(link: LinkRow, tokenOverride?: string) {
  const token = tokenOverride ?? link.token ?? undefined;
  return {
    ...camelize(link),
    token,
    url: token ? `/ranking/${token}` : undefined,
    slugUrl: link.slug ? `/ranking/${link.slug}` : null,
  };
}

export async function requireActiveWorkspace(workspaceId: string) {
  const workspace = await pool.query("SELECT 1 FROM workspaces WHERE id=$1 AND status='active'", [
    workspaceId,
  ]);
  if (!workspace.rowCount)
    throw new ApiError(409, 'WORKSPACE_READ_ONLY', 'Only active workspaces can be changed');
}

/** Resolve public path key → workspace. Token and slug visibility are independent. */
export async function resolvePublicLink(accessKey: string) {
  const found = await pool.query<{ id: string; workspace_id: string; via: AccessVia }>(
    `SELECT id,workspace_id,via FROM (
       SELECT id,workspace_id,'token'::text AS via,0 AS priority
         FROM public_ranking_links
        WHERE revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at>now())
          AND token_enabled
          AND (token=$1 OR token_hash=$2)
       UNION ALL
       SELECT id,workspace_id,'slug'::text AS via,1 AS priority
         FROM public_ranking_links
        WHERE revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at>now())
          AND slug_enabled
          AND slug=$1
     ) matches
     ORDER BY priority
     LIMIT 1`,
    [accessKey, hashToken(accessKey)],
  );
  if (!found.rows[0])
    throw new ApiError(404, 'NOT_FOUND', 'Public ranking link not found or expired');
  await pool.query('UPDATE public_ranking_links SET last_accessed_at=now() WHERE id=$1', [
    found.rows[0].id,
  ]);
  return {
    linkId: found.rows[0].id,
    workspaceId: found.rows[0].workspace_id,
    via: found.rows[0].via,
  };
}

export async function assertPathStillPublic(linkId: string, via: AccessVia) {
  const column = via === 'token' ? 'token_enabled' : 'slug_enabled';
  const found = await pool.query<{ workspace_id: string }>(
    `SELECT workspace_id FROM public_ranking_links
     WHERE id=$1 AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at>now())
       AND ${column}=true`,
    [linkId],
  );
  if (!found.rows[0])
    throw new ApiError(404, 'NOT_FOUND', 'Public ranking link not found or expired');
  return found.rows[0].workspace_id;
}

export async function listWorkspaceLinks(workspaceId: string) {
  return rows<LinkRow>(
    `SELECT ${LINK_SELECT} FROM public_ranking_links WHERE workspace_id=$1 ORDER BY created_at DESC`,
    [workspaceId],
  );
}
