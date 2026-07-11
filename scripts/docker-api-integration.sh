#!/usr/bin/env sh
set -eu

project=${TADSCORE_TEST_PROJECT:-tadscore-api-it-$(date +%s)}
network="${project}_net"
postgres="${project}_postgres"
image=${TADSCORE_TEST_IMAGE:-tadscore-test-runner:local}
password=${TADSCORE_TEST_DB_PASSWORD:-tadscore_it}
db_url="postgresql://tadscore:${password}@postgres:5432/tadscore?sslmode=disable"

cleanup() {
  docker rm -f "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build \
  -f docker/test.Dockerfile \
  --target node-runner \
  -t "$image" \
  .

cleanup
docker network create "$network" >/dev/null
docker run -d --rm \
  --name "$postgres" \
  --network "$network" \
  --network-alias postgres \
  -e POSTGRES_DB=tadscore \
  -e POSTGRES_USER=tadscore \
  -e POSTGRES_PASSWORD="$password" \
  postgres:17-alpine >/dev/null

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if docker exec "$postgres" pg_isready -U tadscore -d tadscore >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$postgres" pg_isready -U tadscore -d tadscore >/dev/null

run_dbmate() {
  docker run --rm \
    --network "$network" \
    -e DATABASE_URL="$db_url" \
    -v "$PWD/database/migrations:/db/migrations:ro" \
    ghcr.io/amacneil/dbmate:2.25.0 \
    --migrations-dir /db/migrations "$@"
}

run_dbmate up
migration_count=$(find database/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')
while [ "$migration_count" -gt 0 ]; do
  run_dbmate down
  migration_count=$((migration_count - 1))
done
run_dbmate up

docker run --rm \
  --network "$network" \
  -e NODE_ENV=test \
  -e TADSCORE_INTEGRATION=1 \
  -e DATABASE_URL="$db_url" \
  "$image" \
  sh -lc 'pnpm --filter @tadscore/contracts build && pnpm --filter @tadscore/rule-engine build && pnpm --filter @tadscore/api test'
