import { rankTeams, ruleDefinitionSchema } from '@tadscore/rule-engine';
import { one, rows, type DbClient } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { camelize } from '../../lib/dto.js';

export async function getRanking(workspaceId: string, client?: DbClient) {
  const workspace = await one<{ id: string; name: string; rule_snapshot: unknown; status: string }>(
    'SELECT id,name,rule_snapshot,status FROM workspaces WHERE id=$1',
    [workspaceId],
    client,
  );
  if (!workspace || workspace.status === 'suspended')
    throw new ApiError(404, 'NOT_FOUND', 'Ranking not found');
  const rule = ruleDefinitionSchema.parse(workspace.rule_snapshot);
  const balances = await rows<{
    team_id: string;
    name: string;
    display_name: string;
    color: string | null;
    icon: string | null;
    medals: string;
    pieces: string;
    items: string;
  }>(
    `SELECT t.id team_id,t.name,t.display_name,t.color,t.icon,COALESCE(SUM(l.medal_delta),0)::text medals,COALESCE(SUM(l.piece_delta),0)::text pieces,COALESCE(SUM(l.item_delta),0)::text items FROM teams t LEFT JOIN score_ledger l ON l.team_id=t.id AND l.workspace_id=t.workspace_id WHERE t.workspace_id=$1 AND t.is_active GROUP BY t.id ORDER BY t.sort_order,t.name`,
    [workspaceId],
    client,
  );
  const metadata = new Map(balances.map((row) => [row.team_id, row]));
  const ranked = rankTeams(
    rule,
    balances.map((row) => ({
      teamId: row.team_id,
      name: row.name,
      medals: Number(row.medals),
      pieces: Number(row.pieces),
      items: Number(row.items),
    })),
  );
  const updated = await one<{ updated_at: Date | null }>(
    'SELECT max(created_at) updated_at FROM score_ledger WHERE workspace_id=$1',
    [workspaceId],
    client,
  );
  return {
    workspace: { id: workspace.id, name: workspace.name },
    workspaceName: workspace.name,
    rule: {
      id: rule.id,
      version: rule.version,
      name: rule.name,
      minimumPieces: rule.ranking.minimumPieces,
    },
    ruleName: rule.name,
    updatedAt: updated?.updated_at ?? null,
    teams: ranked.map((team) => ({
      ...team,
      displayName: metadata.get(team.teamId)?.display_name,
      color: metadata.get(team.teamId)?.color,
      icon: metadata.get(team.teamId)?.icon,
    })),
  };
}

export async function getTeamDetail(workspaceId: string, teamId: string, client?: DbClient) {
  const ranking = await getRanking(workspaceId, client);
  const team = ranking.teams.find((item) => item.teamId === teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const ledger = await rows(
    `SELECT l.id,l.entry_type,l.medal_delta,l.piece_delta,l.item_delta,l.metadata,l.created_at,l.reverses_entry_id,a.name activity_name,u.full_name created_by_name,r.created_at reversed_at FROM score_ledger l LEFT JOIN activities a ON a.id=l.activity_id JOIN users u ON u.id=l.created_by LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id WHERE l.workspace_id=$1 AND l.team_id=$2 ORDER BY l.created_at DESC`,
    [workspaceId, teamId],
    client,
  );
  return { ...team, ledger: camelize(ledger) };
}

export async function getPublicTeamDetail(workspaceId: string, teamId: string) {
  const ranking = await getRanking(workspaceId);
  const team = ranking.teams.find((item) => item.teamId === teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const ledger = await rows(
    `SELECT l.id,l.entry_type,l.medal_delta,l.piece_delta,l.item_delta,l.created_at,l.reverses_entry_id,a.name activity_name,r.created_at reversed_at FROM score_ledger l LEFT JOIN activities a ON a.id=l.activity_id LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id WHERE l.workspace_id=$1 AND l.team_id=$2 ORDER BY l.created_at DESC`,
    [workspaceId, teamId],
  );
  return { ...team, ledger: camelize(ledger) };
}
