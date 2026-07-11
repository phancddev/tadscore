import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit.js';
import { one, transaction } from '../../lib/db.js';
import { camelize } from '../../lib/dto.js';
import { ApiError } from '../../lib/errors.js';
import { hashToken } from '../../lib/security.js';
import { authenticate } from '../auth/guards.js';

export async function invitationRoutes(app: FastifyInstance) {
  app.get('/:token', async (request) => {
    const invitation = await one<Record<string, unknown>>(
      `SELECT i.kind,i.role,i.expires_at,i.status,w.id workspace_id,w.name workspace_name FROM workspace_invitations i JOIN workspaces w ON w.id=i.workspace_id WHERE i.token_hash=$1 AND i.status='pending' AND i.expires_at>now() AND w.status<>'suspended'`,
      [hashToken((request.params as { token: string }).token)],
    );
    if (!invitation) throw new ApiError(404, 'NOT_FOUND', 'Invitation not found or expired');
    return { data: camelize(invitation) };
  });
  app.post('/:token/accept', { preHandler: authenticate }, async (request) => {
    const { token } = request.params as { token: string };
    const result = await transaction(async (client) => {
      const invitation = (
        await client.query<{
          id: string;
          workspace_id: string;
          kind: string;
          email: string | null;
          role: string;
          use_count: number;
        }>(
          `SELECT i.id,i.workspace_id,i.kind,i.email,i.role,i.use_count FROM workspace_invitations i JOIN workspaces w ON w.id=i.workspace_id WHERE i.token_hash=$1 AND i.status='pending' AND i.expires_at>now() AND w.status='active' FOR UPDATE OF i`,
          [hashToken(token)],
        )
      ).rows[0];
      if (
        !invitation ||
        (invitation.kind === 'email' &&
          invitation.email?.toLowerCase() !== request.user!.email.toLowerCase())
      )
        throw new ApiError(400, 'INVALID_INVITATION', 'Invitation is invalid or expired');
      const accepted = await client.query(
        'SELECT 1 FROM invitation_acceptances WHERE invitation_id=$1 AND user_id=$2',
        [invitation.id, request.user!.id],
      );
      if (accepted.rowCount)
        return {
          data: { workspaceId: invitation.workspace_id, role: invitation.role, idempotent: true },
        };
      await client.query(
        `INSERT INTO workspace_members(workspace_id,user_id,role,invited_by) SELECT workspace_id,$2,role,invited_by FROM workspace_invitations WHERE id=$1 ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role,status='active',removed_at=NULL`,
        [invitation.id, request.user!.id],
      );
      await client.query(
        'INSERT INTO invitation_acceptances(invitation_id,user_id) VALUES($1,$2)',
        [invitation.id, request.user!.id],
      );
      await client.query(
        "UPDATE workspace_invitations SET use_count=use_count+1,status=CASE WHEN use_count+1>=max_uses THEN 'accepted' ELSE status END WHERE id=$1",
        [invitation.id],
      );
      return { data: { workspaceId: invitation.workspace_id, role: invitation.role } };
    });
    await audit(request, 'workspace.invitation.accept', 'workspace', result.data.workspaceId, {
      workspaceId: result.data.workspaceId,
      after: { role: result.data.role },
    });
    return result;
  });
}
