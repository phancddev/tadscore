import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { Textarea } from '../../components/ui/Textarea';
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
  const { t } = useTranslation('workspace');
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
      if (!selected) throw new Error(t('create.ruleRequired'));
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
      <PageHeader
        title={t('list.title')}
        description={t('list.description')}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('list.create')}
          </Button>
        }
      />
      {workspaces.isLoading ? (
        <LoadingState />
      ) : workspaces.isError ? (
        <ErrorState retry={() => workspaces.refetch()} />
      ) : !workspaces.data?.length ? (
        <EmptyState title={t('list.emptyTitle')} message={t('list.emptyMessage')} />
      ) : (
        <div className="grid-auto">
          {workspaces.data.map((item) => (
            <Link key={item.id} to={`/workspaces/${item.id}`} className="group block">
              <Card className="h-full transition-colors hover:bg-[var(--muted)]/40">
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <CardTitle className="font-display text-lg">{item.name}</CardTitle>
                  <Badge tone={item.status === 'active' ? 'success' : 'warning'}>
                    {item.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="m-0 text-sm text-[var(--muted-foreground)]">
                    {t('list.rule', { id: item.ruleId, version: item.ruleVersion })}
                  </p>
                </CardContent>
                <CardFooter className="justify-between border-t border-[var(--border)] pt-4 text-sm">
                  <span className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Users className="h-4 w-4" />
                    {t('list.members', { count: item.memberCount ?? '—' })}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t('create.title')}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label={t('create.name')} htmlFor="workspace-name">
            <Input
              id="workspace-name"
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slug) setSlug(slugify(event.target.value));
              }}
              placeholder={t('create.namePlaceholder')}
            />
          </Field>
          <Field label={t('create.slug')} htmlFor="slug" hint={t('create.slugHint')}>
            <Input
              id="slug"
              required
              pattern="[a-z0-9][a-z0-9-]{2,79}"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
            />
          </Field>
          <Field label={t('create.description')} htmlFor="description">
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label={t('create.rule')} htmlFor="rule">
            <Select
              id="rule"
              required
              value={rule}
              onChange={(event) => setRule(event.target.value)}
            >
              <option value="">{t('create.rulePlaceholder')}</option>
              {rules.data?.map((item) => (
                <option key={`${item.id}:${item.version}`} value={`${item.id}:${item.version}`}>
                  {item.name} · {item.version}
                </option>
              ))}
            </Select>
          </Field>
          {create.error && (
            <p role="alert" className="text-sm text-[var(--destructive)]">
              {create.error.message}
            </p>
          )}
          <Button type="submit" loading={create.isPending}>
            {t('create.submit')}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
