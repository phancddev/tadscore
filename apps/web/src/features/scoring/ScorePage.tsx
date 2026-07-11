import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, CloudOff, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
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
      <PageHeader
        title="Nhập điểm"
        description="Thiết kế cho thao tác nhanh trên điện thoại và máy tính."
        actions={
          <Badge tone={online ? 'outline' : 'danger'} className="gap-1.5 font-normal">
            {online ? (
              <Cloud className="h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden />
            ) : (
              <CloudOff className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className={online ? 'text-[var(--muted-foreground)]' : undefined}>
              {online
                ? `Đã kết nối · ${updated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                : 'Mất kết nối'}
            </span>
          </Badge>
        }
      />
      {!canScore && (
        <Alert variant="warning" className="mb-5" role="status">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{disabledReason}</span>
        </Alert>
      )}
      {!online && (
        <Alert variant="destructive" className="mb-5">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Mất kết nối mạng. Các thao tác chấm điểm tạm thời bị tắt.</span>
        </Alert>
      )}
      {(game.error || quick.error || purchase.error) && (
        <Alert variant="destructive" className="mb-4">
          {(game.error || quick.error || purchase.error)?.message}
        </Alert>
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
