import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import type { Team, TeamDetail } from '../../lib/types';
import { Leaderboard } from './Leaderboard';
import { PublicLinkCard } from './PublicLinkCard';
import { TeamDetailView } from './TeamDetailView';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;

export function InternalRankingPage() {
  const { t: tr } = useTranslation('ranking');
  const { t: tc } = useTranslation('common');
  const { workspaceId = '' } = useParams();
  const toast = useToast();
  const client = useQueryClient();
  const [team, setTeam] = useState<Team>();
  const [slugDraft, setSlugDraft] = useState('');
  const [useCustomSlug, setUseCustomSlug] = useState(false);
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const ranking = useQuery({
    queryKey: ['ranking', workspaceId],
    queryFn: () => api.scoring.ranking(workspaceId),
  });
  const links = useQuery({
    queryKey: ['public-links', workspaceId],
    queryFn: () => api.workspaces.publicLinks(workspaceId),
    enabled: ['owner', 'admin'].includes(workspace.data?.role || ''),
  });
  const detail = useQuery({
    queryKey: ['team-detail', workspaceId, team?.teamId],
    queryFn: () => api.scoring.teamDetail(workspaceId, team!.teamId),
    enabled: !!team,
  });
  const refreshLinks = () => client.invalidateQueries({ queryKey: ['public-links', workspaceId] });
  const create = useMutation({
    mutationFn: () => {
      const slug = useCustomSlug ? slugDraft.trim().toLowerCase() : undefined;
      if (slug && !SLUG_RE.test(slug)) throw new Error(tr('internal.invalidSlug'));
      return api.workspaces.createPublicLink(workspaceId, {
        label: tr('internal.defaultLabel'),
        slug,
        isEnabled: true,
      });
    },
    onSuccess: () => {
      refreshLinks();
      setSlugDraft('');
      setUseCustomSlug(false);
      toast(tr('internal.created'));
    },
    onError: (error: Error) => toast(error.message || tr('internal.createFailed')),
  });
  if (workspace.isLoading || ranking.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (workspace.isError || ranking.isError || !ranking.data)
    return (
      <div className="page-shell">
        <ErrorState retry={() => ranking.refetch()} />
      </div>
    );
  const roleCanManage = ['owner', 'admin'].includes(workspace.data?.role || '');
  const canManage = roleCanManage && workspace.data?.status === 'active';
  const existing = links.data?.[0];
  const statusKey = workspace.data?.status || '';
  return (
    <div className="page-shell hoh-atmosphere">
      <PageHeader title={tr('internal.title')} description={tr('internal.description')} />
      {roleCanManage && !canManage && (
        <Alert variant="warning" className="mb-5" role="status">
          {tr('internal.readonly', {
            status: tc(`status.${statusKey}`, { defaultValue: statusKey }),
          })}
        </Alert>
      )}
      <Leaderboard ranking={ranking.data} onTeam={setTeam} />
      {roleCanManage && (
        <section className="mt-8">
          <h2 className="section-title mb-3">{tr('internal.publicLinks')}</h2>
          {links.isLoading ? (
            <LoadingState rows={1} />
          ) : links.isError ? (
            <ErrorState retry={() => links.refetch()} />
          ) : existing ? (
            <PublicLinkCard
              link={existing}
              workspaceId={workspaceId}
              readOnly={!canManage}
              onRefresh={refreshLinks}
            />
          ) : (
            <Card className="grid gap-4 p-4">
              <EmptyState
                title={tr('internal.emptyLinksTitle')}
                message={tr('internal.emptyLinksMessage')}
              />
              {canManage && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={useCustomSlug}
                      onChange={(event) => setUseCustomSlug(event.target.checked)}
                    />
                    {tr('internal.useCustomSlug')}
                  </label>
                  {useCustomSlug && (
                    <Field label={tr('internal.slugField')} htmlFor="public-slug">
                      <Input
                        id="public-slug"
                        placeholder={tr('internal.slugPlaceholder')}
                        value={slugDraft}
                        onChange={(event) => setSlugDraft(event.target.value.toLowerCase())}
                      />
                    </Field>
                  )}
                  <Button
                    className="justify-self-start"
                    loading={create.isPending}
                    onClick={() => create.mutate()}
                  >
                    <Link2 className="h-4 w-4" />
                    {tr('internal.createLink')}
                  </Button>
                </>
              )}
            </Card>
          )}
        </section>
      )}
      <Modal
        open={!!team}
        onClose={() => setTeam(undefined)}
        title={team?.displayName || team?.name || tr('internal.teamDetail')}
      >
        {detail.isLoading ? (
          <LoadingState />
        ) : detail.isError ? (
          <ErrorState retry={() => detail.refetch()} />
        ) : detail.data ? (
          <TeamDetailView detail={detail.data as TeamDetail} />
        ) : null}
      </Modal>
    </div>
  );
}
