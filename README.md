# GarmentLoop ERP

PostgreSQL-backed accounting application (V1) replacing the browser/`localStorage` prototype.

## Stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS
- Prisma + PostgreSQL
- Deploy target: Vercel

## Phase 1 — Foundation (current)

- Next.js project with TypeScript and Tailwind
- Prisma schema for companies, accounts, fiscal years, vouchers, voucher lines
- Environment configuration (`.env.example`)
- App shell with sidebar navigation
- Placeholder pages for Dashboard, COA, Vouchers, Journal, Ledger, Reports, Settings
- Shared money formatter (`₨1,250,000.00` — no abbreviations)

The legacy single-file prototype lives in `legacy/index.html`.

## Getting started

```bash
cp .env.example .env
# set DATABASE_URL to your PostgreSQL connection string

npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/dashboard`.

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

Set `DATABASE_URL` (and later `AUTH_SECRET`) in the Vercel project Environment Variables before enabling database features.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run migrations (Phase 2+) |

## Environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (server-side only) |
| `AUTH_SECRET` | Reserved for auth |
| `NEXT_PUBLIC_APP_NAME` | App display name |
| `NEXT_PUBLIC_CURRENCY` | Default `PKR` |

Never commit real database credentials.

## Navigation

```text
Dashboard
Accounting → Chart of Accounts, Voucher Entry, General Journal, Account Ledger
Reports → Trial Balance, Balance Sheet, P&L, Cash Flow, Debtors/Creditors Aging
Administration → Company Settings
```

## Core principle

> PostgreSQL stores the accounting truth.  
> The server performs the accounting calculations.  
> Next.js displays the results.  
> Every financial amount uses two decimal places and full thousands separators.
