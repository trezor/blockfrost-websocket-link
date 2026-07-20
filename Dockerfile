# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases
COPY .yarn/plugins .yarn/plugins

RUN yarn install --immutable

COPY tsconfig.json ./
COPY src ./src

RUN yarn build \
  && yarn workspaces focus --all --production

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

ARG BUILD_COMMIT
ENV BUILD_COMMIT=$BUILD_COMMIT

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /usr/sbin/nologin --create-home appuser

COPY --from=builder --chown=appuser:nodejs /app/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules

USER appuser

EXPOSE 3005

CMD ["node", "dist/src/server.js"]
