import { Gem, Medal, Package, Trophy } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Metric } from '../../components/ui/Metric';
import type { LedgerEntry, TeamDetail } from '../../lib/types';

function entryTitle(entry: LedgerEntry) {
  if (entry.activityName) {
    if (entry.activityRank)
      return `${entry.activityName} · hạng ${entry.activityRank}${entry.activityRank === 1 ? ' (thắng)' : ''}`;
    return entry.activityName;
  }
  if (entry.note) return entry.note;
  if (entry.adjustmentKind) return entry.adjustmentKind;
  return entry.entryType;
}

function formatDelta(entry: LedgerEntry) {
  const parts: string[] = [];
  if (entry.medalDelta) parts.push(`${entry.medalDelta > 0 ? '+' : ''}${entry.medalDelta} HH`);
  if (entry.pieceDelta) parts.push(`${entry.pieceDelta > 0 ? '+' : ''}${entry.pieceDelta} mảnh`);
  if (entry.itemDelta) parts.push(`${entry.itemDelta > 0 ? '+' : ''}${entry.itemDelta} vật phẩm`);
  return parts.join(' · ') || '0';
}

export function TeamDetailView({
  detail,
  publicView = false,
}: {
  detail: TeamDetail;
  publicView?: boolean;
}) {
  const wins = detail.wins ?? [];
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={Medal} value={detail.medals} label="Huy hiệu" />
        <Metric icon={Gem} value={detail.pieces} label="Mảnh ghép" />
        <Metric icon={Package} value={detail.items} label="Vật phẩm" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric value={detail.winCount ?? wins.length} label="Trận thắng" />
        <Metric value={detail.totalMedalGain ?? 0} label="Tổng cộng HH" />
        <Metric value={detail.totalMedalLoss ?? 0} label="Tổng trừ HH" />
        <Metric value={detail.adjustmentCount ?? 0} label="Cộng/trừ tay" />
      </div>
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />
          Các trận đã thắng
        </h3>
        {!wins.length ? (
          <p className="m-0 text-sm text-[var(--muted-foreground)]">Chưa có trận thắng (hạng 1).</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {wins.map((win) => (
              <li
                key={win.entryId}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span className="font-medium">{win.activityName || 'Hoạt động'}</span>
                <span className="tabular text-[var(--muted-foreground)]">
                  +{win.medals} HH
                  {win.pieces ? ` · +${win.pieces} mảnh` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Lịch sử cộng / trừ điểm</h3>
        {!detail.ledger.length ? (
          <p className="m-0 text-sm text-[var(--muted-foreground)]">Chưa có dữ liệu chi tiết.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {detail.ledger.map((entry) => (
              <div className="grid grid-cols-[1fr_auto] gap-3 py-3" key={entry.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 text-sm font-medium">{entryTitle(entry)}</p>
                    <Badge tone="outline">{entry.entryType}</Badge>
                    {entry.reversedAt && <Badge tone="warning">Đã đảo</Badge>}
                  </div>
                  <p className="m-0 mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {new Date(entry.createdAt).toLocaleString('vi-VN')}
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
