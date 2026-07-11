import { Gem, Medal, Package } from 'lucide-react';
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
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat icon={Medal} value={detail.medals} label="Huy hiệu" />
        <Stat icon={Gem} value={detail.pieces} label="Mảnh ghép" />
        <Stat icon={Package} value={detail.items} label="Vật phẩm" />
      </div>
      <h3 className="mt-6">Chi tiết điểm</h3>
      {!detail.ledger.length ? (
        <p className="muted">Chưa có dữ liệu chi tiết.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {detail.ledger.map((entry) => (
            <div className="grid grid-cols-[1fr_auto] gap-3 py-3" key={entry.id}>
              <div>
                <strong>
                  {entry.activityName || String(entry.metadata?.reason || entry.entryType)}
                </strong>
                <p className="m-0 text-xs muted">
                  {new Date(entry.createdAt).toLocaleString('vi-VN')}
                  {!publicView && entry.createdByName ? ` · ${entry.createdByName}` : ''}
                </p>
              </div>
              <strong className="tabular">
                {entry.medalDelta > 0 ? '+' : ''}
                {entry.medalDelta} HH
                {entry.pieceDelta
                  ? ` · ${entry.pieceDelta > 0 ? '+' : ''}${entry.pieceDelta} mảnh`
                  : ''}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Stat({ icon: Icon, value, label }: { icon: typeof Medal; value: number; label: string }) {
  return (
    <strong className="rounded-xl bg-[var(--surface-muted)] p-3 tabular">
      <Icon className="mx-auto mb-1 h-4 w-4 text-[var(--primary)]" />
      {value}
      <small className="block font-medium muted">{label}</small>
    </strong>
  );
}
