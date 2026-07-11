import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { cn } from '../../lib/cn';
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
  const { t } = useTranslation('scoring');
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
    <Card aria-labelledby="rank-title">
      <CardHeader>
        <CardTitle id="rank-title">{t('rank.title')}</CardTitle>
        <CardDescription>{t('rank.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Field label={t('rank.activity')} htmlFor="activity">
          <Select
            id="activity"
            disabled={disabled}
            value={activityKey}
            onChange={(event) => {
              setActivityKey(event.target.value);
              setRanks({});
              setConfirming(false);
            }}
          >
            <option value="">{t('rank.activityPlaceholder')}</option>
            {available.map((activity) => (
              <option key={activity.id} value={activity.activityKey}>
                {activity.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3">
          {teams.map((team) => (
            <fieldset
              disabled={disabled}
              key={team.teamId}
              className="rounded-[var(--radius)] border border-[var(--border)] p-3"
            >
              <legend className="px-1 text-sm font-semibold">
                {team.displayName || team.name}
              </legend>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}
              >
                {teams.map((_, index) => {
                  const rank = index + 1;
                  const selected = ranks[team.teamId] === rank;
                  return (
                    <button
                      key={rank}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => assign(team.teamId, rank)}
                      className={cn(
                        'relative min-h-11 rounded-[var(--radius)] border px-1 text-sm font-medium transition-colors',
                        selected
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]',
                      )}
                    >
                      {t('rank.place', { rank })}
                      {selected && (
                        <Check className="absolute right-1 top-1 h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        {!valid && Object.keys(ranks).length > 0 && (
          <p role="status" className="m-0 text-sm text-[var(--warning)]">
            {t('rank.incomplete')}
          </p>
        )}
        {confirming ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/40 p-4">
            <strong className="text-sm font-semibold">{t('rank.confirmTitle')}</strong>
            <p className="my-2 text-sm text-[var(--muted-foreground)]">{t('rank.confirmBody')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1"
                loading={saving}
                onClick={() => onSubmit(activityKey, ranks)}
              >
                {t('rank.confirm')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t('rank.back')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-full"
            disabled={disabled || !activityKey || !valid}
            onClick={() => setConfirming(true)}
          >
            {t('rank.checkSave')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
