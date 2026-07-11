import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
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
        <Card>
          <CardContent className="grid gap-4 pt-5">
            <p className="m-0 text-sm">
              Kiểm tra email để lấy mã hoặc mở liên kết đặt lại mật khẩu.
            </p>
            <Link
              className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
              to={`/reset-password?email=${encodeURIComponent(email)}`}
            >
              Nhập mã đặt lại
            </Link>
            <Link className="text-sm font-medium underline-offset-4 hover:underline" to="/login">
              Về đăng nhập
            </Link>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          <Field label="Email" htmlFor="email">
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
        <Card>
          <CardContent className="grid gap-4 pt-5">
            <p className="m-0 text-sm">
              Mật khẩu đã được thay đổi. Tất cả phiên cũ đã bị đăng xuất.
            </p>
            <Link to="/login" className="text-sm font-medium underline-offset-4 hover:underline">
              Đăng nhập
            </Link>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          {!token && (
            <>
              <Field label="Email" htmlFor="reset-email">
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Mã 6 chữ số" htmlFor="reset-code">
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
          <Field label="Mật khẩu mới" htmlFor="new-password">
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
          <Button loading={loading}>Đổi mật khẩu</Button>
        </form>
      )}
    </AuthShell>
  );
}
