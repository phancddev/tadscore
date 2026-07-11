import { Check, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import type { Activity, Team } from '../../lib/types';

export function ranksValid(ranks: Record<string, number>, teamIds: string[]) {
  return (
    teamIds.length >= 2 &&
    teamIds.every((id) => ranks[id] >= 1 && ranks[id] <= teamIds.length) &&
    new Set(teamIds.map((id) => ranks[id])).size === teamIds.length
  );
}
export function RankEntry({
  teams,
  activities,
  saving,
  disabled,
  onSubmit,
}: {
  teams: Team[];
  activities: Activity[];
  saving: boolean;
  disabled?: boolean;
  onSubmit: (activityKey: string, ranks: Record<string, number>) => void;
}) {
  const [activityKey, setActivityKey] = useState('');
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const available = activities.filter(
    (activity) =>
      activity.activityType === 'ranked_game' && ['open', 'draft'].includes(activity.status),
  );
  const teamIds = teams.map((team) => team.teamId);
  const valid = useMemo(() => ranksValid(ranks, teamIds), [ranks, teamIds.join(':')]);
  useEffect(() => {
    if (available.some((activity) => activity.activityKey === activityKey)) return;
    setActivityKey(available[0]?.activityKey || '');
    setRanks({});
    setConfirming(false);
  }, [activityKey, activities]);
  const assign = (teamId: string, rank: number) =>
    setRanks((current) => {
      const next = { ...current };
      const conflict = Object.entries(next).find(
        ([id, value]) => id !== teamId && value === rank,
      )?.[0];
      if (conflict) delete next[conflict];
      next[teamId] = rank;
      return next;
    });
  return (
    <section className="app-card p-4 md:p-6" aria-labelledby="rank-title">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <Trophy />
        </span>
        <div>
          <h2 id="rank-title" className="section-title m-0">
            Xếp hạng game
          </h2>
          <p className="m-0 mt-1 text-sm muted">
            Mỗi hạng chỉ thuộc về một đội. Lưu đồng thời toàn bộ kết quả.
          </p>
        </div>
      </div>
      <div className="field mb-5">
        <label htmlFor="activity">Hoạt động</label>
        <select
          id="activity"
          className="input"
          disabled={disabled}
          value={activityKey}
          onChange={(event) => {
            setActivityKey(event.target.value);
            setRanks({});
            setConfirming(false);
          }}
        >
          <option value="">Chọn hoạt động</option>
          {available.map((activity) => (
            <option key={activity.id} value={activity.activityKey}>
              {activity.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3">
        {teams.map((team) => (
          <fieldset
            disabled={disabled}
            key={team.teamId}
            className="rounded-xl border border-[var(--border)] p-3"
          >
            <legend className="px-1 font-bold">{team.displayName || team.name}</legend>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}
            >
              {teams.map((_, index) => {
                const rank = index + 1;
                return (
                  <button
                    key={rank}
                    type="button"
                    aria-pressed={ranks[team.teamId] === rank}
                    onClick={() => assign(team.teamId, rank)}
                    className={`relative min-h-12 rounded-xl border px-1 text-sm font-extrabold transition active:scale-95 ${ranks[team.teamId] === rank ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)] bg-white hover:bg-[var(--surface-muted)]'}`}
                  >
                    Hạng {rank}
                    {ranks[team.teamId] === rank && (
                      <Check className="absolute right-1 top-1 h-3.5 w-3.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {!valid && Object.keys(ranks).length > 0 && (
        <p role="status" className="mt-3 text-sm text-[var(--warning)]">
          Chọn đủ và không trùng hạng cho tất cả đội.
        </p>
      )}
      {confirming ? (
        <div className="mt-5 rounded-xl bg-[var(--surface-muted)] p-4">
          <strong>Xác nhận lưu kết quả?</strong>
          <p className="my-2 text-sm muted">Kết quả sẽ được lưu trong một giao dịch nguyên tử.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              loading={saving}
              onClick={() => onSubmit(activityKey, ranks)}
            >
              Xác nhận
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Quay lại
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="mt-5 w-full"
          disabled={disabled || !activityKey || !valid}
          onClick={() => setConfirming(true)}
        >
          Kiểm tra & lưu kết quả
        </Button>
      )}
    </section>
  );
}
