import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Gem, Medal, Package, Radio, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Metric } from '../../components/ui/Metric';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { api } from '../../lib/api';

export function WorkspaceOverview() {
  const { t } = useTranslation('workspace');
  const { t: tc } = useTranslation('common');
  const { workspaceId = '' } = useParams();
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const ranking = useQuery({
    queryKey: ['ranking', workspaceId],
    queryFn: () => api.scoring.ranking(workspaceId),
  });
  if (workspace.isLoading || ranking.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (workspace.isError || ranking.isError)
    return (
      <div className="page-shell">
        <ErrorState
          retry={() => {
            workspace.refetch();
            ranking.refetch();
          }}
        />
      </div>
    );
  const status = workspace.data?.status || '';
  const statusLabel = status ? tc(`status.${status}`, { defaultValue: status }) : status;
  return (
    <div className="page-shell">
      <PageHeader
        title={workspace.data?.name || ''}
        description={`${workspace.data?.ruleId} · ${t('overview.ruleVersion', {
          version: workspace.data?.ruleVersion,
        })}${workspace.data?.description ? ` · ${workspace.data.description}` : ''}`}
        actions={
          <Badge tone={workspace.data?.status === 'active' ? 'success' : 'warning'}>
            {workspace.data?.status}
          </Badge>
        }
      />
      {workspace.data?.status !== 'active' && (
        <Alert variant="warning" className="mb-5">
          <span>{t('overview.statusAlert', { status: statusLabel })}</span>
        </Alert>
      )}
      <section aria-labelledby="teams-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="teams-title" className="section-title m-0">
            {t('overview.teamsTitle')}
          </h2>
          <Link
            className="flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline"
            to="ranking"
          >
            {t('overview.viewRanking')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid-auto">
          {ranking.data?.teams.map((team) => (
            <Card className="overflow-hidden" key={team.teamId}>
              <div className="h-1" style={{ backgroundColor: team.color || 'var(--primary)' }} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      team.rank === 1
                        ? 'hoh-rank-1 text-sm font-medium'
                        : 'text-sm font-medium text-[var(--muted-foreground)]'
                    }
                  >
                    {t('overview.rank', { rank: team.rank })}
                  </span>
                  <Badge tone={team.eligible ? 'success' : 'neutral'}>
                    {team.eligible ? t('overview.eligible') : t('overview.accumulating')}
                  </Badge>
                </div>
                <h3 className="font-display m-0 text-xl font-semibold tracking-tight">
                  {team.displayName || team.name}
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <Metric icon={Medal} value={team.medals} label={tc('metrics.medals')} />
                  <Metric icon={Gem} value={team.pieces} label={tc('metrics.pieces')} />
                  <Metric icon={Package} value={team.items} label={tc('metrics.items')} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link to="score" className="block">
          <Card className="flex min-h-20 items-center gap-4 p-5 transition-colors hover:bg-[var(--primary-soft)]/50">
            <Radio className="h-5 w-5 shrink-0 text-[var(--primary)]" />
            <div>
              <h2 className="font-display m-0 text-base font-semibold">
                {t('overview.scoreTitle')}
              </h2>
              <p className="m-0 text-sm text-[var(--muted-foreground)]">
                {t('overview.scoreDescription')}
              </p>
            </div>
          </Card>
        </Link>
        <Link to="members" className="block">
          <Card className="flex min-h-20 items-center gap-4 p-5 transition-colors hover:bg-[var(--primary-soft)]/50">
            <Users className="h-5 w-5 shrink-0 text-[var(--primary)]" />
            <div>
              <h2 className="font-display m-0 text-base font-semibold">
                {t('overview.membersTitle')}
              </h2>
              <p className="m-0 text-sm text-[var(--muted-foreground)]">
                {t('overview.membersDescription')}
              </p>
            </div>
          </Card>
        </Link>
      </section>
    </div>
  );
}
