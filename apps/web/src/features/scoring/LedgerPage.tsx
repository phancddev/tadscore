import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, RotateCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import i18n from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { LedgerEntry } from '../../lib/types';
import { parseMedalDelta } from './parseMedalDelta';

export function LedgerPage() {
  const { t } = useTranslation('scoring');
  const { t: tc } = useTranslation('common');
  const { workspaceId = '' } = useParams();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [deltaText, setDeltaText] = useState('');
  const [reason, setReason] = useState('');
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
    mutationFn: ({ id, reason: reverseReason }: { id: string; reason: string }) =>
      api.scoring.reverse(workspaceId, id, reverseReason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['ledger', workspaceId] });
      client.invalidateQueries({ queryKey: ['ranking', workspaceId] });
      toast(t('ledger.reversed'));
    },
  });
  const updateEntry = useMutation({
    mutationFn: ({
      id,
      medalDelta,
      reason: nextReason,
    }: {
      id: string;
      medalDelta: number;
      reason: string;
    }) => api.scoring.updateLedgerEntry(workspaceId, id, { medalDelta, reason: nextReason }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['ledger', workspaceId] });
      client.invalidateQueries({ queryKey: ['ranking', workspaceId] });
      toast(t('ledger.updated'));
      setEditing(null);
    },
  });
  useEffect(() => {
    if (!editing) return;
    const sign = editing.medalDelta > 0 ? '+' : '';
    setDeltaText(`${sign}${editing.medalDelta}`);
    setReason(String(editing.metadata?.reason ?? ''));
  }, [editing]);
  const allItems = ledger.data || [];
  const items = allItems.filter((item) =>
    `${item.teamName} ${item.activityName} ${item.entryType} ${item.metadata?.reason ?? ''}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const reversedIds = new Set(
    allItems.map((entry) => entry.reversesEntryId).filter((id): id is string => Boolean(id)),
  );
  const workspaceActive = workspace.data?.status === 'active';
  const canMutate =
    workspaceActive && ['owner', 'admin', 'scorer'].includes(workspace.data?.role ?? '');
  const canReverse = workspaceActive && ['owner', 'admin'].includes(workspace.data?.role ?? '');
  const parsedDelta = parseMedalDelta(deltaText);
  const reasonTrimmed = reason.trim();
  const formValid = parsedDelta.ok && reasonTrimmed.length >= 2;
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
          {items.map((entry) => {
            const isAlreadyReversed = Boolean(entry.reversedAt) || reversedIds.has(entry.id);
            const isEditable =
              canMutate &&
              ['adjustment', 'penalty'].includes(entry.entryType) &&
              !isAlreadyReversed;
            const isReversible =
              canReverse &&
              ['adjustment', 'penalty', 'purchase'].includes(entry.entryType) &&
              !isAlreadyReversed;
            return (
              <Card key={entry.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-[11rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="m-0 text-sm font-semibold">{entry.teamName}</h2>
                      <Badge tone="outline">{entry.entryType}</Badge>
                      {entry.reversesEntryId && (
                        <Badge tone="warning">{t('ledger.reversal')}</Badge>
                      )}
                      {isAlreadyReversed && !entry.reversesEntryId && (
                        <Badge tone="danger">{t('ledger.alreadyReversed')}</Badge>
                      )}
                      {entry.entryType === 'activity_award' && (
                        <Badge tone="neutral">{t('ledger.bulkEdit')}</Badge>
                      )}
                    </div>
                    <p className="m-0 mt-1 text-sm text-[var(--muted-foreground)]">
                      {entry.activityName ||
                        String(
                          entry.metadata?.reason || entry.metadata?.kind || t('ledger.adjustment'),
                        )}
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
                  <div className="flex flex-wrap gap-2">
                    {isEditable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('ledger.editAria', { team: entry.teamName })}
                        onClick={() => setEditing(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                        {t('ledger.edit')}
                      </Button>
                    )}
                    {isReversible && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('ledger.reverseAria', { team: entry.teamName })}
                        onClick={() => {
                          const reverseReason = prompt(t('ledger.reasonPrompt'));
                          if (reverseReason?.trim())
                            reverse.mutate({ id: entry.id, reason: reverseReason.trim() });
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t('ledger.reverse')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Modal
        open={!!editing}
        onClose={() => !updateEntry.isPending && setEditing(null)}
        title={t('ledger.editTitle')}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={updateEntry.isPending}
              onClick={() => setEditing(null)}
            >
              {tc('actions.cancel')}
            </Button>
            <Button
              loading={updateEntry.isPending}
              disabled={!formValid || !editing}
              onClick={() => {
                if (!editing || !parsedDelta.ok) return;
                updateEntry.mutate({
                  id: editing.id,
                  medalDelta: parsedDelta.value,
                  reason: reasonTrimmed,
                });
              }}
            >
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        {editing && (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!parsedDelta.ok || reasonTrimmed.length < 2) return;
              updateEntry.mutate({
                id: editing.id,
                medalDelta: parsedDelta.value,
                reason: reasonTrimmed,
              });
            }}
          >
            <p className="m-0 text-sm text-[var(--muted-foreground)]">
              {t('ledger.editHint', { team: editing.teamName })}
            </p>
            <Field
              label={t('ledger.editDelta')}
              htmlFor="ledger-edit-delta"
              hint={t('ledger.editDeltaHint')}
              error={!parsedDelta.ok && deltaText ? parsedDelta.error : undefined}
            >
              <Input
                id="ledger-edit-delta"
                value={deltaText}
                onChange={(event) => setDeltaText(event.target.value)}
                placeholder={t('quick.deltaPlaceholder')}
                autoFocus
              />
            </Field>
            <Field
              label={t('ledger.editReason')}
              htmlFor="ledger-edit-reason"
              error={
                reason.length > 0 && reasonTrimmed.length < 2
                  ? t('ledger.reasonTooShort')
                  : undefined
              }
            >
              <Textarea
                id="ledger-edit-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('quick.reasonPlaceholder')}
                maxLength={500}
              />
            </Field>
            {updateEntry.error && (
              <p role="alert" className="m-0 text-sm text-[var(--destructive)]">
                {updateEntry.error.message}
              </p>
            )}
          </form>
        )}
      </Modal>
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
