import { ruleDefinitionSchema } from '@tadscore/rule-engine';
import type { DbClient } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';

export async function loadMutableRule(client: DbClient, workspaceId: string) {
  const found = await client.query<{ rule_snapshot: unknown; status: string }>(
    'SELECT rule_snapshot,status FROM workspaces WHERE id=$1 FOR SHARE',
    [workspaceId],
  );
  const row = found.rows[0];
  if (!row || row.status !== 'active')
    throw new ApiError(409, 'WORKSPACE_READ_ONLY', 'Only active workspaces can be changed');
  return ruleDefinitionSchema.parse(row.rule_snapshot);
}
