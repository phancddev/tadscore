import { Copy, ExternalLink, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import type { PublicLink } from '../../lib/types';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;

function absoluteUrl(path?: string | null) {
  if (!path) return '';
  return path.startsWith('http') ? path : `${location.origin}${path}`;
}

function visibilityLabel(enabled: boolean) {
  return enabled ? 'Public' : 'Private (404)';
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
  const toast = useToast();
  const [slugEdit, setSlugEdit] = useState(link.slug || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSlugEdit(link.slug || '');
  }, [link.slug, link.token, link.tokenEnabled, link.slugEnabled]);
  const tokenUrl = absoluteUrl(link.url || (link.token ? `/ranking/${link.token}` : ''));
  const slugUrl = absoluteUrl(link.slugUrl || (link.slug ? `/ranking/${link.slug}` : ''));
  const copy = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast(`Đã sao chép ${label}`);
  };
  const patch = async (value: Parameters<typeof api.workspaces.updatePublicLink>[2]) => {
    setBusy(true);
    try {
      await api.workspaces.updatePublicLink(workspaceId, link.id, value);
      onRefresh();
      toast('Đã cập nhật link');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="grid gap-4 p-4">
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium">{link.label || 'Bảng xếp hạng'}</p>
        <p className="m-0 mt-0.5 text-sm text-[var(--muted-foreground)]">
          Token: {visibilityLabel(link.tokenEnabled)} · Slug: {visibilityLabel(link.slugEnabled)}
          {link.expiresAt
            ? ` · hết hạn ${new Date(link.expiresAt).toLocaleString('vi-VN')}`
            : ' · không hết hạn'}
        </p>
      </div>

      <LinkRow
        title="Link random token"
        url={tokenUrl}
        enabled={link.tokenEnabled}
        emptyHint="Token cũ chỉ lưu hash — bấm Regenerate để hiện URL mới (link random cũ sẽ 404; slug giữ nguyên)."
        onCopy={() => copy(tokenUrl, 'link random')}
        disabled={!tokenUrl}
        readOnly={readOnly}
        busy={busy}
        onToggle={() => patch({ tokenEnabled: !link.tokenEnabled })}
      />
      <LinkRow
        title="Link custom slug"
        url={slugUrl}
        enabled={link.slugEnabled}
        emptyHint={
          link.slug ? undefined : 'Chưa đặt slug — thêm bên dưới để có link đẹp song song.'
        }
        onCopy={() => copy(slugUrl, 'link slug')}
        disabled={!slugUrl}
        readOnly={readOnly || !link.slug}
        busy={busy}
        onToggle={() => patch({ slugEnabled: !link.slugEnabled })}
      />

      {!readOnly && (
        <div className="grid gap-3 border-t border-[var(--border)] pt-4">
          <Field label="Custom slug (tùy chọn)" htmlFor="edit-public-slug">
            <div className="flex flex-wrap gap-2">
              <Input
                id="edit-public-slug"
                className="min-w-[12rem] flex-1"
                placeholder="vd: hoh-2026"
                value={slugEdit}
                onChange={(event) => setSlugEdit(event.target.value.toLowerCase())}
              />
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => {
                  const next = slugEdit.trim();
                  if (next && !SLUG_RE.test(next)) {
                    toast('Slug không hợp lệ (a-z, 0-9, dấu -, 3–80 ký tự)');
                    return;
                  }
                  void patch({ slug: next || null });
                }}
              >
                Lưu slug
              </Button>
            </div>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              loading={busy}
              onClick={async () => {
                if (
                  !confirm(
                    'Tạo token random mới? Link random cũ sẽ 404. Link slug và trạng thái public/private giữ nguyên.',
                  )
                )
                  return;
                setBusy(true);
                try {
                  await api.workspaces.regeneratePublicLink(workspaceId, link.id);
                  onRefresh();
                  toast('Đã regenerate token');
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Regenerate thất bại');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Regenerate token
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
          Sao chép
        </Button>
        {url && (
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-medium hover:bg-[var(--muted)]"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Mở
          </a>
        )}
        {!readOnly && (
          <Button variant="ghost" loading={busy} onClick={onToggle}>
            {enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {enabled ? 'Đặt private' : 'Đặt public'}
          </Button>
        )}
      </div>
    </div>
  );
}
