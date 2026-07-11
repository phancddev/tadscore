import { CheckCircle2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

export function VerifyPage() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token');
  const mode = params.get('mode') || (token ? 'link' : 'otp');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(300);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    token ? 'loading' : 'idle',
  );
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!token) return;
    api.auth
      .verify({ token })
      .then(() => setState('success'))
      .catch((error: Error) => {
        setMessage(error.message);
        setState('error');
      });
  }, [token]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);
  const verify = async () => {
    setState('loading');
    try {
      await api.auth.verify({ email, code });
      setState('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('verify.invalid'));
      setState('error');
    }
  };
  const resend = async () => {
    try {
      await api.auth.resend(email);
      setCountdown(300);
      setMessage(t('verify.resent'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('verify.resendFailed'));
    }
  };
  if (state === 'success')
    return (
      <AuthShell title={t('verify.verifiedTitle')} subtitle={t('verify.verifiedSubtitle')}>
        <div className="grid place-items-center gap-5 text-center">
          <CheckCircle2 className="h-12 w-12 text-[var(--success)]" />
          <Link
            to="/login"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)]"
          >
            {t('verify.login')}
          </Link>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell
      title={mode === 'link' ? t('verify.linkTitle') : t('verify.otpTitle')}
      subtitle={mode === 'link' ? t('verify.linkHint') : t('verify.otpHint', { email })}
    >
      {mode === 'otp' ? (
        <div className="grid gap-5">
          <Field label={t('verify.codeLabel')} htmlFor="otp">
            <Input
              id="otp"
              className="text-center text-2xl tracking-[.35em] tabular"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Button onClick={verify} loading={state === 'loading'} disabled={code.length !== 6}>
            <Mail className="h-4 w-4" />
            {t('verify.submit')}
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-5 text-sm text-[var(--muted-foreground)]">
            {t('verify.linkNote')}
          </CardContent>
        </Card>
      )}
      {!token && (
        <Button className="mt-3 w-full" variant="ghost" onClick={resend} disabled={countdown > 0}>
          {t('verify.resend')}{' '}
          {countdown > 0 &&
            `(${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')})`}
        </Button>
      )}
      {message && (
        <Alert
          className="mt-4"
          variant={state === 'error' ? 'destructive' : 'default'}
          role={state === 'error' ? 'alert' : 'status'}
        >
          {message}
        </Alert>
      )}
    </AuthShell>
  );
}
