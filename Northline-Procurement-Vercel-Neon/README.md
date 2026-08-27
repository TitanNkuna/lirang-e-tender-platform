# Northline Procurement

A self-hosted procurement desk for issuing tender sheets, collecting contractor returns, comparing submissions and managing awards.

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

The Vercel build runs `npm run build`. The build applies all pending SQL migrations to Neon before the deployment is ready.

After deployment, open `/login`, create a procurement account, choose the procurement role during onboarding, and create or edit templates.

## Templates

The template library includes editable starter templates for:

- Structural steel
- Facilities maintenance
- Managed IT services
- Facilities SLA
- IT Support SLA
- General Services SLA

Every saved template can be edited. Field labels, field types, required status, help text, select options, who fills a field, line-item columns, column types, and example rows can all be changed before saving.

## Security

All application data is scoped to the authenticated user on the server. Procurement-only actions verify the user's procurement profile, and contractor tender access is checked against tender visibility and invitations.

Do not commit `.env` files or database credentials.
