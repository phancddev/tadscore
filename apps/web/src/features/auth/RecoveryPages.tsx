import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

export function ForgotPage() {
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
      setError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title="Quên mật khẩu" subtitle="Hướng dẫn sẽ được gửi nếu email tồn tại.">
      {sent ? (
        <div className="app-card grid gap-4 p-5">
          <p className="m-0">Kiểm tra email để lấy mã hoặc mở liên kết đặt lại mật khẩu.</p>
          <Link
            className="inline-flex min-h-11 items-center font-bold text-[var(--primary)]"
            to={`/reset-password?email=${encodeURIComponent(email)}`}
          >
            Nhập mã đặt lại
          </Link>
          <Link className="font-bold text-[var(--primary)]" to="/login">
            Về đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              required
              type="email"
              id="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <Button loading={loading}>Gửi hướng dẫn</Button>
        </form>
      )}
    </AuthShell>
  );
}
export function ResetPage() {
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
      setError(cause instanceof Error ? cause.message : 'Không thể đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title="Đặt mật khẩu mới" subtitle="Mật khẩu phải có ít nhất 10 ký tự.">
      {done ? (
        <div className="app-card p-5">
          <p>Mật khẩu đã được thay đổi. Tất cả phiên cũ đã bị đăng xuất.</p>
          <Link to="/login" className="font-bold text-[var(--primary)]">
            Đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          {!token && (
            <>
              <div className="field">
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="reset-code">Mã 6 chữ số</label>
                <input
                  id="reset-code"
                  className="input text-center tracking-[.3em]"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="new-password">Mật khẩu mới</label>
            <input
              minLength={10}
              required
              type="password"
              autoComplete="new-password"
              id="new-password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <Button loading={loading}>Đổi mật khẩu</Button>
        </form>
      )}
    </AuthShell>
  );
}
