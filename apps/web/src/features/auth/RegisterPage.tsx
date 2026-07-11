import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { AuthShell } from './AuthShell';

const schema = z
  .object({
    fullName: z.string().min(2, 'Nhập họ tên'),
    email: z.email('Email không hợp lệ'),
    username: z
      .string()
      .min(3, 'Tối thiểu 3 ký tự')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Chỉ dùng chữ, số, dấu chấm, gạch'),
    password: z.string().min(10, 'Tối thiểu 10 ký tự'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu chưa khớp' });
type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
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
        message: error instanceof Error ? error.message : 'Không thể đăng ký',
      });
    }
  });
  const field = (name: keyof FormData, label: string, type = 'text', autoComplete?: string) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        className="input"
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!form.formState.errors[name]}
        {...form.register(name)}
      />
      {form.formState.errors[name] && (
        <span role="alert" className="field-error">
          {form.formState.errors[name]?.message}
        </span>
      )}
    </div>
  );
  return (
    <AuthShell title="Tạo tài khoản" subtitle="Bắt đầu một không gian chấm điểm mới.">
      <form className="grid gap-4" onSubmit={submit} noValidate>
        {field('fullName', 'Họ và tên', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('username', 'Username', 'text', 'username')}
        {field('password', 'Mật khẩu', 'password', 'new-password')}
        {field('confirm', 'Nhập lại mật khẩu', 'password', 'new-password')}
        {form.formState.errors.root && (
          <p role="alert" className="field-error">
            {form.formState.errors.root.message}
          </p>
        )}
        <Button type="submit" loading={form.formState.isSubmitting}>
          Tạo tài khoản
        </Button>
        <p className="text-center text-sm muted">
          Đã có tài khoản?{' '}
          <Link className="font-bold text-[var(--primary)]" to="/login">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
