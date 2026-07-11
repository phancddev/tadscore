import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

type FormData = {
  fullName: string;
  email: string;
  username: string;
  password: string;
  confirm: string;
};

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const schema = useMemo(
    () =>
      z
        .object({
          fullName: z.string().min(2, t('register.fullNameMin')),
          email: z.email(t('register.emailInvalid')),
          username: z
            .string()
            .min(3, t('register.usernameMin'))
            .regex(/^[a-zA-Z0-9_.-]+$/, t('register.usernamePattern')),
          password: z.string().min(10, t('register.passwordMin')),
          confirm: z.string(),
        })
        .refine((v) => v.password === v.confirm, {
          path: ['confirm'],
          message: t('register.passwordMismatch'),
        }),
    [t],
  );
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', username: '', password: '', confirm: '' },
  });
  const submit = form.handleSubmit(async ({ confirm: _, ...values }) => {
    try {
      const result = await api.auth.register(values);
      if (result.verificationRequired)
        navigate(
          `/verify?email=${encodeURIComponent(values.email)}&mode=${result.verificationMode}`,
        );
      else navigate('/login', { state: { registered: true } });
    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : t('register.failed'),
      });
    }
  });
  const field = (name: keyof FormData, label: string, type = 'text', autoComplete?: string) => (
    <Field label={label} htmlFor={name} error={form.formState.errors[name]?.message}>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!form.formState.errors[name]}
        {...form.register(name)}
      />
    </Field>
  );
  return (
    <AuthShell title={t('register.title')} subtitle={t('register.subtitle')}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        {field('fullName', t('register.fullName'), 'text', 'name')}
        {field('email', t('register.email'), 'email', 'email')}
        {field('username', t('register.username'), 'text', 'username')}
        {field('password', t('register.password'), 'password', 'new-password')}
        {field('confirm', t('register.confirm'), 'password', 'new-password')}
        {form.formState.errors.root && (
          <Alert variant="destructive">{form.formState.errors.root.message}</Alert>
        )}
        <Button type="submit" loading={form.formState.isSubmitting}>
          {t('register.submit')}
        </Button>
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          {t('register.hasAccount')}{' '}
          <Link
            className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
            to="/login"
          >
            {t('register.login')}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
