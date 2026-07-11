import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import i18n from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';

export function LedgerPage() {
  const { t } = useTranslation('scoring');
  const { t: tc } = useTranslation('common');
  const { workspaceId = '' } = useParams();
  const [filter, setFilter] = useState('');
  const client = useQueryClient();
  const toast = useToast();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
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
      toast(t('ledger.reversed'));
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
      <PageHeader title={t('ledger.title')} description={t('ledger.description')} />
      <label className="relative mb-4 block max-w-md">
        <span className="sr-only">{t('ledger.searchLabel')}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
          aria-hidden
        />
        <Input
          className="pl-10"
          placeholder={t('ledger.searchPlaceholder')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      {ledger.isLoading ? (
        <LoadingState />
      ) : ledger.isError ? (
        <ErrorState retry={() => ledger.refetch()} />
      ) : !items.length ? (
        <EmptyState title={t('ledger.emptyTitle')} message={t('ledger.emptyMessage')} />
      ) : (
        <div className="grid gap-3">
          {items.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-[11rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="m-0 text-sm font-semibold">{entry.teamName}</h2>
                    <Badge tone="outline">{entry.entryType}</Badge>
                    {entry.reversesEntryId && <Badge tone="warning">{t('ledger.reversal')}</Badge>}
                    {entry.entryType === 'activity_award' && (
                      <Badge tone="neutral">{t('ledger.bulkEdit')}</Badge>
                    )}
                  </div>
                  <p className="m-0 mt-1 text-sm text-[var(--muted-foreground)]">
                    {entry.activityName ||
                      String(entry.metadata?.reason || entry.metadata?.kind || t('ledger.adjustment'))}
                  </p>
                  <p className="m-0 mt-1 text-xs text-[var(--muted-foreground)]">
                    {new Date(entry.createdAt).toLocaleString(locale)} · {entry.createdByName}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right tabular">
                  <Delta value={entry.medalDelta} label={tc('metrics.medals')} />
                  <Delta value={entry.pieceDelta} label={tc('metrics.piece')} />
                  <Delta value={entry.itemDelta} label={tc('metrics.items')} />
                </div>
                {canReverse &&
                  ['adjustment', 'penalty', 'purchase'].includes(entry.entryType) &&
                  !entry.reversedAt &&
                  !reversedIds.has(entry.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('ledger.reverseAria', { team: entry.teamName })}
                      onClick={() => {
                        const reason = prompt(t('ledger.reasonPrompt'));
                        if (reason?.trim()) reverse.mutate({ id: entry.id, reason: reason.trim() });
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t('ledger.reverse')}
                    </Button>
                  )}
              </CardContent>
            </Card>
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
        className={cn(
          'text-sm font-semibold',
          value > 0 && 'text-[var(--success)]',
          value < 0 && 'text-[var(--destructive)]',
        )}
      >
        {value > 0 ? '+' : ''}
        {value}
      </strong>
      <span className="block text-[10px] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}
