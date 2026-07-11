import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

export function ForgotPage() {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.auth.forgot(email);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('forgot.failed'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.subtitle')}>
      {sent ? (
        <Card>
          <CardContent className="grid gap-4 pt-5">
            <p className="m-0 text-sm">{t('forgot.sent')}</p>
            <Link
              className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
              to={`/reset-password?email=${encodeURIComponent(email)}`}
            >
              {t('forgot.enterCode')}
            </Link>
            <Link className="text-sm font-medium underline-offset-4 hover:underline" to="/login">
              {t('forgot.backLogin')}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          <Field label={t('forgot.email')} htmlFor="email">
            <Input
              required
              type="email"
              id="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button loading={loading}>{t('forgot.submit')}</Button>
        </form>
      )}
    </AuthShell>
  );
}
export function ResetPage() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.auth.reset(token ? { token, password } : { email, code, password });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('reset.failed'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title={t('reset.title')} subtitle={t('reset.subtitle')}>
      {done ? (
        <Card>
          <CardContent className="grid gap-4 pt-5">
            <p className="m-0 text-sm">{t('reset.success')}</p>
            <Link to="/login" className="text-sm font-medium underline-offset-4 hover:underline">
              {t('reset.login')}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          {!token && (
            <>
              <Field label={t('forgot.email')} htmlFor="reset-email">
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label={t('reset.code')} htmlFor="reset-code">
                <Input
                  id="reset-code"
                  className="text-center tracking-[.3em]"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
              </Field>
            </>
          )}
          <Field label={t('reset.newPassword')} htmlFor="new-password">
            <Input
              minLength={10}
              required
              type="password"
              autoComplete="new-password"
              id="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button loading={loading}>{t('reset.submit')}</Button>
        </form>
      )}
    </AuthShell>
  );
}
