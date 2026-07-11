-- migrate:up
CREATE TYPE invitation_kind AS ENUM ('email', 'share_link');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind invitation_kind NOT NULL,
  email citext,
  role workspace_role NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  use_count integer NOT NULL DEFAULT 0,
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT workspace_invitations_email_kind CHECK (
    (kind = 'email' AND email IS NOT NULL) OR kind = 'share_link'
  ),
  CONSTRAINT workspace_invitations_role_safe CHECK (role <> 'owner'),
  CONSTRAINT workspace_invitations_usage_valid CHECK (
    max_uses > 0 AND use_count >= 0 AND use_count <= max_uses
  )
);

CREATE INDEX workspace_invitations_workspace_idx
  ON workspace_invitations(workspace_id, status, expires_at);
CREATE INDEX workspace_invitations_email_idx
  ON workspace_invitations(email) WHERE email IS NOT NULL;

CREATE TABLE invitation_acceptances (
  invitation_id uuid NOT NULL REFERENCES workspace_invitations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (invitation_id, user_id)
);

CREATE TABLE public_ranking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  slug citext UNIQUE,
  label varchar(100),
  is_enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT public_ranking_links_slug_format CHECK (
    slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'
  )
);

CREATE INDEX public_ranking_links_workspace_idx
  ON public_ranking_links(workspace_id, is_enabled);

-- migrate:down
DROP TABLE public_ranking_links;
DROP TABLE invitation_acceptances;
DROP TABLE workspace_invitations;
DROP TYPE invitation_status;
DROP TYPE invitation_kind;
