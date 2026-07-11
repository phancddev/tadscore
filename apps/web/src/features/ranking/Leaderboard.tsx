import { Gem, Medal, Package, ShieldCheck, Trophy } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
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
      className={presenter ? 'grid gap-5 xl:grid-cols-2' : 'grid gap-4'}
    >
      {teams.map((team, index) => {
        const content = (
          <>
            <div
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ backgroundColor: team.color || 'var(--primary)' }}
            />
            <div className="grid h-full grid-cols-[auto_1fr] items-center gap-4 p-5 pl-7 md:grid-cols-[auto_1fr_auto]">
              <span
                className={`grid place-items-center rounded-2xl font-black tabular ${index === 0 ? 'bg-[var(--winner-soft)] text-[var(--winner)]' : 'bg-[var(--surface-muted)]'} ${presenter ? 'h-20 w-20 text-4xl' : 'h-14 w-14 text-2xl'}`}
              >
                {index === 0 ? <Trophy className="h-8 w-8" /> : team.rank}
              </span>
              <div>
                <p className="m-0 text-xs font-bold uppercase tracking-wider muted">
                  {podium[index] || `Hạng ${team.rank}`}
                </p>
                <h2
                  className={`m-0 mt-1 font-extrabold tracking-[-.03em] ${presenter ? 'text-4xl' : 'text-2xl'}`}
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
                <Stat icon={Medal} value={team.medals} label="Huy hiệu" large={presenter} />
                <Stat icon={Gem} value={team.pieces} label="Mảnh ghép" large={presenter} />
                <Stat icon={Package} value={team.items} label="Vật phẩm" large={presenter} />
              </div>
            </div>
          </>
        );
        return onTeam ? (
          <button
            key={team.teamId}
            onClick={() => onTeam(team)}
            className={`app-card relative w-full overflow-hidden p-0 text-left transition hover:shadow-md ${presenter ? 'min-h-52' : 'min-h-32'}`}
            aria-label={`Xem chi tiết ${team.displayName || team.name}`}
          >
            {content}
          </button>
        ) : (
          <article
            key={team.teamId}
            className={`app-card relative w-full overflow-hidden p-0 text-left ${presenter ? 'min-h-52' : 'min-h-32'}`}
          >
            {content}
          </article>
        );
      })}
    </section>
  );
}
function Stat({
  icon: Icon,
  value,
  label,
  large,
}: {
  icon: typeof Medal;
  value: number;
  label: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-center">
      <Icon className="mx-auto h-4 w-4 text-[var(--primary)]" />
      <strong className={`block tabular ${large ? 'text-3xl' : 'text-lg'}`}>{value}</strong>
      <span className="text-[10px] font-semibold uppercase tracking-wide muted">{label}</span>
    </div>
  );
}
