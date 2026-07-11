import { one } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';

export function workspaceDto(row: Record<string, unknown>) {
  const snapshot = row.rule_snapshot as { name?: string } | undefined;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    ruleId: row.rule_id,
    ruleVersion: row.rule_version,
    rule: { id: row.rule_id, version: row.rule_version, name: snapshot?.name },
    status: row.status,
    role: row.role,
    memberCount: Number(row.member_count ?? 0),
    createdAt: row.created_at,
  };
}

export async function requireActiveWorkspace(workspaceId: string) {
  const workspace = await one<{ status: string }>('SELECT status FROM workspaces WHERE id=$1', [
    workspaceId,
  ]);
  if (!workspace) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
  if (workspace.status !== 'active')
    throw new ApiError(409, 'WORKSPACE_READ_ONLY', 'Only active workspaces can be changed');
}
