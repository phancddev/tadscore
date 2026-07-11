import { Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import type { Invitation, WorkspaceRole } from '../../lib/types';

export function RoleField({
  role,
  setRole,
}: {
  role: string;
  setRole: (role: Exclude<WorkspaceRole, 'owner'>) => void;
}) {
  const { t } = useTranslation('workspace');
  const { t: tc } = useTranslation('common');
  return (
    <Field label={t('members.grantedRole')} htmlFor="invite-role">
      <Select
        id="invite-role"
        value={role}
        onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, 'owner'>)}
      >
        <option value="admin">{tc('roles.admin')}</option>
        <option value="scorer">{tc('roles.scorer')}</option>
        <option value="viewer">{tc('roles.viewer')}</option>
      </Select>
    </Field>
  );
}

export function InviteRow({
  invite,
  canRevoke,
  locale,
  onRevoke,
}: {
  invite: Invitation;
  canRevoke: boolean;
  locale: string;
  onRevoke: () => void;
}) {
  const { t } = useTranslation('workspace');
  const { t: tc } = useTranslation('common');
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <Link2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
      <div className="min-w-0 flex-1">
        <strong className="text-sm font-semibold">
          {invite.kind === 'email' ? invite.email : t('members.shareLink')}
        </strong>
        <p className="m-0 text-sm text-[var(--muted-foreground)]">
          {tc(`roles.${invite.role}`, { defaultValue: invite.role })} ·{' '}
          {t('members.expires', { date: new Date(invite.expiresAt).toLocaleString(locale) })} ·{' '}
          {t('members.uses', { used: invite.useCount || 0, max: invite.maxUses })}
        </p>
      </div>
      <Badge tone={invite.status === 'pending' ? 'success' : 'warning'}>{invite.status}</Badge>
      {canRevoke && invite.status === 'pending' && (
        <Button variant="ghost" className="text-[var(--destructive)]" onClick={onRevoke}>
          {t('members.revoke')}
        </Button>
      )}
    </Card>
  );
}
