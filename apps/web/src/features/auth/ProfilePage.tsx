import { useMutation } from '@tanstack/react-query';
import { Camera, KeyRound, MailCheck, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';

export function ProfilePage() {
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
      toast(
        result.emailVerificationPending ? 'Đã gửi xác minh tới email mới' : 'Đã cập nhật hồ sơ',
      );
    },
  });
  const verify = useMutation({
    mutationFn: () => api.auth.verifyProfileEmail({ email: pendingEmail, code }),
    onSuccess: () => {
      setPendingEmail('');
      setCode('');
      refresh();
      toast('Email mới đã được xác minh');
    },
  });
  const password = useMutation({
    mutationFn: () => api.auth.password({ currentPassword, newPassword, logoutOthers }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      toast('Đã đổi mật khẩu');
    },
  });
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) return toast('Ảnh phải nhỏ hơn 2 MB', 'error');
    try {
      await api.auth.avatar(file);
      await refresh();
      toast('Đã cập nhật ảnh đại diện');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Không thể tải ảnh', 'error');
    }
  };
  return (
    <div className="page-shell max-w-5xl">
      <header className="mb-7">
        <p className="eyebrow">Tài khoản</p>
        <h1 className="page-title mt-2">Hồ sơ cá nhân</h1>
      </header>
      <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
        <section className="app-card p-5">
          <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full bg-[var(--primary-soft)]">
            <span className="grid h-full place-items-center text-4xl font-black text-[var(--primary)]">
              {user?.fullName?.slice(0, 1)}
            </span>
            {user?.avatarUrl && (
              <img
                className="absolute inset-0 h-full w-full object-cover"
                src={user.avatarUrl}
                alt="Ảnh đại diện"
              />
            )}
          </div>
          <label className="mx-auto mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-4 font-semibold">
            <Camera className="h-4 w-4" />
            Đổi ảnh
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => upload(event.target.files?.[0])}
            />
          </label>
          <p className="mt-3 text-center text-xs muted">JPEG, PNG hoặc WebP · tối đa 2 MB</p>
        </section>
        <div className="grid gap-5">
          <form
            className="app-card grid gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <h2 className="section-title m-0">Thông tin hiển thị</h2>
            <Field id="full-name" label="Họ và tên" value={fullName} set={setFullName} />
            <Field id="username" label="Username" value={username} set={setUsername} />
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              set={setEmail}
              help="Email mới chỉ có hiệu lực sau khi xác minh."
            />
            {save.error && (
              <p role="alert" className="field-error">
                {save.error.message}
              </p>
            )}
            <Button loading={save.isPending} className="justify-self-start">
              <Save className="h-4 w-4" />
              Lưu thay đổi
            </Button>
          </form>
          {pendingEmail && (
            <form
              className="app-card grid gap-4 border-amber-300 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                verify.mutate();
              }}
            >
              <h2 className="section-title m-0">Xác minh {pendingEmail}</h2>
              <Field
                id="email-code"
                label="Mã 6 chữ số"
                value={code}
                set={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button
                loading={verify.isPending}
                disabled={code.length !== 6}
                className="justify-self-start"
              >
                <MailCheck className="h-4 w-4" />
                Xác minh email
              </Button>
            </form>
          )}
          <form
            className="app-card grid gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              password.mutate();
            }}
          >
            <h2 className="section-title m-0">Đổi mật khẩu</h2>
            <Field
              id="current-password"
              label="Mật khẩu hiện tại"
              type="password"
              value={currentPassword}
              set={setCurrentPassword}
            />
            <Field
              id="new-password"
              label="Mật khẩu mới"
              type="password"
              value={newPassword}
              set={setNewPassword}
              help="Ít nhất 10 ký tự."
            />
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={logoutOthers}
                onChange={(event) => setLogoutOthers(event.target.checked)}
              />
              Đăng xuất các phiên khác
            </label>
            <Button variant="secondary" loading={password.isPending} className="justify-self-start">
              <KeyRound className="h-4 w-4" />
              Đổi mật khẩu
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
function Field({
  id,
  label,
  value,
  set,
  type = 'text',
  help,
}: {
  id: string;
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  help?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        required
        minLength={type === 'password' ? 10 : undefined}
        type={type}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
      {help && <span className="text-xs muted">{help}</span>}
    </div>
  );
}
