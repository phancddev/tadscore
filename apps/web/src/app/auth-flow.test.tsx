import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { AppRouter } from './AppRouter';

const activeUser = {
  id: 'u1',
  email: 'a@example.test',
  username: 'alice',
  full_name: 'Alice',
  global_role: 'user',
  status: 'active',
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function renderApp(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('auth flow', () => {
  it('returns to the protected route after a successful login', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me'))
        return jsonResponse(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        );
      if (url.endsWith('/api/auth/login')) return jsonResponse({ data: { user: activeUser } });
      if (url.endsWith('/api/workspaces')) return jsonResponse({ data: [] });
      if (url.endsWith('/api/rules')) return jsonResponse({ data: [] });
      return jsonResponse({ error: { message: 'Unhandled request' } }, 500);
    });

    renderApp('/profile');

    await screen.findByRole('heading', { name: 'Chào mừng trở lại' });
    await user.type(screen.getByLabelText('Email hoặc username'), 'a@example.test');
    await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), 'TestPass123!');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await screen.findByRole('heading', { name: 'Hồ sơ cá nhân' });
    expect(await screen.findByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('clears local session and redirects when logout is already expired server-side', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return jsonResponse({ data: { user: activeUser } });
      if (url.endsWith('/api/workspaces')) return jsonResponse({ data: [] });
      if (url.endsWith('/api/rules')) return jsonResponse({ data: [] });
      if (url.endsWith('/api/auth/logout'))
        return jsonResponse(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        );
      return jsonResponse({ error: { message: 'Unhandled request' } }, 500);
    });

    renderApp('/workspaces');

    await screen.findByRole('heading', { name: 'Không gian làm việc' });
    await user.click(screen.getAllByRole('button', { name: 'Đăng xuất' })[0]!);

    await screen.findByRole('heading', { name: 'Chào mừng trở lại' });
    await waitFor(() => expect(screen.queryByText('Alice')).not.toBeInTheDocument());
  });
});
