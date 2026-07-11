import { Gem, Medal, Package, ShieldCheck, Trophy } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Metric } from '../../components/ui/Metric';
import type { Ranking, Team } from '../../lib/types';

const podium = ['Hạng nhất', 'Hạng nhì', 'Hạng ba', 'Hạng tư'];

export function Leaderboard({
  ranking,
  presenter = false,
  onTeam,
}: {
  ranking: Ranking;
  presenter?: boolean;
  onTeam?: (team: Team) => void;
}) {
  const teams = [...ranking.teams].sort((a, b) => a.rank - b.rank);
  return (
    <section
      aria-label="Bảng xếp hạng"
      className={presenter ? 'grid gap-5 xl:grid-cols-2' : 'grid gap-3'}
    >
      {teams.map((team, index) => {
        const content = (
          <>
            <div
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: team.color || 'var(--foreground)' }}
            />
            <div
              className={`grid h-full grid-cols-[auto_1fr] items-center gap-4 pl-6 md:grid-cols-[auto_1fr_auto] ${presenter ? 'p-6' : 'p-4'}`}
            >
              <span
                className={`flex items-center justify-center gap-1 font-semibold tabular text-[var(--muted-foreground)] ${presenter ? 'min-w-14 text-3xl' : 'min-w-10 text-xl'}`}
              >
                {index === 0 && (
                  <Trophy
                    className={`${presenter ? 'h-5 w-5' : 'h-3.5 w-3.5'} shrink-0 text-[var(--muted-foreground)]`}
                    aria-hidden
                  />
                )}
                {team.rank}
              </span>
              <div className="min-w-0">
                <p
                  className={`m-0 font-medium text-[var(--muted-foreground)] ${presenter ? 'text-sm' : 'text-xs'}`}
                >
                  {podium[index] || `Hạng ${team.rank}`}
                </p>
                <h2
                  className={`m-0 mt-0.5 truncate font-semibold tracking-tight ${presenter ? 'text-3xl md:text-4xl' : 'text-lg'}`}
                >
                  {team.displayName || team.name}
                </h2>
                <div className="mt-2">
                  <Badge tone={team.eligible ? 'success' : 'warning'}>
                    {team.eligible ? (
                      <>
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                        Đủ {ranking.rule.minimumPieces} mảnh
                      </>
                    ) : (
                      `Chưa đủ ${ranking.rule.minimumPieces} mảnh`
                    )}
                  </Badge>
                </div>
              </div>
              <div
                className={`col-span-2 grid grid-cols-3 gap-2 md:col-span-1 ${presenter ? 'md:min-w-80' : ''}`}
              >
                <Metric icon={Medal} value={team.medals} label="Huy hiệu" large={presenter} />
                <Metric icon={Gem} value={team.pieces} label="Mảnh ghép" large={presenter} />
                <Metric icon={Package} value={team.items} label="Vật phẩm" large={presenter} />
              </div>
            </div>
          </>
        );
        const cardClass = `relative w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-left ${presenter ? 'min-h-48' : 'min-h-28'}`;
        return onTeam ? (
          <button
            key={team.teamId}
            onClick={() => onTeam(team)}
            className={`${cardClass} transition-colors hover:bg-[var(--muted)]/40`}
            aria-label={`Xem chi tiết ${team.displayName || team.name}`}
          >
            {content}
          </button>
        ) : (
          <article key={team.teamId} className={cardClass}>
            {content}
          </article>
        );
      })}
    </section>
  );
}
