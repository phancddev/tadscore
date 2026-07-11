-- migrate:up
CREATE TYPE outbox_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email citext NOT NULL,
  template varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  status outbox_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by varchar(160),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_outbox_attempts_valid CHECK (
    attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts
  ),
  CONSTRAINT email_outbox_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX email_outbox_delivery_idx
  ON email_outbox(status, next_attempt_at) WHERE status IN ('pending', 'failed');

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_id text,
  request_id varchar(100),
  ip_address inet,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_before_object CHECK (
    before_data IS NULL OR jsonb_typeof(before_data) = 'object'
  ),
  CONSTRAINT audit_logs_after_object CHECK (
    after_data IS NULL OR jsonb_typeof(after_data) = 'object'
  ),
  CONSTRAINT audit_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX audit_logs_workspace_created_idx ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX audit_logs_actor_created_idx ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER auth_rate_limits_set_updated_at BEFORE UPDATE ON auth_rate_limits
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workspace_members_set_updated_at BEFORE UPDATE ON workspace_members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER activities_set_updated_at BEFORE UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER team_inventory_set_updated_at BEFORE UPDATE ON team_inventory
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workspace_invitations_set_updated_at BEFORE UPDATE ON workspace_invitations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER email_outbox_set_updated_at BEFORE UPDATE ON email_outbox
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TRIGGER email_outbox_set_updated_at ON email_outbox;
DROP TRIGGER workspace_invitations_set_updated_at ON workspace_invitations;
DROP TRIGGER team_inventory_set_updated_at ON team_inventory;
DROP TRIGGER activities_set_updated_at ON activities;
DROP TRIGGER teams_set_updated_at ON teams;
DROP TRIGGER workspace_members_set_updated_at ON workspace_members;
DROP TRIGGER workspaces_set_updated_at ON workspaces;
DROP TRIGGER auth_rate_limits_set_updated_at ON auth_rate_limits;
DROP TRIGGER users_set_updated_at ON users;
DROP FUNCTION set_updated_at();
DROP TABLE audit_logs;
DROP TABLE email_outbox;
DROP TYPE outbox_status;
