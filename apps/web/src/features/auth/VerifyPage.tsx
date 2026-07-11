import { CheckCircle2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

export function VerifyPage() {
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
      setMessage(error instanceof Error ? error.message : 'Mã không hợp lệ');
      setState('error');
    }
  };
  const resend = async () => {
    try {
      await api.auth.resend(email);
      setCountdown(300);
      setMessage('Đã gửi lại hướng dẫn xác minh.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chưa thể gửi lại');
    }
  };
  if (state === 'success')
    return (
      <AuthShell title="Email đã xác minh" subtitle="Tài khoản của bạn đã sẵn sàng.">
        <div className="grid place-items-center gap-5 text-center">
          <CheckCircle2 className="h-14 w-14 text-[var(--success)]" />
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-5 font-bold text-white"
          >
            Đăng nhập
          </Link>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell
      title={mode === 'link' ? 'Xác minh qua liên kết' : 'Nhập mã xác minh'}
      subtitle={
        mode === 'link'
          ? 'Mở liên kết trong email. Bạn có thể gửi lại nếu chưa nhận được.'
          : `Mã 6 chữ số đã gửi tới ${email}.`
      }
    >
      {mode === 'otp' ? (
        <div className="grid gap-5">
          <div className="field">
            <label htmlFor="otp">Mã xác minh</label>
            <input
              id="otp"
              className="input text-center text-2xl tracking-[.35em] tabular"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Button onClick={verify} loading={state === 'loading'} disabled={code.length !== 6}>
            <Mail className="h-4 w-4" />
            Xác minh
          </Button>
        </div>
      ) : (
        <div className="app-card p-4 text-sm muted">
          Liên kết xác minh có thời hạn và chỉ dùng được một lần.
        </div>
      )}
      {!token && (
        <Button className="mt-3 w-full" variant="ghost" onClick={resend} disabled={countdown > 0}>
          Gửi lại{' '}
          {countdown > 0 &&
            `(${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')})`}
        </Button>
      )}
      {message && (
        <p
          role="status"
          className={`mt-4 rounded-xl p-3 text-sm ${state === 'error' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--primary-soft)]'}`}
        >
          {message}
        </p>
      )}
    </AuthShell>
  );
}
