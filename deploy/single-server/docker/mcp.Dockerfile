ARG NODE_IMAGE=node:22.13.1-bookworm-slim
ARG TARGET_PLATFORM=linux/amd64

FROM --platform=${TARGET_PLATFORM} ${NODE_IMAGE} AS deps
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/testing/package.json packages/testing/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.json tsconfig.base.json ./
COPY scripts/run-workspaces.mjs scripts/run-workspaces.mjs
COPY apps/mcp apps/mcp
RUN npm --workspace @lianruan/mcp run build

FROM --platform=${TARGET_PLATFORM} ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/testing/package.json packages/testing/package.json
RUN npm ci --omit=dev --workspace @lianruan/mcp --include-workspace-root=false && npm cache clean --force

FROM --platform=${TARGET_PLATFORM} ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/mcp/node_modules ./apps/mcp/node_modules
COPY package.json ./
COPY apps/mcp/package.json apps/mcp/package.json
COPY --from=build /app/apps/mcp/dist apps/mcp/dist

USER node
EXPOSE 3307
CMD ["node", "apps/mcp/dist/server.js", "--transport", "streamable-http"]
