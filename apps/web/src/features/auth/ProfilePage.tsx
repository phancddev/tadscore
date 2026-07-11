import { useMutation } from '@tanstack/react-query';
import { Camera, KeyRound, MailCheck, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/AuthProvider';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';

export function ProfilePage() {
  const { t } = useTranslation('auth');
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [logoutOthers, setLogoutOthers] = useState(true);
  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setUsername(user.username);
      setEmail(user.email);
      setPendingEmail(user.pendingEmail || '');
    }
  }, [user]);
  const save = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({ fullName, username, ...(email !== user?.email ? { email } : {}) }),
    onSuccess: (result) => {
      refresh();
      if (result.emailVerificationPending) setPendingEmail(email);
      toast(result.emailVerificationPending ? t('profile.emailPending') : t('profile.updated'));
    },
  });
  const verify = useMutation({
    mutationFn: () => api.auth.verifyProfileEmail({ email: pendingEmail, code }),
    onSuccess: () => {
      setPendingEmail('');
      setCode('');
      refresh();
      toast(t('profile.emailVerified'));
    },
  });
  const password = useMutation({
    mutationFn: () => api.auth.password({ currentPassword, newPassword, logoutOthers }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      toast(t('profile.passwordChanged'));
    },
  });
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) return toast(t('profile.avatarTooLarge'), 'error');
    try {
      await api.auth.avatar(file);
      await refresh();
      toast(t('profile.avatarUpdated'));
    } catch (error) {
      toast(error instanceof Error ? error.message : t('profile.avatarFailed'), 'error');
    }
  };
  return (
    <div className="page-shell max-w-5xl">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />
      <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
        <Card>
          <CardContent className="pt-5">
            <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--muted)]">
              <span className="grid h-full place-items-center text-4xl font-semibold text-[var(--muted-foreground)]">
                {user?.fullName?.slice(0, 1)}
              </span>
              {user?.avatarUrl && (
                <img
                  className="absolute inset-0 h-full w-full object-cover"
                  src={user.avatarUrl}
                  alt={t('profile.avatarAlt')}
                />
              )}
            </div>
            <label className="mx-auto mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-medium hover:bg-[var(--muted)]">
              <Camera className="h-4 w-4" />
              {t('profile.changePhoto')}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => upload(event.target.files?.[0])}
              />
            </label>
            <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
              {t('profile.photoHint')}
            </p>
          </CardContent>
        </Card>
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.displayInfo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  save.mutate();
                }}
              >
                <ProfileField
                  id="full-name"
                  label={t('profile.fullName')}
                  value={fullName}
                  set={setFullName}
                />
                <ProfileField
                  id="username"
                  label={t('register.username')}
                  value={username}
                  set={setUsername}
                />
                <ProfileField
                  id="email"
                  label={t('profile.email')}
                  type="email"
                  value={email}
                  set={setEmail}
                  hint={t('profile.emailHint')}
                />
                {save.error && <Alert variant="destructive">{save.error.message}</Alert>}
                <Button loading={save.isPending} className="justify-self-start">
                  <Save className="h-4 w-4" />
                  {t('profile.save')}
                </Button>
              </form>
            </CardContent>
          </Card>
          {pendingEmail && (
            <Card className="border-[var(--warning)]/30">
              <CardHeader>
                <CardTitle>{t('profile.verifyPending', { email: pendingEmail })}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    verify.mutate();
                  }}
                >
                  <ProfileField
                    id="email-code"
                    label={t('profile.code')}
                    value={code}
                    set={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <Button
                    loading={verify.isPending}
                    disabled={code.length !== 6}
                    className="justify-self-start"
                  >
                    <MailCheck className="h-4 w-4" />
                    {t('profile.verifyEmail')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.changePassword')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  password.mutate();
                }}
              >
                <ProfileField
                  id="current-password"
                  label={t('profile.currentPassword')}
                  type="password"
                  value={currentPassword}
                  set={setCurrentPassword}
                />
                <ProfileField
                  id="new-password"
                  label={t('profile.newPassword')}
                  type="password"
                  value={newPassword}
                  set={setNewPassword}
                  hint={t('profile.passwordHint')}
                />
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={logoutOthers}
                    onChange={(event) => setLogoutOthers(event.target.checked)}
                  />
                  {t('profile.logoutOthers')}
                </label>
                <Button
                  variant="secondary"
                  loading={password.isPending}
                  className="justify-self-start"
                >
                  <KeyRound className="h-4 w-4" />
                  {t('profile.submitPassword')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileField({
  id,
  label,
  value,
  set,
  type = 'text',
  hint,
}: {
  id: string;
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        required
        minLength={type === 'password' ? 10 : undefined}
        type={type}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </Field>
  );
}
