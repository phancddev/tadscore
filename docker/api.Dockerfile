FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/rule-engine/package.json packages/rule-engine/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages packages
COPY rule-config rule-config
RUN pnpm --filter @tadscore/api... build \
  && pnpm --filter @tadscore/api deploy --prod --legacy /prod/api

FROM node:22-alpine AS runtime

RUN addgroup -S tadscore \
  && adduser -S tadscore -G tadscore \
  && mkdir -p /data/uploads \
  && chown -R tadscore:tadscore /data
WORKDIR /app
COPY --from=build --chown=tadscore:tadscore /prod/api /app
COPY --from=build --chown=tadscore:tadscore /app/rule-config /app/rule-config

ENV NODE_ENV=production
USER tadscore
EXPOSE 3000
CMD ["node", "dist/server.js"]
