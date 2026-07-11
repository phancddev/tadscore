import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui/Badge';
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

export type RankSubmitMode = 'create' | 'replace';

export function RankEntry({
  teams,
  activities,
  saving,
  disabled,
  loadingResults,
  prefillRanks,
  onActivityChange,
  onSubmit,
}: {
  teams: Team[];
  activities: Activity[];
  saving: boolean;
  disabled?: boolean;
  loadingResults?: boolean;
  /** Loaded ranks for the selected activity (finalized replace flow). */
  prefillRanks?: Record<string, number> | null;
  onActivityChange?: (activityKey: string) => void;
  onSubmit: (activityKey: string, ranks: Record<string, number>, mode: RankSubmitMode) => void;
}) {
  const { t } = useTranslation('scoring');
  const [activityKey, setActivityKey] = useState('');
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const available = activities.filter(
    (activity) =>
      activity.activityType === 'ranked_game' &&
      ['open', 'draft', 'finalized'].includes(activity.status),
  );
  const selected = available.find((activity) => activity.activityKey === activityKey);
  const isReplace = selected?.status === 'finalized';
  const teamIds = teams.map((team) => team.teamId);
  const valid = useMemo(() => ranksValid(ranks, teamIds), [ranks, teamIds.join(':')]);
  useEffect(() => {
    if (available.some((activity) => activity.activityKey === activityKey)) return;
    const next = available[0]?.activityKey || '';
    setActivityKey(next);
    setRanks({});
    setConfirming(false);
    if (next) onActivityChange?.(next);
  }, [activityKey, activities]);
  useEffect(() => {
    if (!prefillRanks) return;
    setRanks(prefillRanks);
    setConfirming(false);
  }, [prefillRanks, activityKey]);
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
  const pickActivity = (key: string) => {
    setActivityKey(key);
    setRanks({});
    setConfirming(false);
    onActivityChange?.(key);
  };
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
            onChange={(event) => pickActivity(event.target.value)}
          >
            <option value="">{t('rank.activityPlaceholder')}</option>
            {available.map((activity) => (
              <option key={activity.id} value={activity.activityKey}>
                {activity.name}
                {activity.status === 'finalized' ? ` (${t('rank.savedLabel')})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        {isReplace && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{t('rank.savedBadge')}</Badge>
            <p className="m-0 text-sm text-[var(--muted-foreground)]">{t('rank.replaceHint')}</p>
          </div>
        )}
        {loadingResults ? (
          <p className="m-0 text-sm text-[var(--muted-foreground)]">{t('rank.loadingResults')}</p>
        ) : (
          <div className="grid gap-3">
            {teams.map((team) => (
              <fieldset
                disabled={disabled || loadingResults}
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
                    const selectedRank = ranks[team.teamId] === rank;
                    return (
                      <button
                        key={rank}
                        type="button"
                        aria-pressed={selectedRank}
                        onClick={() => assign(team.teamId, rank)}
                        className={cn(
                          'relative min-h-11 rounded-[var(--radius)] border px-1 text-sm font-medium transition-colors',
                          selectedRank
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]',
                        )}
                      >
                        {t('rank.place', { rank })}
                        {selectedRank && (
                          <Check className="absolute right-1 top-1 h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}
        {!valid && Object.keys(ranks).length > 0 && (
          <p role="status" className="m-0 text-sm text-[var(--warning)]">
            {t('rank.incomplete')}
          </p>
        )}
        {confirming ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/40 p-4">
            <strong className="text-sm font-semibold">
              {isReplace ? t('rank.confirmReplaceTitle') : t('rank.confirmTitle')}
            </strong>
            <p className="my-2 text-sm text-[var(--muted-foreground)]">
              {isReplace ? t('rank.confirmReplaceBody') : t('rank.confirmBody')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1"
                loading={saving}
                onClick={() => onSubmit(activityKey, ranks, isReplace ? 'replace' : 'create')}
              >
                {isReplace ? t('rank.confirmReplace') : t('rank.confirm')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t('rank.back')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-full"
            disabled={disabled || !activityKey || !valid || loadingResults}
            onClick={() => setConfirming(true)}
          >
            {isReplace ? t('rank.checkUpdate') : t('rank.checkSave')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
