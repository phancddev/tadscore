-- migrate:up
CREATE EXTENSION citext;
CREATE EXTENSION pgcrypto;

CREATE TYPE global_role AS ENUM ('super_admin', 'user');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE verification_purpose AS ENUM ('registration', 'email_change', 'password_reset');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  username citext NOT NULL UNIQUE,
  full_name varchar(160) NOT NULL,
  password_hash text NOT NULL,
  global_role global_role NOT NULL DEFAULT 'user',
  status user_status NOT NULL DEFAULT 'pending',
  avatar_path text,
  pending_email citext,
  email_verified_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$'),
  CONSTRAINT users_full_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);

CREATE TABLE email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  purpose verification_purpose NOT NULL,
  destination citext NOT NULL,
  code_hash text,
  token_hash char(64),
  attempt_count smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_verifications_secret_present CHECK (code_hash IS NOT NULL OR token_hash IS NOT NULL),
  CONSTRAINT email_verifications_attempts_valid CHECK (
    attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts
  )
);

CREATE UNIQUE INDEX email_verifications_token_hash_uidx
  ON email_verifications(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX email_verifications_lookup_idx
  ON email_verifications(destination, purpose, created_at DESC);

CREATE TABLE auth_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope varchar(80) NOT NULL,
  subject varchar(320) NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, subject),
  CONSTRAINT auth_rate_limits_hit_count_valid CHECK (hit_count >= 0)
);

-- migrate:down
DROP TABLE auth_rate_limits;
DROP TABLE email_verifications;
DROP TABLE auth_sessions;
DROP TABLE users;
DROP TYPE verification_purpose;
DROP TYPE user_status;
DROP TYPE global_role;
DROP EXTENSION pgcrypto;
DROP EXTENSION citext;
