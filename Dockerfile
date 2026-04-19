# EMS (take2ems) — production image
# Debian bookworm-slim (glibc): zuverlässiger für Next.js + Prisma + Puppeteer als Alpine/musl.

FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall runs prisma generate — schema must exist before npm ci
COPY prisma ./prisma
ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN npm ci

FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# .env is not in the image — Next may still run Prisma during "Collecting page data".
# Use a throwaway SQLite DB for this stage only (see package.json build:docker).
ENV DATABASE_URL=file:/tmp/ems-build.db
# Keep heap moderate — total RAM also needs room for webpack + OS (avoid OOM kill).
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npx prisma generate \
  && npx prisma migrate deploy \
  && npm run build:docker
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-color-emoji \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /usr/sbin/nologin --create-home nextjs

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start:prod"]
