ARG NODE_IMAGE=node:22.13.1-bookworm-slim
ARG NGINX_IMAGE=nginx:1.27-alpine
ARG TARGET_PLATFORM=linux/amd64

FROM --platform=${TARGET_PLATFORM} ${NODE_IMAGE} AS build
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

COPY tsconfig.json tsconfig.base.json ./
COPY scripts/run-workspaces.mjs scripts/run-workspaces.mjs
COPY apps apps
COPY packages packages
RUN npm run build

FROM --platform=${TARGET_PLATFORM} ${NGINX_IMAGE} AS runtime
COPY deploy/single-server/config/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
