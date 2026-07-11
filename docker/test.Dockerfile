# syntax=docker/dockerfile:1.7
ARG PNPM_VERSION=10.13.1

FROM node:22.13.1-bookworm-slim AS node-runner
ARG PNPM_VERSION
ENV CI=1 PNPM_HOME=/pnpm PATH=/pnpm:$PATH
WORKDIR /workspace
RUN corepack disable && npm install -g pnpm@${PNPM_VERSION}
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/rule-engine/package.json packages/rule-engine/package.json
RUN --mount=type=cache,id=tadscore-pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "test"]

FROM mcr.microsoft.com/playwright:v1.61.1-noble AS playwright-runner
ARG PNPM_VERSION
ENV CI=1 PNPM_HOME=/pnpm PATH=/pnpm:$PATH
WORKDIR /workspace
RUN corepack disable && npm install -g pnpm@${PNPM_VERSION}
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/rule-engine/package.json packages/rule-engine/package.json
RUN --mount=type=cache,id=tadscore-pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "test:e2e"]
