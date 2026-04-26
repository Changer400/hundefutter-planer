# syntax=docker/dockerfile:1.7
# Multi-stage build: produces a single runtime image containing the
# built Vite frontend AND the Hono API/cron server.

# ---------- Stage 1: build the frontend (Vite) ----------
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- Stage 2: build the Node server ----------
FROM node:20-bookworm-slim AS server-builder
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY self-hosted/package.json self-hosted/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY self-hosted/tsconfig.json ./
COPY self-hosted/src ./src
RUN npm run build

# ---------- Stage 3: runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/hundefutter.db
ENV PUBLIC_DIR=/app/public
# Caddy terminates TLS, so cookies over the internal link are fine.
# Caddy forwards X-Forwarded-Proto; we still set Secure cookies (browsers
# accept them when the outer request came in over HTTPS).
ENV COOKIE_SECURE=1
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/dist ./dist
COPY self-hosted/migrations ./migrations
COPY --from=frontend-builder /app/dist ./public
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "dist/server.js"]
