# syntax=docker/dockerfile:1.7

# ─── Stage 1: builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Pular o download do binário do mongodb-memory-server (só para testes; ~70MB)
ENV MONGOMS_DISABLE_POSTINSTALL=1
# Husky precisa de .git; container não tem
ENV HUSKY=0

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# Build: tsc + tsc-alias (reescreve "@/foo" → "./relative/foo" no dist/)
RUN pnpm build

# ─── Stage 2: runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV MONGOMS_DISABLE_POSTINSTALL=1
ENV HUSKY=0

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Instala SOMENTE prod deps no runner (sem invocar lifecycle scripts)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/dist ./dist

# User não-root
RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/health/live || exit 1

CMD ["node", "dist/server.js"]
