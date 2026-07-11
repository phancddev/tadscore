import type { ReactNode } from 'react';
import { Brand } from '../../components/layout/Brand';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_.9fr]">
      <section className="hidden bg-[var(--sidebar)] p-10 text-white lg:flex lg:flex-col">
        <Brand inverse />
        <div className="my-auto max-w-xl">
          <p className="eyebrow !text-[var(--accent-soft)]">Quản lý sự kiện rõ ràng</p>
          <h1 className="mt-4 text-5xl font-extrabold leading-[1.06] tracking-[-.045em]">
            Mỗi điểm số đều có câu chuyện và dấu vết.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-white/70">
            Nhập điểm nhanh, theo dõi huy hiệu, mảnh ghép và chia sẻ bảng xếp hạng trực tiếp.
          </p>
        </div>
      </section>
      <section className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <p className="eyebrow">TadScore</p>
          <h1 className="page-title mt-2">{title}</h1>
          <p className="mt-3 muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
