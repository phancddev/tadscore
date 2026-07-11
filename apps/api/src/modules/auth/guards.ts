import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { one } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { hashToken } from '../../lib/security.js';
import type { WorkspaceRole } from '@tadscore/contracts';

export async function authenticate(request: FastifyRequest) {
  const token = request.cookies[env().SESSION_COOKIE_NAME];
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  const user = await one<{
    id: string;
    email: string;
    username: string;
    full_name: string;
    global_role: 'super_admin' | 'user';
    status: string;
  }>(
    `SELECT u.id,u.email,u.username,u.full_name,u.global_role,u.status FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`,
    [hashToken(token)],
  );
  if (!user || user.status !== 'active')
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  request.user = {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.full_name,
    globalRole: user.global_role,
    status: user.status,
  };
}
export async function requireSuperAdmin(request: FastifyRequest) {
  await authenticate(request);
  if (request.user?.globalRole !== 'super_admin')
    throw new ApiError(403, 'FORBIDDEN', 'Super administrator access required');
}
const levels: Record<WorkspaceRole, number> = { viewer: 0, scorer: 1, admin: 2, owner: 3 };
export function requireWorkspaceRole(minimum: WorkspaceRole) {
  return async (request: FastifyRequest) => {
    await authenticate(request);
    const workspaceId = (request.params as { workspaceId?: string }).workspaceId;
    if (!workspaceId) throw new ApiError(400, 'WORKSPACE_REQUIRED', 'Workspace is required');
    if (request.user?.globalRole === 'super_admin') {
      request.workspaceRole = 'owner';
      return;
    }
    const member = await one<{ role: WorkspaceRole }>(
      `SELECT m.role FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status<>'suspended'`,
      [workspaceId, request.user?.id],
    );
    if (!member || levels[member.role] < levels[minimum])
      throw new ApiError(403, 'FORBIDDEN', 'Insufficient workspace permission');
    request.workspaceRole = member.role;
  };
}
export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(env().SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env().COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: env().SESSION_TTL_SECONDS,
  });
}
