#!/usr/bin/env bash
# Generate / merge .env from .env.example.
# - Keeps keys already set in .env (non-placeholder values)
# - Fills only missing keys, empty-required keys, or CHANGE_ME placeholders
# - Generates a strong POSTGRES_PASSWORD and keeps DATABASE_URL in sync when needed
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="${ROOT_DIR}/.env.example"
ENV_FILE="${ROOT_DIR}/.env"
DRY_RUN=0
FORCE_SECRETS=0

usage() {
  cat <<'EOF'
Usage: ./scripts/generate-env.sh [options]

Merge .env.example into .env without overwriting values that already exist.

Options:
  -e, --env PATH         Target .env path (default: ./.env)
  -x, --example PATH     Source example path (default: ./.env.example)
  -f, --force-secrets    Regenerate password/URL even if already set (non-CHANGE_ME)
  -n, --dry-run          Print result to stdout; do not write .env
  -h, --help             Show this help

Rules:
  1. Existing .env keys with real values are preserved.
  2. Keys missing from .env are taken from .env.example.
  3. Values still containing CHANGE_ME are treated as unset and filled.
  4. Empty example values (e.g. SMTP_USER=) stay empty unless already set.
  5. POSTGRES_PASSWORD is randomly generated when missing/placeholder.
  6. DATABASE_URL is rebuilt from POSTGRES_* when missing/placeholder or
     when password was just generated (so password and URL stay aligned).
  7. Extra keys present only in .env are kept at the end of the file.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -e|--env) ENV_FILE=${2:?Missing path for --env}; shift 2 ;;
    -x|--example) EXAMPLE=${2:?Missing path for --example}; shift 2 ;;
    -f|--force-secrets) FORCE_SECRETS=1; shift ;;
    -n|--dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ ! -f "$EXAMPLE" ]; then
  echo "error: example file not found: $EXAMPLE" >&2
  exit 1
fi

# Portable: resolve absolute-ish paths without requiring realpath.
is_placeholder() {
  case "$1" in
    *CHANGE_ME*) return 0 ;;
    *) return 1 ;;
  esac
}

# Read KEY from a dotenv-like file (last occurrence wins). Handles empty values.
# Does not expand quotes; stores raw value after first '='.
env_get() {
  local file=$1 key=$2
  [ -f "$file" ] || return 1
  # shellcheck disable=SC2002
  local line
  line=$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 || true)
  [ -n "$line" ] || return 1
  printf '%s' "${line#*=}"
}

env_has_key() {
  local file=$1 key=$2
  [ -f "$file" ] || return 1
  grep -Eq "^${key}=" "$file" 2>/dev/null
}

# True if we should keep the existing value as-is.
should_keep_existing() {
  local key=$1 value=$2
  if [ "$FORCE_SECRETS" -eq 1 ]; then
    case "$key" in
      POSTGRES_PASSWORD|DATABASE_URL) return 1 ;;
    esac
  fi
  if is_placeholder "$value"; then
    return 1
  fi
  # Key exists with a (possibly empty) value that is not a placeholder → keep.
  return 0
}

generate_password() {
  # URL-safe-ish password without chars that break unencoded DATABASE_URL.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 36 | tr -d '\n/+=\r' | head -c 32
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import secrets, string
alphabet = string.ascii_letters + string.digits
print("".join(secrets.choice(alphabet) for _ in range(32)), end="")
PY
    return
  fi
  # Last resort: /dev/urandom
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
}

build_database_url() {
  local user=$1 pass=$2 db=$3
  printf 'postgresql://%s:%s@postgres:5432/%s?sslmode=disable' "$user" "$pass" "$db"
}

# Collect example keys in order (for stable output + trailing extras detection).
EXAMPLE_KEYS=()
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*) continue ;;
  esac
  if [[ "$line" == *=* ]]; then
    EXAMPLE_KEYS+=("${line%%=*}")
  fi
done <"$EXAMPLE"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
out="$tmpdir/env.out"
: >"$out"

added=0
kept=0
generated=0
password_generated=0
FINAL_POSTGRES_PASSWORD=""
FINAL_POSTGRES_USER=""
FINAL_POSTGRES_DB=""

while IFS= read -r line || [ -n "$line" ]; do
  # Preserve blank lines and comments from example for readability.
  if [ -z "$line" ] || [[ "$line" == \#* ]]; then
    printf '%s\n' "$line" >>"$out"
    continue
  fi

  if [[ "$line" != *=* ]]; then
    printf '%s\n' "$line" >>"$out"
    continue
  fi

  key=${line%%=*}
  example_val=${line#*=}
  chosen=""
  action=""

  if env_has_key "$ENV_FILE" "$key"; then
    existing_val=$(env_get "$ENV_FILE" "$key" || true)
    if should_keep_existing "$key" "$existing_val"; then
      chosen=$existing_val
      action=keep
    fi
  fi

  if [ -z "${action:-}" ]; then
    # Missing, placeholder, or forced secret.
    case "$key" in
      POSTGRES_PASSWORD)
        if is_placeholder "$example_val" || [ -z "$example_val" ] || [ "$FORCE_SECRETS" -eq 1 ]; then
          chosen=$(generate_password)
          password_generated=1
          action=generate
        else
          chosen=$example_val
          action=add
        fi
        ;;
      DATABASE_URL)
        # Deferred: filled after we know final password/user/db (second pass marker).
        chosen="__DEFER_DATABASE_URL__"
        action=defer
        ;;
      *)
        chosen=$example_val
        action=add
        ;;
    esac
  fi

  case "$action" in
    keep) kept=$((kept + 1)) ;;
    add) added=$((added + 1)) ;;
    generate) generated=$((generated + 1)) ;;
    defer) : ;;
  esac

  case "$key" in
    POSTGRES_PASSWORD) FINAL_POSTGRES_PASSWORD=$chosen ;;
    POSTGRES_USER) FINAL_POSTGRES_USER=$chosen ;;
    POSTGRES_DB) FINAL_POSTGRES_DB=$chosen ;;
  esac

  printf '%s=%s\n' "$key" "$chosen" >>"$out"
done <"$EXAMPLE"

# Fallbacks if example order put DATABASE_URL before password fields somehow.
[ -n "$FINAL_POSTGRES_USER" ] || FINAL_POSTGRES_USER=$(env_get "$out" POSTGRES_USER || echo tadscore)
[ -n "$FINAL_POSTGRES_DB" ] || FINAL_POSTGRES_DB=$(env_get "$out" POSTGRES_DB || echo tadscore)
[ -n "$FINAL_POSTGRES_PASSWORD" ] || FINAL_POSTGRES_PASSWORD=$(env_get "$out" POSTGRES_PASSWORD || true)

if [ -z "$FINAL_POSTGRES_PASSWORD" ] || is_placeholder "$FINAL_POSTGRES_PASSWORD"; then
  FINAL_POSTGRES_PASSWORD=$(generate_password)
  password_generated=1
  generated=$((generated + 1))
  # rewrite password line
  tmp_fix="$tmpdir/env.fix"
  : >"$tmp_fix"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      POSTGRES_PASSWORD=*) printf 'POSTGRES_PASSWORD=%s\n' "$FINAL_POSTGRES_PASSWORD" >>"$tmp_fix" ;;
      *) printf '%s\n' "$line" >>"$tmp_fix" ;;
    esac
  done <"$out"
  mv "$tmp_fix" "$out"
fi

# Resolve DATABASE_URL: keep existing real URL unless forced/placeholder/password just generated.
existing_db_url=""
if env_has_key "$ENV_FILE" DATABASE_URL; then
  existing_db_url=$(env_get "$ENV_FILE" DATABASE_URL || true)
fi

resolve_database_url() {
  if [ "$FORCE_SECRETS" -eq 1 ] || [ "$password_generated" -eq 1 ]; then
    build_database_url "$FINAL_POSTGRES_USER" "$FINAL_POSTGRES_PASSWORD" "$FINAL_POSTGRES_DB"
    return
  fi
  if [ -n "$existing_db_url" ] && ! is_placeholder "$existing_db_url"; then
    printf '%s' "$existing_db_url"
    return
  fi
  build_database_url "$FINAL_POSTGRES_USER" "$FINAL_POSTGRES_PASSWORD" "$FINAL_POSTGRES_DB"
}

FINAL_DATABASE_URL=$(resolve_database_url)

tmp_fix="$tmpdir/env.fix"
: >"$tmp_fix"
db_url_written=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    DATABASE_URL=*|DATABASE_URL=__DEFER_DATABASE_URL__)
      printf 'DATABASE_URL=%s\n' "$FINAL_DATABASE_URL" >>"$tmp_fix"
      db_url_written=1
      ;;
    *)
      printf '%s\n' "$line" >>"$tmp_fix"
      ;;
  esac
done <"$out"
if [ "$db_url_written" -eq 0 ]; then
  printf 'DATABASE_URL=%s\n' "$FINAL_DATABASE_URL" >>"$tmp_fix"
fi
mv "$tmp_fix" "$out"

# Preserve extra keys that exist only in the current .env (not in example).
if [ -f "$ENV_FILE" ]; then
  extras=0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    [[ "$line" == *=* ]] || continue
    key=${line%%=*}
    found=0
    for ek in "${EXAMPLE_KEYS[@]+"${EXAMPLE_KEYS[@]}"}"; do
      if [ "$ek" = "$key" ]; then
        found=1
        break
      fi
    done
    if [ "$found" -eq 0 ]; then
      if [ "$extras" -eq 0 ]; then
        printf '\n# --- preserved keys not present in .env.example ---\n' >>"$out"
      fi
      printf '%s\n' "$line" >>"$out"
      extras=$((extras + 1))
      kept=$((kept + 1))
    fi
  done <"$ENV_FILE"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  cat "$out"
  echo "---" >&2
  echo "dry-run: kept=${kept} added=${added} generated=${generated} password_generated=${password_generated}" >&2
  exit 0
fi

# Backup existing .env once before overwrite.
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak"
fi

mv "$out" "$ENV_FILE"
# Drop trap cleanup for moved file
trap - EXIT
rm -rf "$tmpdir"

echo "Wrote ${ENV_FILE}"
echo "  kept existing keys/values : ${kept}"
echo "  filled from example       : ${added}"
echo "  generated secrets         : ${generated}"
if [ "$password_generated" -eq 1 ]; then
  echo "  POSTGRES_PASSWORD         : generated (DATABASE_URL synced)"
fi
if [ -f "${ENV_FILE}.bak" ]; then
  echo "  previous file backed up   : ${ENV_FILE}.bak"
fi
echo "Review the file, then: docker compose up --build -d"
