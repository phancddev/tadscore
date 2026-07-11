import { Gem, Medal, Package } from 'lucide-react';
import { Metric } from '../../components/ui/Metric';
import type { TeamDetail } from '../../lib/types';

export function TeamDetailView({
  detail,
  publicView = false,
}: {
  detail: TeamDetail;
  publicView?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={Medal} value={detail.medals} label="Huy hiệu" />
        <Metric icon={Gem} value={detail.pieces} label="Mảnh ghép" />
        <Metric icon={Package} value={detail.items} label="Vật phẩm" />
      </div>
      <h3 className="mb-2 mt-6 text-sm font-semibold">Chi tiết điểm</h3>
      {!detail.ledger.length ? (
        <p className="m-0 text-sm text-[var(--muted-foreground)]">Chưa có dữ liệu chi tiết.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {detail.ledger.map((entry) => (
            <div className="grid grid-cols-[1fr_auto] gap-3 py-3" key={entry.id}>
              <div className="min-w-0">
                <p className="m-0 text-sm font-medium">
                  {entry.activityName || String(entry.metadata?.reason || entry.entryType)}
                </p>
                <p className="m-0 mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {new Date(entry.createdAt).toLocaleString('vi-VN')}
                  {!publicView && entry.createdByName ? ` · ${entry.createdByName}` : ''}
                </p>
              </div>
              <span className="text-sm font-medium tabular">
                {entry.medalDelta > 0 ? '+' : ''}
                {entry.medalDelta} HH
                {entry.pieceDelta
                  ? ` · ${entry.pieceDelta > 0 ? '+' : ''}${entry.pieceDelta} mảnh`
                  : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
