import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { api } from '../../lib/api';

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
export function WorkspacesPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [rule, setRule] = useState('');
  const client = useQueryClient();
  const navigate = useNavigate();
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces.list });
  const rules = useQuery({ queryKey: ['rules'], queryFn: api.rules.list });
  const create = useMutation({
    mutationFn: () => {
      const selected = rules.data?.find((item) => `${item.id}:${item.version}` === rule);
      if (!selected) throw new Error('Chọn một bộ luật');
      return api.workspaces.create({
        name,
        slug,
        description: description || undefined,
        ruleId: selected.id,
        ruleVersion: selected.version,
      });
    },
    onSuccess: (workspace) => {
      client.invalidateQueries({ queryKey: ['workspaces'] });
      setOpen(false);
      navigate(`/workspaces/${workspace.id}`);
    },
  });
  return (
    <div className="page-shell">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Điều hành sự kiện</p>
          <h1 className="page-title mt-2">Không gian làm việc</h1>
          <p className="mt-2 muted">Mỗi workspace giữ riêng bộ luật, thành viên và lịch sử điểm.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo workspace
        </Button>
      </header>
      {workspaces.isLoading ? (
        <LoadingState />
      ) : workspaces.isError ? (
        <ErrorState retry={() => workspaces.refetch()} />
      ) : !workspaces.data?.length ? (
        <EmptyState
          title="Chưa có workspace"
          message="Tạo workspace đầu tiên để bắt đầu chấm điểm."
        />
      ) : (
        <div className="grid-auto">
          {workspaces.data.map((item) => (
            <Link
              key={item.id}
              to={`/workspaces/${item.id}`}
              className="app-card group p-5 transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <CalendarDays />
                </span>
                <Badge tone={item.status === 'active' ? 'success' : 'warning'}>{item.status}</Badge>
              </div>
              <h2 className="mb-1 mt-5 text-xl font-bold">{item.name}</h2>
              <p className="m-0 text-sm muted">
                {item.ruleId} · {item.ruleVersion}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm">
                <span className="flex items-center gap-2 muted">
                  <Users className="h-4 w-4" />
                  {item.memberCount ?? '—'} thành viên
                </span>
                <ArrowRight className="h-5 w-5 text-[var(--primary)]" />
              </div>
            </Link>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Tạo workspace">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="workspace-name">Tên workspace</label>
            <input
              id="workspace-name"
              className="input"
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slug) setSlug(slugify(event.target.value));
              }}
              placeholder="Trại hè 2026"
            />
          </div>
          <div className="field">
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              className="input"
              required
              pattern="[a-z0-9][a-z0-9-]{2,79}"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
            />
            <span className="text-xs muted">Dùng để nhận diện ngắn gọn, không chứa dấu.</span>
          </div>
          <div className="field">
            <label htmlFor="description">Mô tả</label>
            <textarea
              id="description"
              className="input min-h-24"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="rule">Bộ luật</label>
            <select
              id="rule"
              className="input"
              required
              value={rule}
              onChange={(event) => setRule(event.target.value)}
            >
              <option value="">Chọn bộ luật</option>
              {rules.data?.map((item) => (
                <option key={`${item.id}:${item.version}`} value={`${item.id}:${item.version}`}>
                  {item.name} · {item.version}
                </option>
              ))}
            </select>
          </div>
          {create.error && (
            <p role="alert" className="field-error">
              {create.error.message}
            </p>
          )}
          <Button type="submit" loading={create.isPending}>
            Tạo workspace
          </Button>
        </form>
      </Modal>
    </div>
  );
}
