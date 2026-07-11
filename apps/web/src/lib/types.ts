export type GlobalRole = 'super_admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'suspended';
export type WorkspaceRole = 'owner' | 'admin' | 'scorer' | 'viewer';
export type WorkspaceStatus = 'active' | 'locked' | 'suspended' | 'archived';

export type User = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  globalRole: GlobalRole;
  status: UserStatus;
  emailVerifiedAt?: string | null;
  pendingEmail?: string | null;
};
export type Rule = {
  id: string;
  version: string;
  name: string;
  teamCount?: number;
  hash?: string;
  minimumPieces?: number;
  healthy?: boolean;
  ok?: boolean;
  error?: string;
};
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: WorkspaceStatus;
  role: WorkspaceRole;
  ruleId: string;
  ruleVersion: string;
  createdAt?: string;
  memberCount?: number;
  ownerEmail?: string;
};
export type Team = {
  id: string;
  teamId: string;
  code?: string;
  name: string;
  displayName: string;
  color?: string | null;
  icon?: string | null;
  medals: number;
  pieces: number;
  items: number;
  eligible: boolean;
  rank: number;
};
export type Activity = {
  id: string;
  activityKey: string;
  name: string;
  activityType: string;
  sequenceNo: number;
  status: 'draft' | 'open' | 'locked' | 'finalized';
  phase?: string;
};
export type Member = {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  role: WorkspaceRole;
  status: 'active' | 'removed';
  joinedAt?: string;
};
export type Invitation = {
  id: string;
  kind: 'email' | 'share_link';
  email?: string | null;
  role: Exclude<WorkspaceRole, 'owner'>;
  expiresAt: string;
  maxUses: number;
  useCount?: number;
  status: string;
  token?: string;
  inviteUrl?: string;
};
export type PublicLink = {
  id: string;
  slug?: string | null;
  label?: string | null;
  isEnabled: boolean;
  expiresAt?: string | null;
  createdAt?: string;
  lastAccessedAt?: string | null;
  token?: string;
  url?: string;
};
export type LedgerEntry = {
  id: string;
  teamId: string;
  teamName: string;
  entryType: string;
  medalDelta: number;
  pieceDelta: number;
  itemDelta: number;
  metadata?: Record<string, unknown>;
  activityName?: string | null;
  createdAt: string;
  createdByName: string;
  reversesEntryId?: string | null;
  reversed?: boolean;
  reversedAt?: string | null;
};
export type Ranking = {
  workspace: { id: string; name: string };
  rule: { id: string; version: string; minimumPieces: number };
  teams: Team[];
};
export type TeamDetail = Team & { ledger: LedgerEntry[] };
export type AuthConfig = {
  emailVerificationMode: 'off' | 'otp' | 'link';
  otpResendCooldownSeconds?: number;
  registrationEnabled?: boolean;
};
export type Health = {
  status: string;
  database: boolean;
  time: string;
  failedEmails: number;
  rulesHealthy: boolean;
  emailVerificationMode: string;
};
export type AuditLog = {
  id: string;
  action: string;
  actorUserId?: string;
  entityType: string;
  entityId?: string;
  workspaceId?: string;
  createdAt: string;
};
export type OutboxItem = {
  id: string;
  toEmail: string;
  template: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  lastError?: string;
};
