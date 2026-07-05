FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter @phosop/shared build && pnpm --filter @phosop/api build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable \
  && groupadd --system phosop \
  && useradd --system --gid phosop --home-dir /app phosop

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts \
  && pnpm store prune
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

USER phosop
EXPOSE 3333
CMD ["node", "apps/api/dist/main.js"]
