FROM node:24-alpine AS base
RUN npm install -g pnpm@10

# ── Install all dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json              ./lib/db/
COPY lib/api-zod/package.json         ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json        ./lib/api-spec/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/star-crm/package.json  ./artifacts/star-crm/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/

RUN pnpm install --frozen-lockfile

# ── Build frontend (React + Vite) ─────────────────────────────────────────────
FROM deps AS frontend-build
WORKDIR /app
COPY . .

RUN PORT=3000 BASE_PATH=/ NODE_ENV=production \
    pnpm --filter @workspace/star-crm run build

# ── Build API server (esbuild bundle) ────────────────────────────────────────
FROM deps AS api-build
WORKDIR /app
COPY . .

RUN pnpm --filter @workspace/api-server run build

# ── Final image ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=api-build      /app/artifacts/api-server/dist ./dist
COPY --from=frontend-build /app/artifacts/star-crm/dist/public ./public

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
