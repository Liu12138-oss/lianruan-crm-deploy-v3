ARG NODE_IMAGE=node:22.13.1-bookworm-slim
ARG TARGET_PLATFORM=linux/amd64

FROM --platform=${TARGET_PLATFORM} ${NODE_IMAGE} AS deps
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
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
COPY apps apps
COPY packages packages
RUN npm run build

FROM --platform=${TARGET_PLATFORM} ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/testing/package.json packages/testing/package.json
RUN npm ci --omit=dev && npm cache clean --force

FROM --platform=${TARGET_PLATFORM} ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/testing/package.json packages/testing/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/worker/dist apps/worker/dist
COPY --from=build /app/packages/config/dist packages/config/dist
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/testing/dist packages/testing/dist

USER node
EXPOSE 3100
CMD ["node", "apps/api/dist/server.js"]
