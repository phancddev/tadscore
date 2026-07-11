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
export type ShopItem = {
  medalCost: number;
  medalDelta: number;
  pieceDelta: number;
  itemDelta: number;
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
  shop?: {
    piece?: ShopItem;
    item?: ShopItem;
  };
  ranking?: {
    minimumPieces: number;
  };
  constraints?: {
    purchasePieceLimitBeforeActivity?: {
      activityKey: string;
      max: number;
    };
  };
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
  /** Completed shop purchases of item_key=piece (for pre-activity limit). */
  shopPiecesBought?: number;
};
export type ManagedTeam = {
  id: string;
  code: string;
  name: string;
  displayName: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive: boolean;
  medals?: number;
  pieces?: number;
  items?: number;
};
export type TeamWin = {
  entryId: string;
  activityName?: string | null;
  medals: number;
  pieces: number;
  createdAt: string;
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
  avatarUrl?: string | null;
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
  token?: string | null;
  slug?: string | null;
  label?: string | null;
  isEnabled: boolean;
  tokenEnabled: boolean;
  slugEnabled: boolean;
  expiresAt?: string | null;
  createdAt?: string;
  lastAccessedAt?: string | null;
  url?: string | null;
  slugUrl?: string | null;
};
export type LedgerEntry = {
  id: string;
  teamId?: string;
  teamName?: string;
  entryType: string;
  medalDelta: number;
  pieceDelta: number;
  itemDelta: number;
  metadata?: Record<string, unknown> | null;
  activityName?: string | null;
  activityRank?: number | null;
  adjustmentKind?: string | null;
  note?: string | null;
  createdAt: string;
  createdByName?: string;
  reversesEntryId?: string | null;
  reversed?: boolean;
  reversedAt?: string | null;
};
export type RankingShop = {
  piece?: ShopItem;
  item?: ShopItem;
  minimumPieces: number;
  pieceLimit?: {
    activityKey: string;
    max: number;
    /** True while the gate activity is not finalized (backend still enforces max). */
    active: boolean;
  };
};
export type Ranking = {
  workspace: { id: string; name: string };
  rule: { id: string; version: string; minimumPieces: number };
  /** Economy config from workspace rule_snapshot (not live rule registry). */
  shop?: RankingShop;
  teams: Team[];
};
export type TeamDetail = Team & {
  ledger: LedgerEntry[];
  wins?: TeamWin[];
  winCount?: number;
  totalMedalGain?: number;
  totalMedalLoss?: number;
  adjustmentCount?: number;
};
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
