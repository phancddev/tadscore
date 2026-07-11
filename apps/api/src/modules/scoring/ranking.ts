import { rankTeams, ruleDefinitionSchema } from '@tadscore/rule-engine';
import { one, rows, type DbClient } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';

export async function getRanking(workspaceId: string, client?: DbClient) {
  const workspace = await one<{ id: string; name: string; rule_snapshot: unknown; status: string }>(
    'SELECT id,name,rule_snapshot,status FROM workspaces WHERE id=$1',
    [workspaceId],
    client,
  );
  if (!workspace || workspace.status === 'suspended')
    throw new ApiError(404, 'NOT_FOUND', 'Ranking not found');
  const rule = ruleDefinitionSchema.parse(workspace.rule_snapshot);
  const pieceLimit = rule.constraints.purchasePieceLimitBeforeActivity;
  const balances = await rows<{
    team_id: string;
    name: string;
    display_name: string;
    color: string | null;
    icon: string | null;
    medals: string;
    pieces: string;
    items: string;
    shop_pieces_bought: string;
  }>(
    `SELECT t.id team_id,t.name,t.display_name,t.color,t.icon,
      COALESCE(SUM(l.medal_delta),0)::text medals,
      COALESCE(SUM(l.piece_delta),0)::text pieces,
      COALESCE(SUM(l.item_delta),0)::text items,
      COALESCE((
        SELECT SUM(p.quantity)
        FROM purchases p
        WHERE p.workspace_id=t.workspace_id
          AND p.team_id=t.id
          AND p.item_key='piece'
          AND p.status='completed'
      ),0)::text shop_pieces_bought
     FROM teams t
     LEFT JOIN score_ledger l ON l.team_id=t.id AND l.workspace_id=t.workspace_id
     WHERE t.workspace_id=$1 AND t.is_active
     GROUP BY t.id
     ORDER BY t.sort_order,t.name`,
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
  const limitGate = await one<{ finalized: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM activities
       WHERE workspace_id=$1 AND activity_key=$2 AND status='finalized'
     ) AS finalized`,
    [workspaceId, pieceLimit.activityKey],
    client,
  );
  const pieceLimitActive = !limitGate?.finalized;
  return {
    workspace: { id: workspace.id, name: workspace.name },
    workspaceName: workspace.name,
    rule: {
      id: rule.id,
      version: rule.version,
      name: rule.name,
      minimumPieces: rule.ranking.minimumPieces,
    },
    /** Shop prices/limits from workspace rule_snapshot (not live registry). */
    shop: {
      piece: rule.shop.piece,
      item: rule.shop.item,
      minimumPieces: rule.ranking.minimumPieces,
      pieceLimit: {
        activityKey: pieceLimit.activityKey,
        max: pieceLimit.max,
        active: pieceLimitActive,
      },
    },
    ruleName: rule.name,
    updatedAt: updated?.updated_at ?? null,
    teams: ranked.map((team) => {
      const meta = metadata.get(team.teamId);
      return {
        ...team,
        displayName: meta?.display_name,
        color: meta?.color,
        icon: meta?.icon,
        shopPiecesBought: Number(meta?.shop_pieces_bought ?? 0),
      };
    }),
  };
}

type LedgerRow = {
  id: string;
  entry_type: string;
  medal_delta: number;
  piece_delta: number;
  item_delta: number;
  created_at: Date;
  reverses_entry_id: string | null;
  activity_name: string | null;
  reversed_at: Date | null;
  activity_rank: number | null;
  adjustment_kind: string | null;
  note: string | null;
  created_by_name?: string | null;
  metadata?: Record<string, unknown> | null;
};

function buildTeamDetail(
  team: Record<string, unknown>,
  ledger: LedgerRow[],
  options: { publicView: boolean },
) {
  const entries = ledger.map((row) => {
    const base = {
      id: row.id,
      entryType: row.entry_type,
      medalDelta: row.medal_delta,
      pieceDelta: row.piece_delta,
      itemDelta: row.item_delta,
      createdAt: row.created_at,
      reversesEntryId: row.reverses_entry_id,
      activityName: row.activity_name,
      reversedAt: row.reversed_at,
      activityRank: row.activity_rank,
      adjustmentKind: row.adjustment_kind,
      note: row.note,
    };
    if (options.publicView) return base;
    return {
      ...base,
      createdByName: row.created_by_name ?? null,
      metadata: row.metadata ?? null,
    };
  });
  const wins = entries
    .filter(
      (entry) =>
        entry.entryType === 'activity_award' &&
        entry.activityRank === 1 &&
        !entry.reversedAt &&
        !entry.reversesEntryId,
    )
    .map((entry) => ({
      entryId: entry.id,
      activityName: entry.activityName,
      medals: entry.medalDelta,
      pieces: entry.pieceDelta,
      createdAt: entry.createdAt,
    }));
  const adjustments = entries.filter(
    (entry) =>
      ['adjustment', 'penalty'].includes(entry.entryType) &&
      !entry.reversedAt &&
      !entry.reversesEntryId,
  );
  return {
    ...team,
    wins,
    winCount: wins.length,
    totalMedalGain: entries
      .filter((entry) => entry.medalDelta > 0 && !entry.reversedAt)
      .reduce((sum, entry) => sum + entry.medalDelta, 0),
    totalMedalLoss: entries
      .filter((entry) => entry.medalDelta < 0 && !entry.reversedAt)
      .reduce((sum, entry) => sum + entry.medalDelta, 0),
    adjustmentCount: adjustments.length,
    ledger: entries,
  };
}

export async function getTeamDetail(workspaceId: string, teamId: string, client?: DbClient) {
  const ranking = await getRanking(workspaceId, client);
  const team = ranking.teams.find((item) => item.teamId === teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const ledger = await rows<LedgerRow>(
    `SELECT l.id,l.entry_type,l.medal_delta,l.piece_delta,l.item_delta,l.metadata,l.created_at,l.reverses_entry_id,
      a.name activity_name,u.full_name created_by_name,r.created_at reversed_at,
      NULLIF(l.metadata->>'rank','')::int activity_rank,
      NULLIF(l.metadata->>'kind','') adjustment_kind,
      NULLIF(l.metadata->>'reason','') note
     FROM score_ledger l
     LEFT JOIN activities a ON a.id=l.activity_id
     JOIN users u ON u.id=l.created_by
     LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id
     WHERE l.workspace_id=$1 AND l.team_id=$2
     ORDER BY l.created_at DESC`,
    [workspaceId, teamId],
    client,
  );
  return buildTeamDetail(team, ledger, { publicView: false });
}

export async function getPublicTeamDetail(workspaceId: string, teamId: string) {
  const ranking = await getRanking(workspaceId);
  const team = ranking.teams.find((item) => item.teamId === teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const ledger = await rows<LedgerRow>(
    `SELECT l.id,l.entry_type,l.medal_delta,l.piece_delta,l.item_delta,l.created_at,l.reverses_entry_id,
      a.name activity_name,r.created_at reversed_at,
      NULLIF(l.metadata->>'rank','')::int activity_rank,
      NULLIF(l.metadata->>'kind','') adjustment_kind,
      NULLIF(l.metadata->>'reason','') note
     FROM score_ledger l
     LEFT JOIN activities a ON a.id=l.activity_id
     LEFT JOIN score_ledger r ON r.reverses_entry_id=l.id
     WHERE l.workspace_id=$1 AND l.team_id=$2
     ORDER BY l.created_at DESC`,
    [workspaceId, teamId],
  );
  return buildTeamDetail(team, ledger, { publicView: true });
}
