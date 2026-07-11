import type { RankedTeam, RuleDefinition, TeamBalance } from './schema.js';

export function activityAward(rule: RuleDefinition, activityKey: string, rank: number) {
  const activity = rule.activities.find((candidate) => candidate.key === activityKey);
  if (!activity || activity.type !== 'ranked_game') throw new Error('Unknown ranked activity');
  if (rank < 1 || rank > rule.teamCount) throw new Error('Rank out of range');
  return {
    medals: activity.medalAwards?.[rank - 1] ?? 0,
    pieces: activity.pieceAwards?.[rank - 1] ?? 0,
  };
}

export function rankTeams(rule: RuleDefinition, teams: TeamBalance[]): RankedTeam[] {
  const minimum = rule.ranking.minimumPieces;
  return [...teams]
    .sort((a, b) => {
      const aEligible = a.pieces >= minimum;
      const bEligible = b.pieces >= minimum;
      if (aEligible !== bEligible) return aEligible ? -1 : 1;
      if (aEligible && bEligible && a.medals !== b.medals) return b.medals - a.medals;
      if (!aEligible && !bEligible && a.pieces !== b.pieces) return b.pieces - a.pieces;
      if (a.medals !== b.medals) return b.medals - a.medals;
      const byName = a.name.localeCompare(b.name, 'vi');
      return byName || a.teamId.localeCompare(b.teamId);
    })
    .map((team, index) => ({ ...team, rank: index + 1, eligible: team.pieces >= minimum }));
}

export function purchaseCost(rule: RuleDefinition, itemKey: string, quantity: number) {
  const item = rule.shop[itemKey];
  if (!item) throw new Error('Unknown shop item');
  return {
    medalCost: item.medalCost * quantity,
    medalDelta: item.medalDelta * quantity,
    pieceDelta: item.pieceDelta * quantity,
    itemDelta: item.itemDelta * quantity,
  };
}
