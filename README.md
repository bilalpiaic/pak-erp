# GarmentLoop ERP

PostgreSQL-backed accounting application (V1) replacing the browser/`localStorage` prototype.

## Stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS
- Prisma + PostgreSQL
- Deploy target: Vercel

## Current progress

### Phase 1 — Foundation

- Next.js + TypeScript + Tailwind + Prisma
- App shell (responsive sm / md / lg)
- Shared money formatter (`₨ 1,250,000.00`)

### Phase 2 — Database

- Prisma migration for companies, fiscal years, accounts, vouchers, voucher lines, audit logs
- Seed data: minimal company + FY + chart of accounts only (no parties / vouchers / demo transactions)
- Company Settings UI reads/writes PostgreSQL
- `/api/company` and `/api/health`

### Phase 3 — Chart of Accounts

- COA list sorted code-wise (1→9), grouped by account group (hierarchy)
- Create / edit accounts
- Activate / deactivate
- Search + type/status filters
- `/api/accounts` and `/api/accounts/:id`

### Phase 4 — Voucher Engine

- Draft / post / cancel workflow (BPV, BRV, CPV, CRV, JV)
- Frontend + backend debit=credit validation using integer cents
- Posted vouchers immutable; cancel keeps audit trail
- Attachments: PDF / JPG / PNG / DOC / CSV / Excel (Vercel Blob or local upload)
- `/api/vouchers`, `/api/vouchers/:id`, `/post`, `/cancel`, `/attachments`

### Phase 5 — Ledger & Journal

- General Journal of posted lines with date / type / search filters + CSV export
- Account Ledger with opening, period movements, running balance, closing
- `/api/journal`, `/api/ledger`

### Phase 6 — Reports

- Trial Balance, Balance Sheet, Profit & Loss, Cash Flow (from posted lines)
- Debtors / Creditors aging with age buckets
- `/api/reports/:type`

### Phase 7 — Dashboard

- Live KPIs (assets, liabilities, MTD revenue/expenses/profit, cash & bank)
- Recent vouchers list
- `/api/dashboard`

### Phase 8 — Production hardening

- Graceful DB-unavailable UI errors on all major pages
- Print styles + CSV export helpers
- Resilient Vercel build (`scripts/vercel-build.sh`)
- Health check reports DB + `AUTH_SECRET` presence

### Phase 9 — Parties & FBR fields

- Parties master (debtors / creditors / both) with NTN, outstanding, WHT status
- Voucher party picker + NTN / WHT applicable fields
- Aging reports prefer party master balances
- `/api/parties`, `/api/parties/:id`

### Phase 10 — Sales Invoices

- Sales invoice CRUD with Party, PO#, and lines (Item, Detail, Quantity, Rate, Amount)
- Direct posting: Dr Trade Debtors (1010) / Cr Sales (4001) via linked SI voucher
- Draft / post / cancel; party outstanding updated on post/cancel
- Printable sales invoice with company letterhead
- `/api/sales-invoices`, `/api/sales-invoices/:id`, `/post`, `/cancel`

### Phase 11 — User login & credentials CRUD

- Username / password authentication with signed HTTP-only session cookies (`AUTH_SECRET`)
- Middleware protects app pages and APIs; `/login` + `/api/auth/*` + `/api/health` remain public
- Users admin CRUD (create / edit / activate / delete) under Administration → Users
- Seeded default admin: `admin` / `admin123`
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/users`, `/api/users/:id`

### Phase 12 — Demo marketing tenant

- Isolated demo company (`companies.is_demo = true`) with its own COA, parties, vouchers, invoices
- Demo login `demo` / `demo1234` only resolves demo tenant data across forms, lists, and reports
- Live users never see demo rows; demo users never see live accounting data
- `npm run prisma:seed:demo` refreshes demo tenant without wiping live data

### Phase 13 — COA report links (BS / P&L / CF)

- Accounts carry Balance Sheet head, Profit & Loss head, and Cash Flow link
- New account form cascades Type → COA group → BS/P&L head → CF link
- BS, P&L, and Cash Flow statements aggregate by these links (not hardcoded codes)
- COA list shows BS / P&L / CF columns



### Phase 14 — Admin unpost / COA maintenance

- Posted vouchers and sales invoices stay immutable for ordinary users
- Administrators can **unpost** a posted voucher or sales invoice back to draft (ledgers and party outstanding reverse) then edit or delete
- Cancel remains a permanent void (keeps the cancelled document)
- Chart of Accounts add / edit / deactivate / delete is Administrator-only; unused accounts can be deleted
- Audit log records `UNPOST` and `DELETE`

### Phase 15 — Voucher CSV import

- Bulk import BPV / BRV / CPV / CRV / JV from CSV (one row per line, grouped by `voucher_key`)
- Sample + template files under `public/samples/`
- Validate-then-import on Voucher Entry; optional post of balanced vouchers
- `/api/vouchers/import`

### Phase 16 — A4 print + SI voucher reconcile

- Print unclips the app shell so registers, ledgers, and invoices continue onto later A4 pages
- Letterhead and column headers repeat on each page; signatures stay on the last page
- Sales Invoices: check / repair SI voucher link, status, party, and amount (`/api/sales-invoices/reconcile`)
- Administrators can delete unreconciled SI vouchers that have no sales invoice (posted orphans reverse party outstanding)

The legacy single-file prototype lives in `legacy/index.html`.

## Getting started

```bash
cp .env.example .env
# set DATABASE_URL to your PostgreSQL connection string

npm install
npm run db:setup   # migrate deploy + seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/login` (or `/dashboard` when signed in).

Default credentials after seed: **admin** / **admin123** (live) · **demo** / **demo1234** (marketing demo tenant)

Local Cloud Agent bootstrap (Postgres + migrate + seed):

```bash
bash .cursor/install.sh
bash .cursor/start.sh
```

### Responsive layout

- **Small (&lt; md):** top bar + slide-out navigation drawer
- **md+:** persistent sidebar
- **lg:** wider sidebar and 3-column dashboard / report grids

### Deploy (Vercel)

Project: [bilalpiaics-projects/pak-erp](https://vercel.com/bilalpiaics-projects/pak-erp)

```bash
npx vercel link --yes --project pak-erp --scope bilalpiaics-projects
npx vercel --prod
```

### Database (Neon)

Production/dev cloud database is intended to run on [Neon](https://neon.tech).

1. Create a Neon project and copy the **pooled** connection string.
2. Put it in `.env` as `DATABASE_URL` (never commit `.env`).
3. Apply schema + seed:

```bash
npm run db:setup
```

Build uses `scripts/vercel-build.sh`: it runs `prisma migrate deploy` when `DATABASE_URL` is set, then always `prisma generate` + `next build`. Without `DATABASE_URL`, the frontend still builds; API routes that need Postgres will fail at runtime until the variable is configured.

Set these in [Vercel → pak-erp → Settings → Environment Variables](https://vercel.com/bilalpiaics-projects/pak-erp/settings/environment-variables) for **Production** and **Preview**, then Redeploy:

| Name | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL with `sslmode=require` (drop `channel_binding=require` if present) |
| `DIRECT_URL` | Optional Neon **direct** (non-pooler) URL for migrations; build also auto-strips `-pooler` from `DATABASE_URL` |
| `AUTH_SECRET` | Session signing secret (required for login) |

After env vars are saved, open the latest deployment → **Redeploy**, or push a new commit. Production URL updates when this branch is merged to `main` (or you promote a production deployment).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:setup` | `migrate deploy` + seed |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create/apply migrations (dev) |
| `npm run prisma:seed` | Re-seed company + FY + chart of accounts only |

## Environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (server-side only) |
| `AUTH_SECRET` | Required — signs login session cookies |
| `NEXT_PUBLIC_APP_NAME` | App display name |
| `NEXT_PUBLIC_CURRENCY` | Default `PKR` |

Never commit real database credentials.

## Navigation

```text
Dashboard
Accounting → Chart of Accounts, Parties, Voucher Entry, General Journal, Account Ledger
Reports → Trial Balance, Balance Sheet, P&L, Cash Flow, Debtors/Creditors Aging
Administration → Company Settings, Users
```

## Core principle

> PostgreSQL stores the accounting truth.  
> The server performs the accounting calculations.  
> Next.js displays the results.  
> Every financial amount uses two decimal places and full thousands separators (e.g. `₨ 1,250,000.00`).
