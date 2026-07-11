-- migrate:up
CREATE TYPE workspace_status AS ENUM ('active', 'locked', 'suspended', 'archived');
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'scorer', 'viewer');
CREATE TYPE member_status AS ENUM ('active', 'removed');

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  slug citext NOT NULL UNIQUE,
  description text,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rule_id varchar(100) NOT NULL,
  rule_version varchar(40) NOT NULL,
  rule_snapshot jsonb NOT NULL,
  rule_snapshot_hash char(64) NOT NULL,
  status workspace_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT workspaces_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT workspaces_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  CONSTRAINT workspaces_rule_snapshot_object CHECK (jsonb_typeof(rule_snapshot) = 'object')
);

CREATE INDEX workspaces_owner_user_id_idx ON workspaces(owner_user_id);

CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role workspace_role NOT NULL,
  status member_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT workspace_members_removed_state CHECK (
    (status = 'active' AND removed_at IS NULL)
    OR (status = 'removed' AND removed_at IS NOT NULL)
  )
);

CREATE INDEX workspace_members_user_id_idx ON workspace_members(user_id);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  name varchar(100) NOT NULL,
  display_name varchar(120) NOT NULL,
  color varchar(20),
  icon varchar(100),
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code),
  UNIQUE (workspace_id, name),
  UNIQUE (id, workspace_id),
  CONSTRAINT teams_name_not_blank CHECK (btrim(name) <> '')
);

CREATE INDEX teams_workspace_id_idx ON teams(workspace_id);

-- migrate:down
DROP TABLE teams;
DROP TABLE workspace_members;
DROP TABLE workspaces;
DROP TYPE member_status;
DROP TYPE workspace_role;
DROP TYPE workspace_status;
