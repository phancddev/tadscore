#!/usr/bin/env sh
set -eu

base_url=${PLAYWRIGHT_BASE_URL:-http://localhost:1107}
mailpit_url=${TADSCORE_MAILPIT_URL:-http://localhost:1109}
image=${TADSCORE_PLAYWRIGHT_IMAGE:-tadscore-playwright-runner:local}

docker build \
  -f docker/test.Dockerfile \
  --target playwright-runner \
  -t "$image" \
  .

echo "Playwright base URL: $base_url"
echo "Mailpit URL: $mailpit_url"
echo "The stack WEB_ORIGIN must include the browser origin above for authenticated POSTs."

docker run --rm \
  --network host \
  --add-host=host.docker.internal:host-gateway \
  -e PLAYWRIGHT_BASE_URL="$base_url" \
  -e TADSCORE_MAILPIT_URL="$mailpit_url" \
  "$image" \
  node -e "const base=process.env.PLAYWRIGHT_BASE_URL; const mail=process.env.TADSCORE_MAILPIT_URL; const checks=[['gateway health',base+'/health'],['auth config',base+'/api/auth/config'],['swagger',base+'/api/docs/json'],['mailpit',mail+'/api/v1/info']]; (async()=>{for(const [name,url] of checks){const r=await fetch(url); if(!r.ok) throw new Error(name+' failed: '+r.status+' '+url); console.log(name+': '+r.status)}})().catch((error)=>{console.error(error.message); process.exit(1)})"

docker run --rm \
  --network host \
  --add-host=host.docker.internal:host-gateway \
  --ipc=host \
  -e PLAYWRIGHT_BASE_URL="$base_url" \
  -e TADSCORE_MAILPIT_URL="$mailpit_url" \
  -e TADSCORE_FULLSTACK="${TADSCORE_FULLSTACK:-0}" \
  "$image" \
  sh -lc 'pnpm --filter @tadscore/contracts build && pnpm --filter @tadscore/web test:e2e'
