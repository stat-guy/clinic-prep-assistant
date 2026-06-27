# Clinic Prep Assistant

Upload a patient's prior notes before an appointment → **Claude** summarizes the key history, flags follow-up questions, surfaces safety/missing-info/contradiction/stale flags, draws **Tufte sparklines** of trending labs/vitals, and generates a one-screen doctor briefing. A prep aid for a licensed clinician — **not** diagnosis or treatment advice.

Built for the **Ship NYC** hackathon.

## What it does

A primary-care physician (the demo persona: **Dr. Kai Wright**) picks a patient from a 100-patient panel, and in seconds gets a grounded **pre-visit briefing**:

- **Key history** — one-liner + active problems, current meds, allergies, recent changes (strictly from the notes).
- **Prioritized follow-up questions** — ranked high/med/low, each with a *why* traceable to the chart.
- **Watch-flags** — `safety | missing-info | contradiction | stale`, each citing its evidence.
- **Trend sparklines** — word-sized graphics of any measure repeated across visits (A1c, BP, eGFR, tumor markers…).

The model is told to **never diagnose, never prescribe, never invent** — anything absent is marked "not documented."

## Tech stack

| Layer | Tech |
|---|---|
| Agent / model | **Claude** (`claude-sonnet-4-6`) via the **Vercel AI SDK** `generateObject` (Zod-validated structured output) |
| Auth | **Auth0** (`@auth0/nextjs-auth0` v4) — gated to the authorized clinician |
| DB | **Supabase** (local Postgres: clinicians · patients · source_notes · appointments · briefings) |
| UI | **Next.js 15** App Router + React 19 + Tailwind v4 (shadcn-style components), mobile-first |
| Hosting | **Vercel** |
| Tests | **Vitest** (red/green TDD on the prompt + schema + orchestration) |

## Architecture (local Supabase ↔ Vercel)

Supabase runs **locally** and is reached by the deployed Vercel app through a **cloudflared tunnel** — all DB access is server-side (service role), so the browser only ever talks to Vercel.

```
Browser ──https──▶ Vercel (Next.js UI + API routes + Auth0 gate)
                     │                         │
                Claude (Anthropic)     cloudflared tunnel ──▶ localhost:55421
                                                              Supabase (Docker)
```

## Run locally

```bash
# 1. Local Supabase (Docker)
supabase start
node --env-file=.env.local scripts/seed.mjs      # 6 hero patients
bun scripts/gen-patients.mjs                       # +94 (healthy + chronic + staged cancers) = 100

# 2. Env — .env (your secrets) + .env.local (Supabase, auto-managed)
#    .env:        ANTHROPIC_API_KEY, VERCEL_TOKEN, AUTH0_CLIENT_SECRET, CLAUDE_MODEL
#    .env.local:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_SECRET

# 3. Tests + dev
npm test
npm run dev      # http://localhost:3007
```

## Auth0 setup (to enable the clinician gate)

1. Paste `AUTH0_CLIENT_SECRET` into `.env`.
2. In the Auth0 application, add **Allowed Callback URLs** = `<APP_URL>/auth/callback` and **Allowed Logout URLs** = `<APP_URL>` for both `http://localhost:3007` and the deployed URL.
3. Access is restricted to `ALLOWED_EMAILS` (default `a.kar.wright@gmail.com`). While `AUTH0_CLIENT_SECRET` is unset, the app stays open (so a misconfig can't black out a demo).

## Synthetic data only

Every patient is **fictional**. No real PHI ever touches the model or the database.
