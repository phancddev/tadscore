import { describe, expect, it } from 'vitest';
import type { Team } from '../../lib/types';
import { buildAwardPreviewRows } from './awardPreview';

function team(teamId: string, name: string): Team {
  return {
    id: teamId,
    teamId,
    name,
    displayName: name,
    medals: 0,
    pieces: 0,
    items: 0,
    eligible: true,
    rank: 0,
  };
}

const teams = [team('lan', 'Lan'), team('mai', 'Mai'), team('cuc', 'Cúc'), team('truc', 'Trúc')];
const medalAwards = [14, 7, 4, 2];
const pieceAwards = [3, 1, 0, 0];

describe('buildAwardPreviewRows', () => {
  it('maps awards by rank index (rank 1 → awards[0]) and sorts by place', () => {
    const rows = buildAwardPreviewRows(
      teams,
      { lan: 2, mai: 1, cuc: 4, truc: 3 },
      medalAwards,
      pieceAwards,
    );
    expect(rows.map((row) => row.teamId)).toEqual(['mai', 'lan', 'truc', 'cuc']);
    expect(rows[0]).toMatchObject({ rank: 1, medals: 14, pieces: 3 });
    expect(rows[1]).toMatchObject({ rank: 2, medals: 7, pieces: 1 });
    expect(rows[2]).toMatchObject({ rank: 3, medals: 4, pieces: 0 });
    expect(rows[3]).toMatchObject({ rank: 4, medals: 2, pieces: 0 });
  });

  it('includes only assigned teams when ranks are incomplete', () => {
    const rows = buildAwardPreviewRows(teams, { mai: 1, lan: 3 }, medalAwards, pieceAwards);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.teamId)).toEqual(['mai', 'lan']);
    expect(rows[0]).toMatchObject({ rank: 1, medals: 14 });
    expect(rows[1]).toMatchObject({ rank: 3, medals: 4 });
  });

  it('treats missing pieceAwards as 0 and missing medal slots as 0', () => {
    const rows = buildAwardPreviewRows(teams, { lan: 1, mai: 2 }, [14], undefined);
    expect(rows[0]).toMatchObject({ medals: 14, pieces: 0 });
    expect(rows[1]).toMatchObject({ medals: 0, pieces: 0 });
  });

  it('returns empty when no ranks are assigned', () => {
    expect(buildAwardPreviewRows(teams, {}, medalAwards, pieceAwards)).toEqual([]);
  });
});
