import { Gem, Medal, Package, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui/Badge';
import { Metric } from '../../components/ui/Metric';
import i18n from '../../i18n';
import type { LedgerEntry, TeamDetail } from '../../lib/types';

function signed(value: number) {
  return value > 0 ? '+' : '';
}

export function TeamDetailView({
  detail,
  publicView = false,
}: {
  detail: TeamDetail;
  publicView?: boolean;
}) {
  const { t: tr } = useTranslation('ranking');
  const { t: tc } = useTranslation('common');
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  const wins = detail.wins ?? [];

  const entryTitle = (entry: LedgerEntry) => {
    if (entry.activityName) {
      if (entry.activityRank)
        return (
          tr('detail.activity', { activity: entry.activityName, rank: entry.activityRank }) +
          (entry.activityRank === 1 ? tr('detail.win') : '')
        );
      return entry.activityName;
    }
    if (entry.note) return entry.note;
    if (entry.adjustmentKind) return entry.adjustmentKind;
    return entry.entryType;
  };

  const formatDelta = (entry: LedgerEntry) => {
    const parts: string[] = [];
    if (entry.medalDelta)
      parts.push(
        tr('detail.deltaMedals', {
          sign: signed(entry.medalDelta),
          value: entry.medalDelta,
        }),
      );
    if (entry.pieceDelta)
      parts.push(
        tr('detail.deltaPieces', {
          sign: signed(entry.pieceDelta),
          value: entry.pieceDelta,
        }),
      );
    if (entry.itemDelta)
      parts.push(
        tr('detail.deltaItems', {
          sign: signed(entry.itemDelta),
          value: entry.itemDelta,
        }),
      );
    return parts.join(' · ') || '0';
  };

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={Medal} value={detail.medals} label={tc('metrics.medals')} />
        <Metric icon={Gem} value={detail.pieces} label={tc('metrics.pieces')} />
        <Metric icon={Package} value={detail.items} label={tc('metrics.items')} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric value={detail.winCount ?? wins.length} label={tr('detail.wins')} />
        <Metric value={detail.totalMedalGain ?? 0} label={tr('detail.totalGain')} />
        <Metric value={detail.totalMedalLoss ?? 0} label={tr('detail.totalLoss')} />
        <Metric value={detail.adjustmentCount ?? 0} label={tr('detail.manualAdjust')} />
      </div>
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />
          {tr('detail.winsSection')}
        </h3>
        {!wins.length ? (
          <p className="m-0 text-sm text-[var(--muted-foreground)]">{tr('detail.noWins')}</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {wins.map((win) => (
              <li
                key={win.entryId}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {win.activityName || tr('detail.activityFallback')}
                </span>
                <span className="tabular text-[var(--muted-foreground)]">
                  {tr('detail.winMedals', { medals: win.medals })}
                  {win.pieces ? tr('detail.winPieces', { pieces: win.pieces }) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">{tr('detail.ledgerSection')}</h3>
        {!detail.ledger.length ? (
          <p className="m-0 text-sm text-[var(--muted-foreground)]">{tr('detail.noLedger')}</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {detail.ledger.map((entry) => (
              <div className="grid grid-cols-[1fr_auto] gap-3 py-3" key={entry.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 text-sm font-medium">{entryTitle(entry)}</p>
                    <Badge tone="outline">{entry.entryType}</Badge>
                    {entry.reversedAt && <Badge tone="warning">{tr('detail.reversed')}</Badge>}
                  </div>
                  <p className="m-0 mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {new Date(entry.createdAt).toLocaleString(locale)}
                    {!publicView && entry.createdByName ? ` · ${entry.createdByName}` : ''}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium tabular ${
                    entry.medalDelta > 0
                      ? 'text-[var(--success)]'
                      : entry.medalDelta < 0
                        ? 'text-[var(--destructive)]'
                        : ''
                  }`}
                >
                  {formatDelta(entry)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
