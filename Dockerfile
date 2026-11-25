# Three stages: the web build needs the whole toolchain, the API needs only production
# dependencies, and the runtime image carries neither a compiler nor a package manager.
FROM node:26-slim AS base

# Lets the build run behind a registry mirror or proxy; the default is the public registry.
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV npm_config_registry=$NPM_REGISTRY \
    pnpm_config_registry=$NPM_REGISTRY \
    COREPACK_NPM_REGISTRY=$NPM_REGISTRY

# Node 26 images no longer ship corepack; it supplies the pnpm pinned by packageManager.
RUN npm install --global corepack@0.36.0 && corepack enable

WORKDIR /app

# Manifests first, so editing source does not invalidate the dependency layers.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/


FROM base AS api-deps

# `...` adds the workspace packages the API depends on, so contracts' own dependencies
# are installed while the web app's React toolchain is not.
RUN pnpm install --frozen-lockfile --prod --filter @bigbank-dragon/api...


# Built on api-deps, not base, so the two installs run one after the other: side by side
# they exhaust the 2 GiB of a default Colima VM.
FROM api-deps AS web-build

RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/contracts packages/contracts
RUN pnpm --filter @bigbank-dragon/web build


FROM node:26-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Node strips the types itself, so the runtime image holds the TypeScript sources and no
# build output. The workspace symlinks in node_modules must keep their relative layout.
COPY --from=api-deps --chown=node:node /app/node_modules node_modules
COPY --from=api-deps --chown=node:node /app/apps/api/node_modules apps/api/node_modules
COPY --from=api-deps --chown=node:node /app/packages/contracts/node_modules packages/contracts/node_modules
COPY --chown=node:node apps/api/package.json apps/api/
COPY --chown=node:node apps/api/src apps/api/src
COPY --chown=node:node apps/api/migrations apps/api/migrations
COPY --chown=node:node packages/contracts/package.json packages/contracts/
COPY --chown=node:node packages/contracts/src packages/contracts/src
COPY --from=web-build --chown=node:node /app/apps/web/dist apps/web/dist

USER node
EXPOSE 3000
CMD ["node", "apps/api/src/server.ts"]
