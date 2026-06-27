# Clinic Prep Assistant — Buildable, Shareable Contract

> Build plan + contract for a ~1-day hackathon. Stack: **eve.dev** agent + **Claude** (direct Anthropic key) + **Supabase** + **Next.js/shadcn**, deployed on **Vercel**. Password: `shipnyc`.

## TL;DR

A primary-care doctor pastes (or picks) a patient's prior notes before a follow-up. In **under 30 seconds**, Claude returns a one-screen **pre-visit briefing** — faithful history summary, prioritized follow-up questions, and watch-flags — so the clinician walks in warm instead of cold. It is a **prep aid that surfaces what's already in the notes**, not a diagnostic or treatment tool. Single demo clinician, no auth, synthetic patients only.

---

## The person & the problem

**Dr. Marcus Bell, MD** — family medicine at **Eastside Community Health**, a busy FQHC. ~26 patients/day in 15-minute slots; roughly half are chronic-disease follow-ups (diabetes, hypertension, CHF, depression). His notes are scattered free-text across visits — some his, some from a covering colleague, some ER discharge summaries pasted in.

**The pain, concretely:** between patients he has ~**90 seconds** to "re-meet" the next person. Today that means scrolling three or four prior notes on a slow EHR tab, trying to recall *"did we ever recheck that A1c? what was the BP plan? is she still on the lisinopril we started?"* He walks in cold, re-asks questions the chart already answers, and discovers the overdue retinal exam *after* the patient has left. He doesn't need a second opinion — he needs the **last visit pre-digested into an agenda** before he opens the door.

---

## THE CONTRACT — input → output guarantee

**INPUT (what the clinician provides)**
- One patient's **prior notes** as free text — paste into a textarea or upload a `.txt` (`await file.text()`). Concatenated notes are fine.
- Optional one-line **reason for visit** (e.g. "diabetes 3-month follow-up").
- A patient picker selecting one of the seeded **synthetic** patients (no real PHI).

**OUTPUT (one structured briefing, four sections)**
1. **Key history summary** — faithful one-liner + active problems, current meds, allergies, recent changes *as stated in the notes*.
2. **Prioritized follow-up questions** — ranked `high/med/low`, each with a *why* traceable to the notes ("last note says she began skipping evening meds — confirm adherence").
3. **Watch-flags** — `{category, message, evidence}` where `category ∈ safety | missing-info | contradiction | stale`; each flag is grounded in a quote/note reference (or "absence of data").
4. **Doctor briefing** — one tight markdown paragraph + a 15-second visit agenda, with **Copy** and **Print** actions.

Produced as a fixed schema via Claude **structured outputs**, rendered into shadcn tabs.

**WHAT IT EXPLICITLY DOES NOT DO**
- ❌ No **diagnosis**, **treatment/medication recommendations**, test orders, or dosing.
- ❌ Does **not invent** findings, labs, or meds — it reorganizes and surfaces what the notes already contain; anything uncertain is phrased as a *question to confirm*, never an assertion.
- ❌ Does **not** advise the patient, and is **not a medical device**. Every screen carries: *"Prep aid for a licensed clinician. Not diagnosis or treatment advice. Verify against the chart."*
- ❌ Does **not** persist real PHI — synthetic patients in Supabase only.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser — Next.js + shadcn/ui   (single screen, 3 states)        │
│  input ──▶ processing ──▶ briefing  (Card / Textarea / Tabs /     │
│            (Skeletons)              Badge / Skeleton / sonner)     │
└───────────────┬──────────────────────────────────▲───────────────┘
                │ POST /api/prep                    │ NDJSON stream
                ▼ (same-origin Route Handler,       │ drives input→
                │  withEve(); no CORS)              │ processing→briefing
┌──────────────────────────────────────────────────────────────────┐
│  eve.dev durable agent   (Vercel Workflows — every step           │
│                           checkpointed, resumes via token)        │
│  instructions.md (system prompt, always-on)                       │
│  skills/prep_briefing.md          (markdown, load_skill on demand)│
│  tools:  get_patient_bundle.ts ──▶ save_briefing.ts (Zod-gated)   │
└───────┬──────────────────────────────────────┬───────────────────┘
        │ Claude call (DIRECT, no gateway)      │ read / write (service role)
        ▼                                       ▼
┌────────────────────────────────┐   ┌─────────────────────────────────┐
│ Claude via @ai-sdk/anthropic   │   │ Supabase (local Postgres)        │
│ ANTHROPIC_API_KEY              │   │ clinicians · patients ·          │
│ structured outputs (Zod)       │   │ source_notes · appointments ·    │
│ model: claude-sonnet-4-6 /     │   │ briefings   (service-role; RLS   │
│        claude-opus-4-8         │   │ off for demo)                    │
└────────────────────────────────┘   └─────────────────────────────────┘
```

---

## Tech stack & why each piece

| Piece | Why it earns its place |
|---|---|
| **eve.dev** (npm `eve`, Node 24+) | Filesystem-first durable agent: skills = markdown, tools = TypeScript, no registration. Sessions are checkpointed workflows on Vercel — a flaky model call costs a retry, not a corrupted chart. Same-origin HTTP API + `useEveAgent()` means no CORS plumbing. |
| **Claude** (`@ai-sdk/anthropic`, direct key) | Faithful clinical summarization + native **structured outputs** (Zod-validated). Direct provider reads `ANTHROPIC_API_KEY` and bypasses the AI Gateway — exactly what we have. |
| **Supabase** (local Postgres) | One-command local Postgres + Studio + typed client. JSONB for flexible synthetic clinical lists; service-role key for server-side tool access. |
| **Next.js + shadcn/ui** | Single-screen 3-state UI in hours: Card, Textarea, Tabs, Badge, Skeleton, sonner. `withEve()` mounts the agent same-origin. **Already installed.** |
| **Vercel** | `vercel deploy` to a production URL; eve's durability runtime *is* Vercel Workflows. **Key in hand.** |

---

## Data model

Five tables in `public`, all `uuid` PKs (`gen_random_uuid()`), separating **inputs** from the **generated output**. Full DDL: **`docs/schema.sql`**.

- **`clinicians`** — the single demo doctor; a `singleton` + `UNIQUE` constraint hard-caps the table at one row (idempotent bootstrap).
- **`patients`** — demographics as columns (`mrn`, name, `date_of_birth`, `sex`, contact) + three GIN-indexed `jsonb` arrays: `problem_list`, `medications`, `allergies`.
- **`source_notes`** — the INPUT: `note_date`, `author`, `note_type`, free-text `body`; indexed `(patient_id, note_date desc)` for the chronological pull.
- **`appointments`** — the upcoming visit: `scheduled_for`, `reason`, `visit_type`, `context`, `status` CHECK (`scheduled → prepped → completed/cancelled`).
- **`briefings`** — the OUTPUT: `summary/follow_ups/flags jsonb`, `briefing_md`, plus `model`, `status` CHECK (`pending → generating → complete/error`), `error`, token accounting, `created_at/updated_at`.

**Relationships & lifecycle:** cascade deletes from `patients`; each appointment has many briefings (newest by `created_at`). The tool inserts a `briefings` row `pending → generating`, feeds appointment context + `source_notes` to Claude, then writes `summary/follow_ups/flags/briefing_md` + token usage and sets `complete`. **Idempotent everywhere** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`, `text + CHECK` instead of enums) so re-runs and durable replays stay clean. A shared `set_updated_at()` trigger bumps `updated_at` on 4 tables. **RLS off for the no-auth demo** (tool uses the service-role key); migration ships a commented production lockdown recipe — mandatory before any real PHI.

---

## The agent

Decision-support agent that turns a chart into a grounded one-screen briefing. Faithful to eve: **skills = markdown, tools = TypeScript.** Full design: **`docs/agent-design.md`**.

- **Skill** — `agent/skills/prep_briefing.md`: the playbook ("summarize faithfully; never invent findings, diagnoses, or meds; phrase anything uncertain as a question; ground every flag in a note quote or 'absence of data'"). Loaded on demand via eve's built-in `load_skill`.
- **Tools** — `get_patient_bundle.ts` (read-only Supabase fetch of patient + notes + appointment) → model reasons → `save_briefing.ts` (final step: its `inputSchema` **embeds `BriefingSchema`, so Zod validates the model's structured output at the tool boundary** and upserts on a deterministic key — durable re-runs can't duplicate).
- **Structured output schema** (`agent/lib/schema.ts`, Zod):
  - `summary { oneLiner, activeProblems[], medications[], allergies[], recentChanges[] }`
  - `followUpQuestions[] { question, why, priority: high|med|low }`
  - `flags[] { category: safety|missing-info|contradiction|stale, message, evidence }`
  - `briefingMarkdown` (one-screen, ~40 lines)
  - *Avoid Zod `.min/.max/.regex`* — Anthropic structured outputs strip them; objects stay strict (`additionalProperties:false`).
- **Recommended Claude model** — **`claude-sonnet-4-6`** (direct, hyphenated) for demo latency (target < 15s); upgrade to **`claude-opus-4-8`** for maximum faithfulness. **Gateway ids use a dot, direct provider uses a hyphen — mixing them 400s.** We use the direct provider (`@ai-sdk/anthropic`, `ANTHROPIC_API_KEY`).
- **Safety/robustness** — branch on `stop_reason === "refusal"` / `NoObjectGeneratedError` before trusting output (a classifier can decline with HTTP 200 + off-schema JSON); on refusal, surface it, never fabricate. **Pre-warm `BriefingSchema` once** before the demo (first-call grammar compile is cached ~24h).

---

## Synthetic data — the 6-patient roster

Six synthetic patients, each chosen to demonstrate **one distinct capability**. Data: **`synthetic-data/patients.json`** (seed source) + **`synthetic-data/patients.md`** (human-readable). No real PHI.

| Patient | Snapshot | Capability demonstrated |
|---|---|---|
| **Rosa Delgado**, 58 | T2DM + HTN, A1c 7.1→7.9→8.4% on max metformin, home BP ~148/92 | **Trend reading across visits** — surfaces rising labs/vitals + a structured next-step prompt, not just the latest value |
| **Walter Okonkwo**, 76 | 11 chronic meds; urgent-care just added clarithromycin while on simvastatin 40mg | **Drug–drug interaction catch** (`safety`) — CYP3A4 rhabdomyolysis risk easy to miss in an 11-drug list |
| **Priya Nair**, 44 | Documented sulfa allergy (hives), yet last month TMP-SMX was prescribed for a UTI | **Cross-note contradiction** (`contradiction`) — reconciles the longitudinal record instead of carrying both facts forward |
| **Gene Hollis**, 63 | On lisinopril + atorvastatin; BMP/lipids >2yrs old, no BP since early 2024 | **Stale / missing-data detection** (`stale`/`missing-info`) — flags overdue monitoring an ACEi+statin expects |
| **Marcus Feeney**, 61 | Knee-pain refill visit; "pants looser" + low appetite ≈ ~18 lb unintended loss / 4 mo | **Red-flag buried in free text** — links an offhand line to a quantified drop and a targeted follow-up |
| **Tara Whitfield**, 34 | New palpitations/insomnia "on edge"; never screened; borderline-high TSH a year ago | **Two threads at once** — overdue anxiety/alcohol screen *and* a hyperthyroid mimic worth a repeat panel |

---

## The 90-second demo script (beat by beat)

Primary patient: **Rosa Delgado** (T2DM + HTN, 3-month follow-up). Her seeded notes carry the A1c trend, max-dose metformin, and persistently high home BP.

| Beat | Time | On screen | Said |
|---|---|---|---|
| 1. Cold open / the pain | 0:00–0:12 | Title → input state, disclaimer banner visible | "Eastside Community Health. Dr. Bell has 90 seconds before his next follow-up and four scattered notes. Here's what he uses instead." |
| 2. Pick patient | 0:12–0:22 | shadcn picker → **Rosa Delgado**; her notes auto-load into the Textarea (or drag a `.txt`) | "He picks the patient. Her prior notes load — exactly what's in the chart, nothing more." |
| 3. Generate | 0:22–0:30 | Click **Generate briefing** → processing state, Skeletons pulse | "One click." |
| 4. Summary | 0:30–0:48 | *Summary* tab — one-liner + active problems (T2DM, HTN) + meds (metformin) + recent changes | "In seconds: key history, faithfully summarized — including the A1c climbing 7.1 to 8.4 across visits, straight from the notes." |
| 5. Follow-ups | 0:48–1:05 | *Follow-ups* tab — ranked Badges; **high**: "Confirm adherence / barriers on max-dose metformin"; **high**: "Address home BP averaging 148/92 — above goal" | "Prioritized questions, each tied to a line in the chart. These are things to *ask*, not answers." |
| 6. Watch-flags | 1:05–1:18 | *Flags* tab — `safety`/`missing-info` Badges with evidence: "Home BP persistently >140/90, not yet addressed in plan" | "Watch-flags catch what you'd miss scrolling — grounded in the note, never invented." |
| 7. Briefing + disclaimer | 1:18–1:27 | *Briefing* paragraph + 15-sec agenda; **Copy** → sonner toast "Briefing copied"; banner re-emphasized | "A 15-second agenda he copies into his note. Always labeled: a prep aid for the clinician — not diagnosis." |
| 8. Close | 1:27–1:30 | Deployed Vercel URL + tech badges | "Live on Vercel. eve.dev, Claude, Supabase, shadcn. That's Clinic Prep." |

**Judge Q&A second-clicks (seeded, not in the 90s):** **Walter Okonkwo** (the CYP3A4 DDI safety catch) and **Priya Nair** (the sulfa-allergy contradiction) are the showstopper flags if asked "what else can it catch?"

---

## Hackathon build plan (empty repo → deployed)

Timeboxed ~5h core build. Check off in order.

- [ ] **M0 · Scaffold (0:00–0:20)** — `npx eve@latest init . --channel-web-nextjs`; `npm i @ai-sdk/anthropic`; confirm Node 24+; `npm run dev` boots blank.
- [ ] **M1 · Data model + seed (0:20–0:55)** — write `docs/schema.sql` → `supabase/migrations/0001_init.sql`; `supabase start`; `supabase db reset`; seed all 6 patients + `source_notes` from `synthetic-data/patients.json` into `supabase/seed.sql`; `supabase gen types`.
- [ ] **M2 · Agent core (0:55–1:40)** — `agent/lib/schema.ts` (Zod `BriefingSchema`), `prompt.ts` (system prompt: faithful, no invention, uncertainty→question), `bundle.ts` (`getPatientBundle`/`saveBriefing`), `db.ts` (Supabase service-role client).
- [ ] **M3 · Tools + skill + prove it (1:40–2:20)** — `tools/get_patient_bundle.ts`, `tools/save_briefing.ts` (Zod-gated upsert), `skills/prep_briefing.md`, `instructions.md`; run the `generateObject` fallback in a script → a schema-valid briefing prints for Rosa. **First green.**
- [ ] **M4 · UI 3-state flow (2:20–3:20)** — `page.tsx` state machine input→processing→briefing; patient picker, Textarea + `.txt` upload, Generate, Tabs (Summary/Follow-ups/Flags/Briefing), priority + category Badges, Skeletons.
- [ ] **M5 · Wire the agent (3:20–3:55)** — `app/api/prep/route.ts` proxies eve `POST /session` and pipes the NDJSON stream; client reads `fetch().body.getReader()`, renders the briefing off the `save_briefing` payload, finishes on `session.completed`.
- [ ] **M6 · Polish + safety (3:55–4:25)** — Copy/Print actions + sonner toast; persistent disclaimer banner; refusal/`NoObjectGeneratedError` graceful fallback; tech badges in the footer.
- [ ] **M7 · Deploy (4:25–4:55)** — push schema+seed to a hosted Supabase project; `vercel env add` the three keys; `vercel deploy --prod`; **pre-warm the schema** against the live URL; click through all 6 patients on the deployed link.
- [ ] **M8 · Submit (4:55–5:30)** — record the 1:30 video against the live link; write README (setup + the explicit "NOT a diagnostic tool" contract); fill the submission checklist.

---

## Setup commands (exact, end-to-end)

You **already have**: shadcn installed, an **`ANTHROPIC_API_KEY`**, and a **Vercel** account/token.

```bash
# 0. Prereqs
node -v                              # need Node 24+
npm i -g supabase                    # or: brew install supabase/tap/supabase
# Docker Desktop must be running for local Supabase

# 1. Scaffold eve agent + Next.js web channel into this repo, add the direct Anthropic provider
npx eve@latest init . --channel-web-nextjs
npm install @ai-sdk/anthropic        # bypasses the AI Gateway; reads ANTHROPIC_API_KEY

# 2. Env (local)
printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" >> .env.local
# after `supabase start` (step 3), also add to .env.local:
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key printed by `supabase start`>

# 3. Local Supabase: init, start, migrate, seed
supabase init
supabase start                       # boots Postgres + Studio; prints anon + service_role keys
#   -> put DDL in supabase/migrations/0001_init.sql      (= docs/schema.sql)
#   -> put 6 patients + notes in supabase/seed.sql       (from synthetic-data/patients.json)
supabase db reset                    # applies migrations + seed.sql (idempotent)

# 4. Generate the typed DB client
supabase gen types typescript --local > app/lib/database.types.ts

# 5. Run everything locally (ONE dev server: Next.js + shadcn UI + eve mounted via withEve)
npm run dev                          # http://localhost:3000  (eve API same-origin under /eve/v1/*)

# 6. Pre-warm the structured-output schema once (avoids the first-call grammar-compile stall)
curl -s -X POST http://localhost:3000/api/prep \
  -H 'content-type: application/json' \
  -d '{"patientId":"rosa-delgado-t2dm-htn"}' >/dev/null

# 7. Deploy to Vercel (prod needs a *hosted* Supabase; local Postgres isn't reachable from Vercel)
supabase link --project-ref <your-project-ref>
supabase db push                     # apply the same migration to hosted Postgres
# (seed the hosted DB once: psql "$HOSTED_DB_URL" -f supabase/seed.sql)
vercel link
vercel env add ANTHROPIC_API_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel deploy --prod                 # production URL for the demo + submission
```

`model: anthropic("claude-sonnet-4-6")` (hyphenated, direct) in `agent/agent.ts`; switch to `claude-opus-4-8` for max faithfulness.

---

## Submission checklist

- [ ] **GitHub repo** — public `clinic-prep-assistant`: eve agent (`agent/instructions.md`, `agent/agent.ts`, `agent/skills/prep_briefing.md`, `agent/tools/get_patient_bundle.ts`, `agent/tools/save_briefing.ts`, `agent/lib/`), Next.js + shadcn UI, `supabase/migrations` + `seed.sql`, `docs/schema.sql`, `docs/agent-design.md`, `synthetic-data/`, README with setup + the explicit "**NOT a diagnostic tool**" contract.
- [ ] **1:30 video** — the beat-by-beat script above, recorded end-to-end against the deployed link (doubles as the live-demo fallback).
- [ ] **Deploy link** — Vercel production URL; `ANTHROPIC_API_KEY` + Supabase keys set in env; single demo clinician, no auth.
- [ ] **Tech list** — **eve.dev** (durable agent + skill + tools), **Claude / Anthropic** (`@ai-sdk/anthropic`, own key, no Gateway), **Supabase** (Postgres, seeded synthetic patients), **shadcn/ui** (single-screen 3-state UI), **Vercel** (deploy + Workflows durability).
- [ ] **Password** — `shipnyc`

---

## Risks & cut-lines

**Risks & mitigations**

| Risk | Mitigation |
|---|---|
| **Claude invents a med/lab/diagnosis** | Zod schema + system prompt: *summarize faithfully, never invent, phrase uncertainty as a question, ground every flag in evidence*. Demo only on seeded patients whose notes you've read. |
| **First-call latency** (grammar compile) | Pre-warm `BriefingSchema` once before going on stage; keep notes short. |
| **Direct-Anthropic wiring** (default path is the AI Gateway) | `npm i @ai-sdk/anthropic`; `model: anthropic("claude-sonnet-4-6")` (hyphen); `ANTHROPIC_API_KEY` in Vercel env. Dot = gateway, hyphen = direct — don't mix. |
| **eve on its own origin → CORS** | `withEve()` + a same-origin `/api/prep` Route Handler doing the POST-session → stream handshake; pipe NDJSON to the browser. |
| **Safety refusal returns 200 + off-schema** | Branch on `stop_reason === "refusal"` / catch `NoObjectGeneratedError`; show a graceful fallback, never fabricate. |
| **Durable re-run duplicates a briefing** | `save_briefing` upserts on a deterministic key; `get_patient_bundle` is read-only (naturally safe). |
| **Prod can't reach local Supabase** | Push schema + seed to a hosted Supabase project for the deploy; keep local for dev. |
| **Demo Wi-Fi / live flake** | The 1:30 video is the pre-recorded fallback of the exact flow. |
| **Read as a medical device** | Persistent on-screen disclaimer + README "What this is NOT"; output only summarizes and asks. |
| **PHI concern** | Synthetic patients only; no real-data path; stated in README and on screen. RLS-off is demo-only — production lockdown recipe ships commented in the migration. |

**Cut hard — say no in the README:** ❌ auth / multi-user / Auth0 (single hardcoded clinician) · ❌ email/Resend, Sentry · ❌ PDF/image/scanned-note parsing (`.txt`/paste only; PDF is a "future" line) · ❌ write-back / ordering / e-prescribing · ❌ real EHR/FHIR, real PHI, BAA-gated data · ❌ streaming polish, fancy animation, dark mode · ❌ RAG/embeddings/vector search (notes fit in context — pass inline) · ❌ human-in-the-loop tool gating (no writes ⇒ none needed).

**Definition of done:** pick/paste a seeded patient → **Generate** → schema-valid four-section briefing renders in **< 30s** (target < 15s on Sonnet) on the **deployed Vercel link**, zero invented meds/labs/diagnoses, agenda readable in ≤ 15s — plus repo + 1:30 video + live link + tech list + `shipnyc`.
