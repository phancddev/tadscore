#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Create a TadScore account directly through the API's database-aware CLI.

Usage:
  ./scripts/create-account.sh [options]

Options:
  --email EMAIL            Account email (prompted when omitted)
  --username USERNAME      Login username (prompted when omitted)
  --full-name NAME         Display name (prompted when omitted)
  --role ROLE              user or super_admin (default: user)
  -h, --help               Show this help

The password is always read from a hidden prompt and piped to the CLI over standard input. No
sample account is created and no account credentials are read from .env. The API container must
be running (`make up`).
EOF
}

email=''
username=''
full_name=''
role='user'

while [ "$#" -gt 0 ]; do
  case "$1" in
    --email) email=${2:?Missing value for --email}; shift 2 ;;
    --username) username=${2:?Missing value for --username}; shift 2 ;;
    --full-name) full_name=${2:?Missing value for --full-name}; shift 2 ;;
    --role) role=${2:?Missing value for --role}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$role" in
  user|super_admin) ;;
  *) echo "Role must be 'user' or 'super_admin'." >&2; exit 2 ;;
esac

if [ ! -t 0 ]; then
  echo 'An interactive terminal is required to enter a password securely.' >&2
  exit 2
fi

[ -n "$email" ] || { printf 'Email: '; IFS= read -r email; }
[ -n "$username" ] || { printf 'Username: '; IFS= read -r username; }
[ -n "$full_name" ] || { printf 'Full name: '; IFS= read -r full_name; }

printf 'Password: '
cleanup() {
  stty echo 2>/dev/null || true
  unset password password_confirm
}
trap cleanup EXIT HUP INT TERM
stty -echo
IFS= read -r password
stty echo
printf '\nConfirm password: '
stty -echo
IFS= read -r password_confirm
stty echo
printf '\n'

if [ "$password" != "$password_confirm" ]; then
  echo 'Passwords do not match.' >&2
  exit 2
fi

if [ -z "$email" ] || [ -z "$username" ] || [ -z "$full_name" ] || [ -z "$password" ]; then
  echo 'Email, username, full name, and password are required.' >&2
  exit 2
fi

if ! docker compose ps --status running --services | grep -qx api; then
  echo 'The API container is not running. Start the stack with: make up' >&2
  exit 1
fi

printf '%s\n' "$password" | docker compose exec -T \
  api node dist/cli/account-create.js --password-stdin \
  --email "$email" \
  --username "$username" \
  --full-name "$full_name" \
  --role "$role"
