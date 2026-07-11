import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../app/AuthProvider';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

type FormData = {
  identifier: string;
  password: string;
};

const internalPath = (value?: string) =>
  value?.startsWith('/') && !value.startsWith('//') ? value : undefined;

export function LoginPage() {
  const { t } = useTranslation('auth');
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const schema = useMemo(
    () =>
      z.object({
        identifier: z.string().min(3, t('login.identifierMin')),
        password: z.string().min(8, t('login.passwordMin')),
      }),
    [t],
  );
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    setServerError('');
    try {
      const user = await api.auth.login(values);
      setUser(user);
      navigate(internalPath((location.state as { from?: string })?.from) || '/workspaces');
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t('login.failed'));
    }
  });
  return (
    <AuthShell title={t('login.title')} subtitle={t('login.subtitle')}>
      <form className="grid gap-5" onSubmit={submit} noValidate>
        <Field
          label={t('login.identifier')}
          htmlFor="identifier"
          error={form.formState.errors.identifier?.message}
        >
          <Input
            id="identifier"
            autoComplete="username"
            aria-invalid={!!form.formState.errors.identifier}
            {...form.register('identifier')}
          />
        </Field>
        <Field error={form.formState.errors.password?.message}>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('login.password')}</Label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
            >
              {t('login.forgot')}
            </Link>
          </div>
          <div className="relative">
            <Input
              className="pr-12"
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-0 top-0 grid h-full min-w-11 place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label={show ? t('login.hidePassword') : t('login.showPassword')}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {serverError && <Alert variant="destructive">{serverError}</Alert>}
        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          {t('login.submit')}
        </Button>
        <p className="m-0 text-center text-sm text-[var(--muted-foreground)]">
          {t('login.noAccount')}{' '}
          <Link
            to="/register"
            className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
          >
            {t('login.register')}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
