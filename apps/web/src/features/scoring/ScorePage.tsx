import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, CloudOff, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { createIdempotencyKey } from '../../lib/idempotency';
import { QuickActions, type QuickAction } from './QuickActions';
import { RankEntry } from './RankEntry';

export function ScorePage() {
  const { workspaceId = '' } = useParams();
  const client = useQueryClient();
  const toast = useToast();
  const [online, setOnline] = useState(navigator.onLine);
  const [updated, setUpdated] = useState(new Date());
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const ranking = useQuery({
    queryKey: ['ranking', workspaceId],
    queryFn: () => api.scoring.ranking(workspaceId),
  });
  const activities = useQuery({
    queryKey: ['activities', workspaceId],
    queryFn: () => api.workspaces.activities(workspaceId),
  });
  const refresh = () => {
    setUpdated(new Date());
    client.invalidateQueries({ queryKey: ['ranking', workspaceId] });
    client.invalidateQueries({ queryKey: ['activities', workspaceId] });
    client.invalidateQueries({ queryKey: ['ledger', workspaceId] });
  };
  const success = (message: string) => {
    refresh();
    toast(message);
  };
  const game = useMutation({
    mutationFn: ({ activityKey, ranks }: { activityKey: string; ranks: Record<string, number> }) =>
      api.scoring.game(workspaceId, {
        activityKey,
        results: Object.entries(ranks).map(([teamId, rank]) => ({ teamId, rank })),
        idempotencyKey: createIdempotencyKey(),
      }),
    onSuccess: () => success('Đã lưu kết quả tất cả đội'),
  });
  const quick = useMutation({
    mutationFn: (data: QuickAction) =>
      api.scoring.adjust(workspaceId, {
        teamId: data.teamId,
        kind: data.mode as 'speech' | 'violation',
        medalDelta: data.mode === 'violation' ? -data.value : data.value,
        reason: data.reason,
        idempotencyKey: createIdempotencyKey(),
      }),
    onSuccess: () => success('Đã ghi nhận thay đổi'),
  });
  const purchase = useMutation({
    mutationFn: (data: QuickAction) =>
      api.scoring.purchase(workspaceId, {
        teamId: data.teamId,
        itemKey: data.mode as 'piece' | 'item',
        quantity: data.value,
        idempotencyKey: createIdempotencyKey(),
      }),
    onSuccess: () => success('Đã ghi nhận giao dịch'),
  });
  if (workspace.isLoading || ranking.isLoading || activities.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (workspace.isError || ranking.isError || activities.isError)
    return (
      <div className="page-shell">
        <ErrorState
          retry={() => {
            workspace.refetch();
            ranking.refetch();
            activities.refetch();
          }}
        />
      </div>
    );
  const canScore =
    workspace.data?.status === 'active' &&
    ['owner', 'admin', 'scorer'].includes(workspace.data.role);
  const disabledReason =
    workspace.data?.status !== 'active'
      ? `Workspace đang ${workspace.data?.status}; mọi thao tác chấm điểm đã tắt.`
      : 'Bạn chỉ có quyền xem workspace này.';
  return (
    <div className="page-shell">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Event console</p>
          <h1 className="page-title mt-2">Nhập điểm</h1>
          <p className="mt-2 muted">Thiết kế cho thao tác nhanh trên điện thoại và máy tính.</p>
        </div>
        <div
          className={`flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold ${online ? 'bg-[var(--primary-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}
        >
          {online ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
          {online
            ? `Đã kết nối · ${updated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Mất kết nối'}
        </div>
      </header>
      {!canScore && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-xl bg-[var(--warning-soft)] p-4 text-[var(--warning)]"
        >
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{disabledReason}</span>
        </div>
      )}
      {(game.error || quick.error || purchase.error) && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]"
        >
          {(game.error || quick.error || purchase.error)?.message}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <RankEntry
          teams={ranking.data?.teams || []}
          activities={activities.data || []}
          saving={game.isPending}
          disabled={!canScore || !online}
          onSubmit={(activityKey, ranks) => game.mutate({ activityKey, ranks })}
        />
        <QuickActions
          teams={ranking.data?.teams || []}
          saving={quick.isPending || purchase.isPending}
          disabled={!canScore || !online}
          onQuick={(data) => quick.mutate(data)}
          onPurchase={(data) => purchase.mutate(data)}
        />
      </div>
    </div>
  );
}
