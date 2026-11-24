FROM node:26

# Lets the build run behind a registry mirror or proxy; the default is the public registry.
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV npm_config_registry=$NPM_REGISTRY \
    pnpm_config_registry=$NPM_REGISTRY \
    COREPACK_NPM_REGISTRY=$NPM_REGISTRY

# Node 26 images no longer ship corepack; it supplies the pnpm pinned by packageManager.
RUN npm install --global corepack@0.36.0 && corepack enable

WORKDIR /app

# Manifests first, so editing source does not invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
# Dev dependencies stay: the API runs on tsx, with no compile step.
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @bigbank-dragon/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@bigbank-dragon/api", "start"]
