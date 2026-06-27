# Clinic Prep Assistant — Build Summary

**Live:** https://clinic-prep-assistant.vercel.app
**Submission password:** `shipnyc`
**Demo clinician:** Dr. Kai Wright

## What it is

A pre-visit prep tool for a primary-care physician. Pick a patient (or paste raw notes) → **Claude** reads the prior notes and returns a grounded, one-screen **briefing**: key history, prioritized follow-up questions, safety/missing-info/contradiction/stale flags, and **Tufte sparklines** of trending labs/vitals. It is a prep aid — **never** diagnosis or treatment advice, and it never invents facts (anything absent is "not documented").

## Technologies used

- **Claude** (`claude-sonnet-4-6`) via the **Vercel AI SDK** (`generateObject`, Zod-validated structured output)
- **Supabase** (local Postgres: clinicians · patients · source_notes · appointments · briefings)
- **Session gate** — single-clinician email+password (HMAC-signed cookie), enforced over the UI and the data APIs (Auth0 SDK also integrated)
- **Next.js 15** (App Router) + **React 19** + **Tailwind v4**, shadcn-style components, mobile-first (iPhone safe-area aware)
- **Vercel** (hosting + deploy) · **cloudflared** (tunnels the local DB to the cloud app)
- **Vitest** (red/green TDD on the prompt builder, schema, and orchestration — 11 tests)

## Architecture

Supabase runs **locally** and is reached by the deployed Vercel app over a **cloudflared tunnel**; all DB access is server-side (service role), so the browser only ever talks to Vercel.

```
Browser ─https─▶ Vercel (Next.js UI + API + session gate)
                  │                      │
             Claude (Anthropic)   cloudflared tunnel ─▶ localhost:55421 Supabase (Docker)
```

For demo speed (and to stay within serverless time limits), briefings are **generated once and cached**; all 100 patients are pre-warmed so every click is instant. `{fresh:true}` forces a live regeneration.

## Synthetic data (100 fictional patients — no real PHI)

- **6 hero charts** (full depth + multi-visit notes), each demonstrating a capability:
  - Rosa Delgado — A1c trend 7.1→7.9→8.4 on max metformin (titration decision)
  - **Walter Okonkwo — hidden clarithromycin + simvastatin interaction** (the showcase flag)
  - Priya Nair — sulfa allergy vs. a later Bactrim prescription (contradiction)
  - Gene Hollis — overdue labs on an ACE inhibitor (stale/missing-info)
  - Marcus Feeney — unintentional weight loss buried in a refill note (red flag)
  - Tara Whitfield — anxiety vs. hyperthyroid mimic (medical mimic)
- **94 generated charts** across all life stages: healthy (peds → senior), chronic disease, and **cancers** (breast, colorectal, lung, prostate, lymphoma, melanoma, leukemia, thyroid, pancreatic) at stages I–IV / on-treatment / survivorship.

## How to demo (90s)

1. Open the live URL → pick **Walter Okonkwo** → briefing returns instantly.
2. Point at the **safety flag**: clarithromycin + simvastatin interaction it caught inside an 11-med list.
3. Pick **Rosa Delgado** → the **A1c sparkline** (7.1→7.9→8.4) tells the "rising despite max therapy" story at a glance.
4. (Optional) "Paste raw notes" → live generation on arbitrary notes.

## Auth (gate to the clinician)

- Gated to a single clinician credential (`APP_EMAIL` / `APP_PASSWORD`), enforced in middleware over the UI **and** `/api/patients` + `/api/prep` — no patient data without signing in. Login only (no signup), no external dashboard config.

## Caveats

- The public link is live while the laptop + Supabase + cloudflared tunnel are running (confirmed up for the demo).
- All data is synthetic; no real patient information ever reaches the model or the database.
