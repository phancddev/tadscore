#!/usr/bin/env sh
set -eu

cmd=${1:-all}
image=${TADSCORE_TEST_IMAGE:-tadscore-test-runner:local}

case "$cmd" in
  format | lint | unit | build | all) ;;
  *)
    echo "Usage: $0 [format|lint|unit|build|all]" >&2
    exit 2
    ;;
esac

docker build \
  -f docker/test.Dockerfile \
  --target node-runner \
  -t "$image" \
  .

run_in_image() {
  docker run --rm "$image" "$@"
}

build_shared='pnpm --filter @tadscore/contracts build && pnpm --filter @tadscore/rule-engine build'

case "$cmd" in
  format) run_in_image pnpm format:check ;;
  lint) run_in_image pnpm lint ;;
  unit) run_in_image sh -lc "$build_shared && pnpm test" ;;
  build) run_in_image pnpm build ;;
  all)
    run_in_image pnpm format:check
    run_in_image pnpm lint
    run_in_image sh -lc "$build_shared && pnpm test"
    run_in_image pnpm build
    ;;
esac
