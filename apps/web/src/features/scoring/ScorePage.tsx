import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, CloudOff, LockKeyhole } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import i18n from '../../i18n';
import { api } from '../../lib/api';
import { createIdempotencyKey } from '../../lib/idempotency';
import { QuickActions, shopConfigFromRanking, type QuickAction } from './QuickActions';
import { RankEntry } from './RankEntry';

export function ScorePage() {
  const { t } = useTranslation('scoring');
  const { t: tc } = useTranslation('common');
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
  const [rankActivityKey, setRankActivityKey] = useState('');
  const gameResults = useQuery({
    queryKey: ['game-results', workspaceId, rankActivityKey],
    queryFn: () => api.scoring.gameResults(workspaceId, rankActivityKey),
    enabled: Boolean(workspaceId && rankActivityKey),
  });
  const prefillRanks = useMemo(() => {
    const results = gameResults.data?.results;
    if (!results?.length) return null;
    return Object.fromEntries(results.map((row) => [row.teamId, row.rank]));
  }, [gameResults.data]);
  const game = useMutation({
    mutationFn: ({
      activityKey,
      ranks,
      mode,
    }: {
      activityKey: string;
      ranks: Record<string, number>;
      mode: 'create' | 'replace';
    }) => {
      const results = Object.entries(ranks).map(([teamId, rank]) => ({ teamId, rank }));
      const idempotencyKey = createIdempotencyKey();
      if (mode === 'replace')
        return api.scoring.replaceGame(workspaceId, {
          activityKey,
          results,
          idempotencyKey,
          reason: t('rank.replaceReason'),
        });
      return api.scoring.game(workspaceId, { activityKey, results, idempotencyKey });
    },
    onSuccess: (_data, variables) => {
      success(variables.mode === 'replace' ? t('page.updatedRanks') : t('page.savedRanks'));
      client.invalidateQueries({ queryKey: ['game-results', workspaceId] });
    },
  });
  const quick = useMutation({
    mutationFn: (data: QuickAction) =>
      api.scoring.adjust(workspaceId, {
        teamId: data.teamId,
        kind: 'manual',
        medalDelta: data.value,
        reason: data.reason,
        idempotencyKey: createIdempotencyKey(),
      }),
    onSuccess: (_result, data) =>
      success(
        data.value > 0
          ? t('page.medalAdded', { value: data.value })
          : t('page.medalRemoved', { value: Math.abs(data.value) }),
      ),
  });
  const purchase = useMutation({
    mutationFn: (data: QuickAction) =>
      api.scoring.purchase(workspaceId, {
        teamId: data.teamId,
        itemKey: data.mode as 'piece' | 'item',
        quantity: data.value,
        idempotencyKey: createIdempotencyKey(),
      }),
    onSuccess: (_result, data) =>
      success(
        data.mode === 'piece'
          ? t('page.boughtPiece', { value: data.value })
          : t('page.boughtItem', { value: data.value }),
      ),
  });
  if (workspace.isLoading || ranking.isLoading || activities.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (workspace.isError || ranking.isError || activities.isError || !ranking.data)
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
  const statusKey = workspace.data?.status || '';
  const disabledReason =
    workspace.data?.status !== 'active'
      ? t('page.locked', {
          status: tc(`status.${statusKey}`, { defaultValue: statusKey }),
        })
      : t('page.viewerOnly');
  const shop = shopConfigFromRanking(ranking.data);
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  return (
    <div className="page-shell">
      <PageHeader
        title={t('page.title')}
        description={t('page.description')}
        actions={
          <Badge tone={online ? 'outline' : 'danger'} className="gap-1.5 font-normal">
            {online ? (
              <Cloud className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
            ) : (
              <CloudOff className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className={online ? 'text-[var(--muted-foreground)]' : undefined}>
              {online
                ? t('page.connected', {
                    time: updated.toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : t('page.disconnected')}
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
          <span>{t('page.offline')}</span>
        </Alert>
      )}
      {(game.error || quick.error || purchase.error) && (
        <Alert variant="destructive" className="mb-4">
          {(game.error || quick.error || purchase.error)?.message}
        </Alert>
      )}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <RankEntry
          teams={ranking.data.teams}
          activities={activities.data || []}
          saving={game.isPending}
          disabled={!canScore || !online}
          loadingResults={gameResults.isFetching && Boolean(rankActivityKey)}
          prefillRanks={prefillRanks}
          onActivityChange={setRankActivityKey}
          onSubmit={(activityKey, ranks, mode) => game.mutate({ activityKey, ranks, mode })}
        />
        <QuickActions
          teams={ranking.data.teams}
          shop={shop}
          shopReady
          saving={quick.isPending || purchase.isPending}
          disabled={!canScore || !online}
          onQuick={(data) => quick.mutate(data)}
          onPurchase={(data) => purchase.mutate(data)}
        />
      </div>
    </div>
  );
}
