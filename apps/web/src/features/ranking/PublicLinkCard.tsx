import { Copy, ExternalLink, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import i18n from '../../i18n';
import { api } from '../../lib/api';
import type { PublicLink } from '../../lib/types';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;

function absoluteUrl(path?: string | null) {
  if (!path) return '';
  return path.startsWith('http') ? path : `${location.origin}${path}`;
}

export function PublicLinkCard({
  link,
  workspaceId,
  readOnly,
  onRefresh,
}: {
  link: PublicLink;
  workspaceId: string;
  readOnly: boolean;
  onRefresh: () => void;
}) {
  const { t: tr } = useTranslation('ranking');
  const toast = useToast();
  const [slugEdit, setSlugEdit] = useState(link.slug || '');
  const [busy, setBusy] = useState(false);
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN';
  const visibilityLabel = (enabled: boolean) =>
    enabled ? tr('linkCard.public') : tr('linkCard.private');
  useEffect(() => {
    setSlugEdit(link.slug || '');
  }, [link.slug, link.token, link.tokenEnabled, link.slugEnabled]);
  const tokenUrl = absoluteUrl(link.url || (link.token ? `/ranking/${link.token}` : ''));
  const slugUrl = absoluteUrl(link.slugUrl || (link.slug ? `/ranking/${link.slug}` : ''));
  const copy = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast(tr('linkCard.copied', { label }));
  };
  const patch = async (value: Parameters<typeof api.workspaces.updatePublicLink>[2]) => {
    setBusy(true);
    try {
      await api.workspaces.updatePublicLink(workspaceId, link.id, value);
      onRefresh();
      toast(tr('linkCard.updated'));
    } catch (error) {
      toast(error instanceof Error ? error.message : tr('linkCard.updateFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="grid gap-4 p-4">
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium">{link.label || tr('linkCard.defaultLabel')}</p>
        <p className="m-0 mt-0.5 text-sm text-[var(--muted-foreground)]">
          {tr('linkCard.meta', {
            tokenVis: visibilityLabel(link.tokenEnabled),
            slugVis: visibilityLabel(link.slugEnabled),
          })}
          {link.expiresAt
            ? tr('linkCard.expires', {
                date: new Date(link.expiresAt).toLocaleString(locale),
              })
            : tr('linkCard.noExpiry')}
        </p>
      </div>

      <LinkRow
        title={tr('linkCard.randomTitle')}
        url={tokenUrl}
        enabled={link.tokenEnabled}
        emptyHint={tr('linkCard.emptyToken')}
        onCopy={() => copy(tokenUrl, tr('linkCard.copyRandom'))}
        disabled={!tokenUrl}
        readOnly={readOnly}
        busy={busy}
        onToggle={() => patch({ tokenEnabled: !link.tokenEnabled })}
        visibilityLabel={visibilityLabel}
        copyLabel={tr('linkCard.copy')}
        openLabel={tr('linkCard.open')}
        makePrivateLabel={tr('linkCard.makePrivate')}
        makePublicLabel={tr('linkCard.makePublic')}
      />
      <LinkRow
        title={tr('linkCard.slugTitle')}
        url={slugUrl}
        enabled={link.slugEnabled}
        emptyHint={link.slug ? undefined : tr('linkCard.noSlug')}
        onCopy={() => copy(slugUrl, tr('linkCard.copySlug'))}
        disabled={!slugUrl}
        readOnly={readOnly || !link.slug}
        busy={busy}
        onToggle={() => patch({ slugEnabled: !link.slugEnabled })}
        visibilityLabel={visibilityLabel}
        copyLabel={tr('linkCard.copy')}
        openLabel={tr('linkCard.open')}
        makePrivateLabel={tr('linkCard.makePrivate')}
        makePublicLabel={tr('linkCard.makePublic')}
      />

      {!readOnly && (
        <div className="grid gap-3 border-t border-[var(--border)] pt-4">
          <Field label={tr('linkCard.slugLabel')} htmlFor="edit-public-slug">
            <div className="flex flex-wrap gap-2">
              <Input
                id="edit-public-slug"
                className="min-w-[12rem] flex-1"
                placeholder={tr('linkCard.slugPlaceholder')}
                value={slugEdit}
                onChange={(event) => setSlugEdit(event.target.value.toLowerCase())}
              />
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => {
                  const next = slugEdit.trim();
                  if (next && !SLUG_RE.test(next)) {
                    toast(tr('linkCard.invalidSlug'));
                    return;
                  }
                  void patch({ slug: next || null });
                }}
              >
                {tr('linkCard.saveSlug')}
              </Button>
            </div>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              loading={busy}
              onClick={async () => {
                if (!confirm(tr('linkCard.regenerateConfirm'))) return;
                setBusy(true);
                try {
                  await api.workspaces.regeneratePublicLink(workspaceId, link.id);
                  onRefresh();
                  toast(tr('linkCard.regenerated'));
                } catch (error) {
                  toast(error instanceof Error ? error.message : tr('linkCard.regenerateFailed'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              {tr('linkCard.regenerateToken')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function LinkRow({
  title,
  url,
  enabled,
  emptyHint,
  onCopy,
  disabled,
  readOnly,
  busy,
  onToggle,
  visibilityLabel,
  copyLabel,
  openLabel,
  makePrivateLabel,
  makePublicLabel,
}: {
  title: string;
  url: string;
  enabled: boolean;
  emptyHint?: string;
  onCopy: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  busy?: boolean;
  onToggle: () => void;
  visibilityLabel: (enabled: boolean) => string;
  copyLabel: string;
  openLabel: string;
  makePrivateLabel: string;
  makePublicLabel: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {title}
        </p>
        <span
          className={`text-xs font-medium ${enabled ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}
        >
          {visibilityLabel(enabled)}
        </span>
      </div>
      {url ? (
        <p className="m-0 mt-1 break-all text-sm">{url}</p>
      ) : (
        <p className="m-0 mt-1 text-sm text-[var(--muted-foreground)]">{emptyHint || '—'}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={disabled} onClick={onCopy}>
          <Copy className="h-4 w-4" />
          {copyLabel}
        </Button>
        {url && (
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-medium hover:bg-[var(--muted)]"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            {openLabel}
          </a>
        )}
        {!readOnly && (
          <Button variant="ghost" loading={busy} onClick={onToggle}>
            {enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {enabled ? makePrivateLabel : makePublicLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
