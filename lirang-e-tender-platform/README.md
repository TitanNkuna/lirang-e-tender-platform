# Lirang e-Tender Platform

Issue tenders, collect contractor returns, compare submissions (price, quality, payment terms) and manage awards.

## Stack

- TanStack Start + React + TypeScript
- Neon Postgres in production
- PGLite fallback for local development
- Better Auth with email/password
- Vercel + Nitro deployment
- Editable procurement and SLA templates

## Local development

1. Copy `.env.example` to `.env` if you want to use Neon locally. Without `DATABASE_URL`, the app uses a local PGLite database.
2. Install dependencies: `npm ci`
3. Start the app: `npm run dev`
4. Open `http://localhost:8080`

## Vercel + Neon deployment

Create a Neon database and connect the project to Vercel. Add these Vercel environment variables:

- `DATABASE_URL` — Neon pooled or direct Postgres connection string.
- `BETTER_AUTH_URL` — your deployed Vercel URL, for example `https://your-project.vercel.app`.
- `BETTER_AUTH_SECRET` — a long random secret.

**Root Directory** in Vercel must be `Northline-Procurement-Vercel-Neon` (folder path in this repo).

The Vercel build runs `npm run build`. The build applies all pending SQL migrations to Neon before the deployment is ready.
