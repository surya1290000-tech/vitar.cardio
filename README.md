# VITAR

Cardiac health wearable platform built with Next.js, Neon PostgreSQL, Stripe, and AI-assisted care workflows.

## Project Status

**This project is currently under development.**

VITAR is not yet production-complete. Core modules are being built and refined in phases, including:

- user authentication and profile flows
- health profile and dashboard features
- support desk and care center
- admin portal and automation studio
- AI workflows for support, assistant triage, and health monitoring
- payment and subscription flows

Expect active changes in UI, backend services, database schema, and workflow behavior while development continues.

## Current Stack

- Next.js
- TypeScript
- Neon PostgreSQL
- Stripe
- Resend / email integrations
- Custom in-app automation engine

## Main App Areas

- Landing page
- Signup / login / verification
- User dashboard
- Care center
- Admin dashboard
- Admin support desk
- Admin automation studio

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` and set the required values:

- `DATABASE_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `NEXT_PUBLIC_ADMIN_PASSWORD` or admin server secret
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

You can use `.env.example` as the starting reference.

### 3. Set up the database

Run the SQL from:

```text
database/setup.sql
```

in the Neon SQL Editor for the same database used by your `DATABASE_URL`.

### 4. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Important Admin Routes

- Admin dashboard: `/admin`
- Admin support desk: `/admin/support`
- Admin automation studio: `/admin/automation`

## Development Notes

- The project is being actively developed and tested.
- Some modules may still be experimental or partially automated.
- Database schema may evolve as new workflows and health features are added.
- AI workflow tools are internal and custom-built; they are not yet a full visual workflow system like n8n.

## Repository Note

This repository reflects ongoing development work. If you are pulling changes, review the database schema and environment variables before running the app.
