import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

const schema = z.object({
  identifier: z.string().min(3, 'Nhập email hoặc username'),
  password: z.string().min(8, 'Mật khẩu có ít nhất 8 ký tự'),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState('');
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    setServerError('');
    try {
      await api.auth.login(values);
      await refresh();
      navigate((location.state as { from?: string })?.from || '/workspaces');
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Không thể đăng nhập');
    }
  });
  return (
    <AuthShell title="Chào mừng trở lại" subtitle="Đăng nhập để tiếp tục điều hành sự kiện.">
      <form className="grid gap-5" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="identifier">Email hoặc username</label>
          <input
            className="input"
            id="identifier"
            autoComplete="username"
            aria-invalid={!!form.formState.errors.identifier}
            {...form.register('identifier')}
          />
          {form.formState.errors.identifier && (
            <span role="alert" className="field-error">
              {form.formState.errors.identifier.message}
            </span>
          )}
        </div>
        <div className="field">
          <div className="flex items-center justify-between">
            <label htmlFor="password">Mật khẩu</label>
            <Link to="/forgot-password" className="text-sm font-semibold text-[var(--primary)]">
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <input
              className="input pr-12"
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-0 top-0 grid h-full min-w-11 place-items-center"
              aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <span role="alert" className="field-error">
              {form.formState.errors.password.message}
            </span>
          )}
        </div>
        {serverError && (
          <p
            role="alert"
            className="m-0 rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
          >
            {serverError}
          </p>
        )}
        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          Đăng nhập
        </Button>
        <p className="m-0 text-center text-sm muted">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-bold text-[var(--primary)]">
            Đăng ký
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
