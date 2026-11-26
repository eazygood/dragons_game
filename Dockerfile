FROM node:26-slim AS api-deps

# Node 26 images no longer ship corepack, which supplies the pnpm pinned by packageManager.
RUN npm install --global corepack@0.36.0 && corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --prod --filter @dragons-game/api...


# Built on api-deps so the two installs run one after the other: side by side they
# exhaust the 2 GiB of a default Colima VM.
FROM api-deps AS web-build

RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @dragons-game/web build


FROM node:26-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-deps /app .
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
COPY packages/contracts/src packages/contracts/src
COPY --from=web-build /app/apps/web/dist apps/web/dist

USER node
EXPOSE 3000
CMD ["node", "apps/api/src/server.ts"]
