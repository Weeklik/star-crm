# Star CRM

A professional CRM web portal for sales teams, with role-based access for owners and salespersons, full deal pipeline management, and rich reports with PDF/Excel export.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/star-crm run dev` — run the frontend (port 18321)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (then manually fix `lib/api-zod/src/index.ts` to only have `export * from "./generated/api";`)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)
- Required env: `SESSION_SECRET` — Secret for express-session cookie signing

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + Recharts + Wouter
- Auth: Custom email/password with express-session + bcryptjs
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle DB schema (`users.ts`, `deals.ts`)
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/api-server/src/middlewares/` — Clerk proxy + requireAuth/requireOwner
- `artifacts/star-crm/src/` — React frontend
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Generated Zod validation schemas (do not edit)

## Architecture decisions

- Auth: POST /api/auth/login (email+password → session cookie), POST /api/auth/logout, GET /api/users/me
- Sessions stored server-side via express-session; cookie is httpOnly, secure in production
- Role-based access enforced in API middleware and frontend routing
- Deals are scoped to the logged-in salesperson (by integer user id); owners see all deals
- Reports endpoints support date range + salesperson id filters for flexible analysis
- PDF export uses window.print(); Excel export generates CSV via blob download
- Orval `schemas` option removed from zod config to prevent duplicate export conflicts; `lib/api-zod/src/index.ts` must only export from `./generated/api`

## Product

- Login-only portal (no self-signup; owner adds team members)
- Owner dashboard: KPI summary, per-salesperson breakdown, all deals, week-wise reports
- Salesperson dashboard: own pipeline KPIs, deal management table
- Deal fields: Start Date, Name, Company, Product, Stage, Progress%, Sales Status, VAT, Agreed/Received/Outstanding Amounts, Closing Dates, Notes
- Reports: Stage breakdown, weekly trends, per-salesperson comparison, date-filtered — all exportable as PDF/Excel

## User preferences

- No signup option — login only
- Stages: Quotation Sent, Order Closed, Order Confirmed, Order Lost
- Owner sees all salesperson data and can change user roles
- All reports must be downloadable as PDF and Excel

## Gotchas

- After running codegen, always fix `lib/api-zod/src/index.ts` to only have `export * from "./generated/api";` — orval regenerates it with stale exports
- The first user to authenticate via Clerk becomes the owner automatically
- Seed data uses placeholder clerkIds (`seed_owner_001`, etc.) — real users come from Clerk auth

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.local/skills/clerk-auth/references/setup-and-customization.md` for Clerk integration details
