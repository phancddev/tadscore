-- migrate:up
CREATE TYPE activity_status AS ENUM ('draft', 'open', 'locked', 'finalized');
CREATE TYPE ledger_entry_type AS ENUM (
  'activity_award', 'participation', 'penalty', 'purchase', 'adjustment', 'reversal'
);
CREATE TYPE purchase_status AS ENUM ('completed', 'reversed');

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  activity_key varchar(100) NOT NULL,
  name varchar(160) NOT NULL,
  activity_type varchar(80) NOT NULL,
  sequence_no integer NOT NULL,
  rule_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status activity_status NOT NULL DEFAULT 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, activity_key),
  UNIQUE (workspace_id, sequence_no),
  UNIQUE (id, workspace_id),
  CONSTRAINT activities_sequence_positive CHECK (sequence_no > 0),
  CONSTRAINT activities_rule_config_object CHECK (jsonb_typeof(rule_config) = 'object')
);

CREATE INDEX activities_workspace_status_idx ON activities(workspace_id, status);

CREATE TABLE result_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL,
  idempotency_key varchar(120) NOT NULL,
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key),
  UNIQUE (id, workspace_id),
  FOREIGN KEY (activity_id, workspace_id)
    REFERENCES activities(id, workspace_id) ON DELETE RESTRICT
);

CREATE TABLE activity_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  team_id uuid NOT NULL,
  rank smallint,
  value numeric(14, 2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, team_id),
  UNIQUE (submission_id, rank),
  FOREIGN KEY (submission_id, workspace_id)
    REFERENCES result_submissions(id, workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id, workspace_id)
    REFERENCES teams(id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT activity_results_rank_positive CHECK (rank IS NULL OR rank > 0),
  CONSTRAINT activity_results_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE score_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  activity_id uuid,
  submission_id uuid,
  entry_type ledger_entry_type NOT NULL,
  medal_delta integer NOT NULL DEFAULT 0,
  piece_delta integer NOT NULL DEFAULT 0,
  item_delta integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key varchar(120),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reverses_entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT score_ledger_nonzero CHECK (
    medal_delta <> 0 OR piece_delta <> 0 OR item_delta <> 0
  ),
  CONSTRAINT score_ledger_reversal_shape CHECK (
    (entry_type = 'reversal' AND reverses_entry_id IS NOT NULL)
    OR (entry_type <> 'reversal' AND reverses_entry_id IS NULL)
  ),
  CONSTRAINT score_ledger_not_self_reversal CHECK (id <> reverses_entry_id),
  CONSTRAINT score_ledger_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE (workspace_id, idempotency_key),
  UNIQUE (id, workspace_id),
  FOREIGN KEY (team_id, workspace_id)
    REFERENCES teams(id, workspace_id) ON DELETE RESTRICT,
  FOREIGN KEY (activity_id, workspace_id)
    REFERENCES activities(id, workspace_id) ON DELETE RESTRICT,
  FOREIGN KEY (submission_id, workspace_id)
    REFERENCES result_submissions(id, workspace_id) ON DELETE RESTRICT,
  FOREIGN KEY (reverses_entry_id, workspace_id)
    REFERENCES score_ledger(id, workspace_id) ON DELETE RESTRICT
);

CREATE INDEX score_ledger_workspace_team_idx ON score_ledger(workspace_id, team_id, created_at);
CREATE INDEX score_ledger_activity_id_idx ON score_ledger(activity_id);
CREATE INDEX score_ledger_submission_id_idx ON score_ledger(submission_id);

CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  item_key varchar(100) NOT NULL,
  quantity integer NOT NULL,
  medal_cost integer NOT NULL,
  status purchase_status NOT NULL DEFAULT 'completed',
  ledger_entry_id uuid NOT NULL UNIQUE,
  purchased_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  CONSTRAINT purchases_quantity_positive CHECK (quantity > 0),
  CONSTRAINT purchases_cost_nonnegative CHECK (medal_cost >= 0),
  FOREIGN KEY (team_id, workspace_id)
    REFERENCES teams(id, workspace_id) ON DELETE RESTRICT,
  FOREIGN KEY (ledger_entry_id, workspace_id)
    REFERENCES score_ledger(id, workspace_id) ON DELETE RESTRICT
);

CREATE TABLE team_inventory (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  item_key varchar(100) NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, team_id, item_key),
  CONSTRAINT team_inventory_quantity_nonnegative CHECK (quantity >= 0),
  FOREIGN KEY (team_id, workspace_id)
    REFERENCES teams(id, workspace_id) ON DELETE CASCADE
);

-- migrate:down
DROP TABLE team_inventory;
DROP TABLE purchases;
DROP TABLE score_ledger;
DROP TABLE activity_results;
DROP TABLE result_submissions;
DROP TABLE activities;
DROP TYPE purchase_status;
DROP TYPE ledger_entry_type;
DROP TYPE activity_status;
