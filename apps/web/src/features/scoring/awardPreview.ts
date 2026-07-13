import type { Team } from '../../lib/types';

export type AwardPreviewRow = {
  teamId: string;
  teamName: string;
  rank: number;
  medals: number;
  pieces: number;
};

/**
 * Expected awards for assigned ranks (same indexing as rule-engine activityAward:
 * rank 1 → awards[0]). Incomplete ranks include only assigned teams.
 * Sorted by place ascending when every assigned rank is unique; otherwise by team order.
 */
export function buildAwardPreviewRows(
  teams: Team[],
  ranks: Record<string, number>,
  medalAwards?: number[] | null,
  pieceAwards?: number[] | null,
): AwardPreviewRow[] {
  const medals = medalAwards ?? [];
  const pieces = pieceAwards ?? [];
  const rows: AwardPreviewRow[] = [];
  for (const team of teams) {
    const rank = ranks[team.teamId];
    if (!Number.isInteger(rank) || rank < 1) continue;
    rows.push({
      teamId: team.teamId,
      teamName: team.displayName || team.name,
      rank,
      medals: medals[rank - 1] ?? 0,
      pieces: pieces[rank - 1] ?? 0,
    });
  }
  const ranksUnique = new Set(rows.map((row) => row.rank)).size === rows.length;
  if (ranksUnique) rows.sort((a, b) => a.rank - b.rank);
  return rows;
}
