-- migrate:up
-- Variable team management: soft-deleted teams free code/name for reuse.
-- Scoring history stays attached via FK; inactive teams are excluded from ranking/games entry.

ALTER TABLE teams DROP CONSTRAINT teams_workspace_id_code_key;
ALTER TABLE teams DROP CONSTRAINT teams_workspace_id_name_key;

CREATE UNIQUE INDEX teams_workspace_active_code_uidx
  ON teams (workspace_id, code)
  WHERE is_active;

CREATE UNIQUE INDEX teams_workspace_active_name_uidx
  ON teams (workspace_id, name)
  WHERE is_active;

CREATE INDEX teams_workspace_active_sort_idx
  ON teams (workspace_id, is_active, sort_order, name);

-- migrate:down
DROP INDEX teams_workspace_active_sort_idx;
DROP INDEX teams_workspace_active_name_uidx;
DROP INDEX teams_workspace_active_code_uidx;

ALTER TABLE teams
  ADD CONSTRAINT teams_workspace_id_code_key UNIQUE (workspace_id, code);
ALTER TABLE teams
  ADD CONSTRAINT teams_workspace_id_name_key UNIQUE (workspace_id, name);
