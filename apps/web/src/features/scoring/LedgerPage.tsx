import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';

export function LedgerPage() {
  const { workspaceId = '' } = useParams();
  const [filter, setFilter] = useState('');
  const client = useQueryClient();
  const toast = useToast();
  const ledger = useQuery({
    queryKey: ['ledger', workspaceId],
    queryFn: () => api.scoring.ledger(workspaceId),
  });
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const reverse = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.scoring.reverse(workspaceId, id, reason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['ledger', workspaceId] });
      client.invalidateQueries({ queryKey: ['ranking', workspaceId] });
      toast('Đã tạo giao dịch đảo ngược');
    },
  });
  const allItems = ledger.data || [];
  const items = allItems.filter((item) =>
    `${item.teamName} ${item.activityName} ${item.entryType}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const reversedIds = new Set(
    allItems.map((entry) => entry.reversesEntryId).filter((id): id is string => Boolean(id)),
  );
  const canReverse =
    workspace.data?.status === 'active' && ['owner', 'admin'].includes(workspace.data.role);
  return (
    <div className="page-shell">
      <header className="mb-6">
        <p className="eyebrow">Audit trail</p>
        <h1 className="page-title mt-2">Lịch sử điểm</h1>
        <p className="mt-2 muted">
          Không sửa hoặc xóa trực tiếp; giao dịch điều chỉnh và mua hàng có thể đảo ngược với lý do.
        </p>
      </header>
      <label className="relative mb-4 block max-w-md">
        <span className="sr-only">Tìm lịch sử</span>
        <Search className="absolute left-3 top-3.5 h-5 w-5 muted" />
        <input
          className="input pl-10"
          placeholder="Tìm đội, hoạt động…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      {ledger.isLoading ? (
        <LoadingState />
      ) : ledger.isError ? (
        <ErrorState retry={() => ledger.refetch()} />
      ) : !items.length ? (
        <EmptyState
          title="Không có giao dịch"
          message="Các lần nhập điểm và mua vật phẩm sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((entry) => (
            <article key={entry.id} className="app-card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[11rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-base font-bold">{entry.teamName}</h2>
                  <Badge>{entry.entryType}</Badge>
                  {entry.reversesEntryId && <Badge tone="warning">Giao dịch đảo</Badge>}
                  {entry.entryType === 'activity_award' && (
                    <Badge tone="neutral">Sửa theo toàn bộ game</Badge>
                  )}
                </div>
                <p className="m-0 mt-1 text-sm muted">
                  {entry.activityName ||
                    String(entry.metadata?.reason || entry.metadata?.kind || 'Điều chỉnh')}
                </p>
                <p className="m-0 mt-1 text-xs muted">
                  {new Date(entry.createdAt).toLocaleString('vi-VN')} · {entry.createdByName}
                </p>
              </div>
              <div className="flex items-center gap-3 text-right tabular">
                <Delta value={entry.medalDelta} label="Huy hiệu" />
                <Delta value={entry.pieceDelta} label="Mảnh" />
                <Delta value={entry.itemDelta} label="Vật phẩm" />
              </div>
              {canReverse &&
                ['adjustment', 'penalty', 'purchase'].includes(entry.entryType) &&
                !entry.reversedAt &&
                !reversedIds.has(entry.id) && (
                  <Button
                    variant="ghost"
                    aria-label={`Đảo ngược giao dịch của ${entry.teamName}`}
                    onClick={() => {
                      const reason = prompt('Lý do đảo ngược?');
                      if (reason?.trim()) reverse.mutate({ id: entry.id, reason: reason.trim() });
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Đảo ngược
                  </Button>
                )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
function Delta({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong
        className={value > 0 ? 'text-[var(--success)]' : value < 0 ? 'text-[var(--danger)]' : ''}
      >
        {value > 0 ? '+' : ''}
        {value}
      </strong>
      <span className="block text-[10px] muted">{label}</span>
    </div>
  );
}
