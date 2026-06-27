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
| Auth | **Session gate** — single-clinician email+password, HMAC-signed httpOnly cookie, enforced in middleware on every route (UI + data APIs). Login only, no signup. |
| DB | **Supabase** (local Postgres: clinicians · patients · source_notes · appointments · briefings) |
| UI | **Next.js 15** App Router + React 19 + Tailwind v4 (shadcn-style components), mobile-first |
| Hosting | **Vercel** |
| Tests | **Vitest** (red/green TDD on the prompt + schema + orchestration) |

## Architecture (local Supabase ↔ Vercel)

Supabase runs **locally** and is reached by the deployed Vercel app through a **cloudflared tunnel** — all DB access is server-side (service role), so the browser only ever talks to Vercel.

```
Browser ──https──▶ Vercel (Next.js UI + API routes + session gate)
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

## Auth (the clinician gate)

Access is gated by a single authorized clinician credential (`APP_EMAIL` + `APP_PASSWORD`),
enforced in `middleware.ts` over **every** route — including `/api/patients` and `/api/prep` — so
no UI, patient list, or generation is reachable without a valid HMAC-signed session cookie. There
is **no signup** — login only. (The Auth0 SDK is also integrated in the repo, but the enforced gate
is this self-contained one, so no external dashboard configuration is ever required.)

## Synthetic data only

Every patient is **fictional**. No real PHI ever touches the model or the database.
