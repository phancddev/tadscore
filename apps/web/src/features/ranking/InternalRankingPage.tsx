import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useState } from 'react';
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
      if (slug && !SLUG_RE.test(slug))
        throw new Error('Slug không hợp lệ (a-z, 0-9, dấu -, 3–80 ký tự)');
      return api.workspaces.createPublicLink(workspaceId, {
        label: 'Bảng xếp hạng',
        slug,
        isEnabled: true,
      });
    },
    onSuccess: () => {
      refreshLinks();
      setSlugDraft('');
      setUseCustomSlug(false);
      toast('Đã tạo link public');
    },
    onError: (error: Error) => toast(error.message || 'Không tạo được link'),
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
  return (
    <div className="page-shell">
      <PageHeader
        title="Bảng xếp hạng"
        description="Chọn một đội để xem chi tiết các giao dịch điểm."
      />
      {roleCanManage && !canManage && (
        <Alert variant="warning" className="mb-5" role="status">
          Workspace đang {workspace.data?.status}; link public hiện chỉ đọc và không thể chỉnh sửa.
        </Alert>
      )}
      <Leaderboard ranking={ranking.data} onTeam={setTeam} />
      {roleCanManage && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Link public</h2>
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
                title="Chưa có link public"
                message="Tạo một lần — sau đó bật/tắt public hoặc custom slug mà không cần regenerate."
              />
              {canManage && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={useCustomSlug}
                      onChange={(event) => setUseCustomSlug(event.target.checked)}
                    />
                    Dùng custom slug (song song với link random)
                  </label>
                  {useCustomSlug && (
                    <Field label="Custom slug" htmlFor="public-slug">
                      <Input
                        id="public-slug"
                        placeholder="vd: hoh-2026"
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
                    Tạo link public
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
        title={team?.displayName || team?.name || 'Chi tiết đội'}
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
