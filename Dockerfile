# syntax=docker/dockerfile:1

FROM node:20-bookworm AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build

FROM node:20-bookworm AS prod-deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --omit=dev -w @dms/server -w @dms/shared \
  && mkdir -p /app/server/node_modules /app/shared/node_modules

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 dms \
  && useradd --system --uid 1001 --gid dms --home-dir /app --shell /usr/sbin/nologin dms

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    PUBLIC_ORIGIN=http://localhost:8042 \
    CLIENT_DIST=/app/client/dist

COPY --from=prod-deps /app/package.json /app/package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/shared/package.json ./shared/package.json
COPY --from=prod-deps /app/shared/node_modules ./shared/node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=prod-deps /app/server/package.json ./server/package.json
COPY --from=prod-deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /data/uploads \
  && chown -R dms:dms /app /data

USER dms
EXPOSE 3001
VOLUME ["/data"]
WORKDIR /app/server
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
