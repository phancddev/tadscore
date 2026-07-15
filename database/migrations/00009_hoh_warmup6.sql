-- migrate:up
-- HOH2026 in-place rule edit (no version bump): add warmup-6 for existing workspaces
-- that still lack the activity. Keeps score_ledger history; only extends the schedule.
--
-- For each workspaces.rule_id = 'hoh-2026' without activities.activity_key = 'warmup-6':
--   1) shift sequence_no >= 6 up by 1 (midterms / big games)
--   2) insert warmup-6 at sequence 6
--   3) rebuild rule_snapshot.activities from activities.rule_config and refresh hash

DO $$
DECLARE
  warmup6 jsonb := '{
    "key": "warmup-6",
    "name": "Warm-up 6",
    "type": "ranked_game",
    "sequence": 6,
    "medalAwards": [14, 7, 4, 2],
    "pieceAwards": [0, 0, 0, 0],
    "phase": "before-bg2"
  }'::jsonb;
  rec record;
  new_activities jsonb;
  new_snapshot jsonb;
BEGIN
  FOR rec IN
    SELECT
      w.id,
      w.owner_user_id,
      w.rule_snapshot,
      COALESCE((SELECT max(a.sequence_no) FROM activities a WHERE a.workspace_id = w.id), 0) + 1000 AS sequence_offset
    FROM workspaces w
    WHERE w.rule_id = 'hoh-2026'
      AND NOT EXISTS (
        SELECT 1
        FROM activities a
        WHERE a.workspace_id = w.id
          AND a.activity_key = 'warmup-6'
      )
  LOOP
    -- Avoid UNIQUE (workspace_id, sequence_no) collisions while keeping sequence_no positive.
    UPDATE activities
    SET sequence_no = sequence_no + rec.sequence_offset
    WHERE workspace_id = rec.id
      AND sequence_no >= 6;

    UPDATE activities
    SET
      sequence_no = sequence_no - rec.sequence_offset + 1,
      rule_config = CASE
        WHEN jsonb_typeof(rule_config) = 'object' AND rule_config ? 'sequence'
          THEN jsonb_set(rule_config, '{sequence}', to_jsonb(sequence_no - rec.sequence_offset + 1))
        ELSE rule_config
      END
    WHERE workspace_id = rec.id
      AND sequence_no > rec.sequence_offset;

    INSERT INTO activities (
      workspace_id,
      activity_key,
      name,
      activity_type,
      sequence_no,
      rule_config,
      status,
      created_by
    )
    VALUES (
      rec.id,
      'warmup-6',
      'Warm-up 6',
      'ranked_game',
      6,
      warmup6,
      'open',
      rec.owner_user_id
    );

    -- Prefer DB activity rows as source of truth after the structural change.
    SELECT COALESCE(jsonb_agg(a.rule_config ORDER BY a.sequence_no), '[]'::jsonb)
    INTO new_activities
    FROM activities a
    WHERE a.workspace_id = rec.id;

    new_snapshot := jsonb_set(rec.rule_snapshot, '{activities}', new_activities);

    UPDATE workspaces
    SET
      rule_snapshot = new_snapshot,
      rule_snapshot_hash = encode(digest(new_snapshot::text, 'sha256'), 'hex')
    WHERE id = rec.id;
  END LOOP;
END $$;

-- migrate:down
-- Reverse warmup-6 insert for HOH workspaces. Fails if warmup-6 already has
-- submissions / ledger rows (FK RESTRICT) — intentional.

DO $$
DECLARE
  rec record;
  new_activities jsonb;
  new_snapshot jsonb;
BEGIN
  FOR rec IN
    SELECT
      w.id,
      w.rule_snapshot,
      COALESCE((SELECT max(a.sequence_no) FROM activities a WHERE a.workspace_id = w.id), 0) + 1000 AS sequence_offset
    FROM workspaces w
    WHERE w.rule_id = 'hoh-2026'
      AND EXISTS (
        SELECT 1
        FROM activities a
        WHERE a.workspace_id = w.id
          AND a.activity_key = 'warmup-6'
      )
  LOOP
    DELETE FROM activities
    WHERE workspace_id = rec.id
      AND activity_key = 'warmup-6';

    UPDATE activities
    SET sequence_no = sequence_no + rec.sequence_offset
    WHERE workspace_id = rec.id
      AND sequence_no >= 7;

    UPDATE activities
    SET
      sequence_no = sequence_no - rec.sequence_offset - 1,
      rule_config = CASE
        WHEN jsonb_typeof(rule_config) = 'object' AND rule_config ? 'sequence'
          THEN jsonb_set(rule_config, '{sequence}', to_jsonb(sequence_no - rec.sequence_offset - 1))
        ELSE rule_config
      END
    WHERE workspace_id = rec.id
      AND sequence_no > rec.sequence_offset;

    SELECT COALESCE(jsonb_agg(a.rule_config ORDER BY a.sequence_no), '[]'::jsonb)
    INTO new_activities
    FROM activities a
    WHERE a.workspace_id = rec.id;

    new_snapshot := jsonb_set(rec.rule_snapshot, '{activities}', new_activities);

    UPDATE workspaces
    SET
      rule_snapshot = new_snapshot,
      rule_snapshot_hash = encode(digest(new_snapshot::text, 'sha256'), 'hex')
    WHERE id = rec.id;
  END LOOP;
END $$;
