import i18n from '../i18n';
import type {
  Activity,
  AuditLog,
  AuthConfig,
  Health,
  Invitation,
  LedgerEntry,
  ManagedTeam,
  Member,
  OutboxItem,
  PublicLink,
  Ranking,
  Rule,
  Team,
  TeamDetail,
  User,
  UserStatus,
  Workspace,
  WorkspaceStatus,
} from './types';
import { createIdempotencyKey } from './idempotency';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
const camel = (key: string) =>
  key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      camel(key),
      normalize(child),
    ]),
  );
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasJsonBody = init.body !== undefined && !(init.body instanceof FormData);
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers:
      init.body instanceof FormData
        ? init.headers
        : { ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const payload = normalize(await response.json().catch(() => ({}))) as {
    data?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  };
  if (!response.ok)
    throw new ApiError(
      response.status,
      payload.error?.message || i18n.t('states.requestFailed'),
      payload.error?.code,
      payload.error?.details,
    );
  return (payload.data ?? payload) as T;
}
const body = (value?: unknown) => (value === undefined ? undefined : JSON.stringify(value));
const post = <T>(path: string, value?: unknown) =>
  request<T>(path, { method: 'POST', body: body(value) });
const patch = <T>(path: string, value: unknown) =>
  request<T>(path, { method: 'PATCH', body: body(value) });
const del = (path: string) => request<void>(path, { method: 'DELETE' });
type List<T> = { items: T[]; total: number; limit?: number; offset?: number };

export const api = {
  auth: {
    config: () => request<AuthConfig>('/auth/config'),
    me: async () => (await request<{ user: User }>('/auth/me')).user,
    login: async (value: { identifier: string; password: string }) =>
      (await post<{ user: User }>('/auth/login', value)).user,
    register: (value: { email: string; username: string; fullName: string; password: string }) =>
      post<{ user: User; verificationRequired: boolean; verificationMode: string }>(
        '/auth/register',
        value,
      ),
    verify: (value: { email?: string; code?: string; token?: string }) =>
      post<{ verified: boolean }>('/auth/verify', value),
    resend: (email: string) => post<{ message: string }>('/auth/resend', { email }),
    forgot: (email: string) => post<{ message: string }>('/auth/forgot-password', { email }),
    reset: (value: { email?: string; code?: string; token?: string; password: string }) =>
      post<{ reset: boolean }>('/auth/reset-password', value),
    logout: () => post<{ loggedOut: boolean }>('/auth/logout'),
    updateProfile: async (value: { fullName?: string; username?: string; email?: string }) =>
      await patch<{ user: User; emailVerificationPending: boolean }>('/auth/profile', value),
    verifyProfileEmail: (value: { email?: string; code?: string; token?: string }) =>
      post<{ changed: boolean }>('/auth/profile/verify-email', value),
    password: (value: { currentPassword: string; newPassword: string; logoutOthers: boolean }) =>
      post<{ changed: boolean }>('/auth/password', value),
    avatar: async (file: File) => {
      const data = new FormData();
      data.append('file', file);
      return request<{ avatarUrl: string }>('/auth/avatar', { method: 'POST', body: data });
    },
  },
  rules: { list: () => request<Rule[]>('/rules') },
  workspaces: {
    list: () => request<Workspace[]>('/workspaces'),
    get: (id: string) => request<Workspace>(`/workspaces/${id}`),
    create: (value: {
      name: string;
      slug: string;
      description?: string;
      ruleId: string;
      ruleVersion: string;
    }) => post<Workspace>('/workspaces', value),
    update: (
      id: string,
      value: { name?: string; description?: string | null; status?: WorkspaceStatus },
    ) => patch<Workspace>(`/workspaces/${id}`, value),
    teams: (id: string) => request<ManagedTeam[]>(`/workspaces/${id}/teams`),
    createTeam: (
      id: string,
      value: {
        code: string;
        name: string;
        displayName: string;
        color?: string;
        icon?: string;
        sortOrder?: number;
      },
    ) => post<ManagedTeam>(`/workspaces/${id}/teams`, value),
    updateTeam: (
      id: string,
      teamId: string,
      value: {
        code?: string;
        name?: string;
        displayName?: string;
        color?: string | null;
        icon?: string | null;
        sortOrder?: number;
        isActive?: boolean;
      },
    ) => patch<ManagedTeam>(`/workspaces/${id}/teams/${teamId}`, value),
    deleteTeam: (id: string, teamId: string) =>
      request<{ id: string; deleted?: boolean; deactivated?: boolean } | void>(
        `/workspaces/${id}/teams/${teamId}`,
        { method: 'DELETE' },
      ),
    activities: (id: string) => request<Activity[]>(`/workspaces/${id}/activities`),
    members: (id: string) => request<Member[]>(`/workspaces/${id}/members`),
    invitations: (id: string) => request<Invitation[]>(`/workspaces/${id}/invitations`),
    invite: (
      id: string,
      value: {
        kind: 'email' | 'share_link';
        email?: string;
        role: string;
        expiresInHours: number;
        maxUses: number;
      },
    ) => post<Invitation>(`/workspaces/${id}/invitations`, value),
    revokeInvite: (id: string, inviteId: string) =>
      del(`/workspaces/${id}/invitations/${inviteId}`),
    updateMember: (id: string, userId: string, role: string) =>
      patch<Member>(`/workspaces/${id}/members/${userId}`, { role }),
    removeMember: (id: string, userId: string) => del(`/workspaces/${id}/members/${userId}`),
    join: (token: string) =>
      post<{ workspaceId: string; role: string }>(`/invitations/${token}/accept`),
    publicLinks: (id: string) => request<PublicLink[]>(`/workspaces/${id}/public-links`),
    createPublicLink: (
      id: string,
      value: {
        label?: string;
        slug?: string;
        expiresInHours?: number;
        isEnabled?: boolean;
        tokenEnabled?: boolean;
        slugEnabled?: boolean;
      },
    ) => post<PublicLink>(`/workspaces/${id}/public-links`, value),
    updatePublicLink: (
      id: string,
      linkId: string,
      value: {
        label?: string | null;
        slug?: string | null;
        isEnabled?: boolean;
        tokenEnabled?: boolean;
        slugEnabled?: boolean;
        expiresInHours?: number | null;
      },
    ) => patch<PublicLink>(`/workspaces/${id}/public-links/${linkId}`, value),
    revokePublicLink: (id: string, linkId: string) =>
      del(`/workspaces/${id}/public-links/${linkId}`),
    regeneratePublicLink: (id: string, linkId: string) =>
      post<PublicLink>(`/workspaces/${id}/public-links/${linkId}/regenerate`),
  },
  scoring: {
    ranking: (id: string) => request<Ranking>(`/workspaces/${id}/ranking`),
    teamDetail: (id: string, teamId: string) =>
      request<TeamDetail>(`/workspaces/${id}/ranking/${teamId}`),
    game: (
      id: string,
      value: {
        activityKey: string;
        results: { teamId: string; rank: number }[];
        idempotencyKey: string;
        notes?: string;
      },
    ) => post(`/workspaces/${id}/games`, value),
    gameResults: (id: string, activityKey: string) =>
      request<{
        activityKey: string;
        activityName: string;
        status: string;
        submissionId: string | null;
        results: { teamId: string; rank: number }[];
      }>(`/workspaces/${id}/activities/${encodeURIComponent(activityKey)}/results`),
    replaceGame: (
      id: string,
      value: {
        activityKey: string;
        results: { teamId: string; rank: number }[];
        idempotencyKey: string;
        reason: string;
        notes?: string;
      },
    ) => post(`/workspaces/${id}/games/replace`, value),
    adjust: (
      id: string,
      value: {
        teamId: string;
        kind: 'speech' | 'violation' | 'manual';
        medalDelta: number;
        reason: string;
        idempotencyKey: string;
      },
    ) => post<LedgerEntry>(`/workspaces/${id}/adjustments`, value),
    purchase: (
      id: string,
      value: {
        teamId: string;
        itemKey: 'piece' | 'item';
        quantity: number;
        idempotencyKey: string;
      },
    ) => post(`/workspaces/${id}/purchases`, value),
    ledger: async (id: string) =>
      (await request<List<LedgerEntry>>(`/workspaces/${id}/ledger`)).items,
    updateLedgerEntry: (
      id: string,
      entryId: string,
      value: { medalDelta: number; reason: string },
    ) => patch<LedgerEntry>(`/workspaces/${id}/ledger/${entryId}`, value),
    reverse: (id: string, entryId: string, reason = '') =>
      post<LedgerEntry>(`/workspaces/${id}/ledger/${entryId}/reverse`, {
        reason,
        idempotencyKey: createIdempotencyKey(),
      }),
  },
  public: {
    ranking: (token: string) => request<Ranking>(`/public/rankings/${token}`),
    team: (token: string, teamId: string) =>
      request<TeamDetail>(`/public/rankings/${token}/teams/${teamId}`),
  },
  admin: {
    users: async () => (await request<List<User>>('/admin/users')).items,
    setUser: (
      id: string,
      value: { status?: UserStatus; role?: User['globalRole']; markVerified?: boolean },
    ) => patch<User>(`/admin/users/${id}`, value),
    workspaces: async () => (await request<List<Workspace>>('/admin/workspaces')).items,
    setWorkspace: (id: string, status: 'active' | 'suspended') =>
      patch<Workspace>(`/admin/workspaces/${id}/status`, { status }),
    audit: async () => (await request<List<AuditLog>>('/admin/audit-logs')).items,
    rules: () => request<Rule[]>('/admin/rules'),
    health: () => request<Health>('/admin/health'),
    outbox: async () => (await request<List<OutboxItem>>('/admin/outbox')).items,
    retryOutbox: (id: string) => post(`/admin/outbox/${id}/retry`),
  },
};
