# Agent Design

## Recommended model
Claude Opus 4.8 for the live demo. Gateway id: `anthropic/claude-opus-4.8` (eve default, dotted). Direct id (@ai-sdk/anthropic): `claude-opus-4-8` (hyphenated). Why: this is high-stakes clinical reasoning where the whole product depends on faithful grounding and hard guardrails ("never diagnose/prescribe/invent; flag missing/stale/contradictory"). Opus 4.8 has the strongest instruction-following and clinical reasoning of the tier, supports structured outputs, and has a 1M-token context window — important when concatenating many prior notes. With streaming, its latency is fine for a demo. Documented fallback if the team explicitly wants lower latency/cost: Claude Sonnet 4.6 (`anthropic/claude-sonnet-4.6` / `claude-sonnet-4-6`) — also 1M context and structured-output-capable, the cleanest perceived-latency option via streamObject. Avoid Haiku 4.5 here: only a 200K context window (risky when concatenating many notes) and weaker adherence to the never-invent/never-diagnose guardrails. All three support structured outputs; warm the schema once before the demo to absorb the one-time grammar-compilation latency.

## System prompt

```
You are a clinical PREP assistant for a primary care physician (PCP). You produce a pre-visit briefing that is decision support for a licensed clinician. You are not a clinician; your output is not a diagnosis, not an order, and not a medical-record entry.

GROUNDING (non-negotiable)
- Use ONLY the provided patient bundle (prior notes, medications, labs, allergies, upcoming visit, and the bundle's `asOf`/today's date). It is your single source of truth.
- NEVER diagnose. NEVER prescribe or suggest a specific drug or dose change. NEVER invent facts, values, dates, or history that are not in the bundle.
- If something is not in the bundle, treat it as unknown. Write "not documented" rather than guessing or filling the gap.
- Prefer the patient's own documented numbers and dates over generalities.

FLAGGING (always, each with cited evidence — a quote/note reference, or "absence of data")
- missing-info: clinically relevant data absent from the bundle (e.g., no recent A1c for a diabetic; no BP at the last visit).
- stale: data old enough to be unreliable relative to the visit date (e.g., labs older than ~12 months; a med list not updated since a hospitalization).
- contradiction: conflicting statements across notes/meds/labs (e.g., a med listed active but discontinued in a later note; an allergy contradicted by a current prescription).
- safety: anything a clinician should not miss before the visit (e.g., a currently listed medication that conflicts with a documented severe allergy; a critically abnormal recent lab). Surface the concern; do NOT recommend the treatment.

STYLE
- Concise and scannable. The briefing must fit one screen (~40 lines). Lead with the one-liner. Use short bullets, not prose.

OUTPUT
- Return the structured object exactly matching the schema: summary { oneLiner, activeProblems, medications, allergies, recentChanges }, followUpQuestions [{ question, why, priority }], flags [{ category, message, evidence }], briefingMarkdown.
- followUpQuestions are items for the clinician to ask or confirm, each with a one-line rationale and a priority (high|med|low).
- briefingMarkdown is the one-screen rendering of the above.
- If you cannot ground a safe briefing in the bundle, say so in flags rather than fabricating content.
```

## Output schema (JSON)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ClinicalPrepBriefing",
  "description": "Grounded, one-screen pre-visit prep briefing for a PCP. Decision support only.",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "summary": {
      "type": "object",
      "additionalProperties": false,
      "description": "Faithful snapshot drawn only from the patient bundle.",
      "properties": {
        "oneLiner": {
          "type": "string",
          "description": "One sentence: age/sex, dominant active problem, reason for the upcoming visit."
        },
        "activeProblems": {
          "type": "array",
          "description": "Active problems documented in the bundle.",
          "items": { "type": "string" }
        },
        "medications": {
          "type": "array",
          "description": "Current medications (name + dose) as documented; do not infer.",
          "items": { "type": "string" }
        },
        "allergies": {
          "type": "array",
          "description": "Documented allergies and reactions.",
          "items": { "type": "string" }
        },
        "recentChanges": {
          "type": "array",
          "description": "Recent meaningful changes (new/stopped meds, new diagnoses, recent abnormal labs) from the bundle.",
          "items": { "type": "string" }
        }
      },
      "required": ["oneLiner", "activeProblems", "medications", "allergies", "recentChanges"]
    },
    "followUpQuestions": {
      "type": "array",
      "description": "Questions for the clinician to ask or confirm at the visit. Not advice.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "question": { "type": "string", "description": "What to ask/verify at the visit." },
          "why": { "type": "string", "description": "One-line rationale grounded in the bundle." },
          "priority": { "type": "string", "enum": ["high", "med", "low"] }
        },
        "required": ["question", "why", "priority"]
      }
    },
    "flags": {
      "type": "array",
      "description": "Safety / missing-info / stale / contradiction flags. Every flag must cite evidence.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "category": {
            "type": "string",
            "enum": ["safety", "missing-info", "contradiction", "stale"],
            "description": "safety = must-not-miss; missing-info = relevant data absent; contradiction = conflicting records; stale = data too old to trust vs. visit date."
          },
          "message": { "type": "string", "description": "The concern, stated plainly. Do not recommend treatment." },
          "evidence": { "type": "string", "description": "Quote or note reference from the bundle, or 'absence of data'." }
        },
        "required": ["category", "message", "evidence"]
      }
    },
    "briefingMarkdown": {
      "type": "string",
      "description": "Single-screen markdown briefing (~40 lines): lead with the one-liner, short bullets, scannable."
    }
  },
  "required": ["summary", "followUpQuestions", "flags", "briefingMarkdown"]
}
```

## Skill

---
name: prep_briefing
description: Use to prepare a PCP for an upcoming patient visit. Pulls the patient's chart bundle and produces a grounded, one-screen pre-visit briefing (summary, follow-up questions, and safety / missing-info / stale / contradiction flags). Decision support only — never diagnoses, prescribes, or invents facts.
---

# Pre-visit briefing procedure

You are a clinical PREP assistant for a primary care physician. The briefing is decision support for a licensed clinician — not a diagnosis, not an order, not a chart entry.

## Steps
1. Call `get_patient_bundle` with the patient id. The returned bundle (notes, medications, labs, allergies, upcoming visit, and an `asOf` date) is your ONLY source of truth.
2. Read across the bundle and build the briefing:
   - **summary.oneLiner** — age/sex, dominant active problem, reason for the upcoming visit, in one sentence.
   - **summary.activeProblems / medications / allergies / recentChanges** — short, faithful bullets taken straight from the bundle.
   - **followUpQuestions** — things the clinician should ask or confirm at the visit; each with a one-line `why` and a `priority` (high|med|low).
   - **flags** — every concern, each with `evidence` (a quote / note reference, or "absence of data"):
     - `safety` — must-not-miss before the visit (e.g., a listed med that conflicts with a documented severe allergy; a critically abnormal recent lab). Surface it; do not recommend treatment.
     - `missing-info` — clinically relevant data not in the bundle.
     - `stale` — data too old to trust vs. the visit date (e.g., labs older than ~12 months).
     - `contradiction` — conflicting notes / meds / labs.
   - **briefingMarkdown** — the one-screen rendering (~40 lines; lead with the one-liner; short bullets).
3. Call `save_briefing` exactly once with `{ patientId, briefing }`. Its schema validates your output and persists it. This is your final step.

## Hard rules
- Ground everything in the bundle. If it is not in the bundle, it is unknown — write "not documented", never a guess.
- NEVER diagnose. NEVER prescribe or suggest a drug/dose change. NEVER invent values, dates, or history.
- Be concise and scannable; the briefing must fit one screen.
- Prefer the patient's documented numbers and dates over generalities.

## Tools

```ts
// ── agent/lib/db.ts ───────────────────────────────────────────────
// Standard Node Supabase client (NOT an eve API). Tools run in the app
// runtime with full process.env and can import from lib/.
// npm i @supabase/supabase-js
import { createClient } from "@supabase/supabase-js";
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-side; never ship to the browser
);

// ── agent/lib/schema.ts ───────────────────────────────────────────
import { z } from "zod";
export const Priority = z.enum(["high", "med", "low"]);
export const BriefingSchema = z.object({
  summary: z.object({
    oneLiner: z.string(),
    activeProblems: z.array(z.string()),
    medications: z.array(z.string()),
    allergies: z.array(z.string()),
    recentChanges: z.array(z.string()),
  }),
  followUpQuestions: z.array(z.object({
    question: z.string(),
    why: z.string(),
    priority: Priority,
  })),
  flags: z.array(z.object({
    category: z.enum(["safety", "missing-info", "contradiction", "stale"]),
    message: z.string(),
    evidence: z.string(),
  })),
  briefingMarkdown: z.string(),
});
export type Briefing = z.infer<typeof BriefingSchema>;

// ── agent/lib/bundle.ts ───────────────────────────────────────────
// The two requested signatures live here as plain functions so the eve
// tools AND the generateObject fallback reuse identical DB logic.
import { db } from "./db";
import type { Briefing } from "./schema";

export interface PatientBundle {
  patientId: string;
  asOf: string;                                  // ISO date the bundle was assembled (stale-flag reference)
  notes: Array<{ id: string; authoredAt: string; author: string; text: string }>;
  medications: Array<{ name: string; dose: string; startedAt: string | null; active: boolean }>;
  labs: Array<{ name: string; value: string; unit: string | null; resultedAt: string; refRange: string | null }>;
  allergies: Array<{ substance: string; reaction: string | null; severity: string | null }>;
  upcomingVisit: { scheduledAt: string; reason: string | null; provider: string | null } | null;
}

export async function getPatientBundle(patientId: string): Promise<PatientBundle> {
  const [notes, meds, labs, allergies, visit] = await Promise.all([
    db.from("notes").select("id, authored_at, author, text").eq("patient_id", patientId)
      .order("authored_at", { ascending: false }),
    db.from("medications").select("name, dose, started_at, active").eq("patient_id", patientId),
    db.from("labs").select("name, value, unit, resulted_at, ref_range").eq("patient_id", patientId)
      .order("resulted_at", { ascending: false }),
    db.from("allergies").select("substance, reaction, severity").eq("patient_id", patientId),
    db.from("visits").select("scheduled_at, reason, provider").eq("patient_id", patientId)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  const err = notes.error ?? meds.error ?? labs.error ?? allergies.error ?? visit.error;
  if (err) throw new Error(`getPatientBundle failed: ${err.message}`);
  return {
    patientId,
    asOf: new Date().toISOString(),
    notes: (notes.data ?? []).map(n => ({ id: n.id, authoredAt: n.authored_at, author: n.author, text: n.text })),
    medications: (meds.data ?? []).map(m => ({ name: m.name, dose: m.dose, startedAt: m.started_at, active: m.active })),
    labs: (labs.data ?? []).map(l => ({ name: l.name, value: l.value, unit: l.unit, resultedAt: l.resulted_at, refRange: l.ref_range })),
    allergies: (allergies.data ?? []).map(a => ({ substance: a.substance, reaction: a.reaction, severity: a.severity })),
    upcomingVisit: visit.data
      ? { scheduledAt: visit.data.scheduled_at, reason: visit.data.reason, provider: visit.data.provider }
      : null,
  };
}

export async function saveBriefing(patientId: string, briefing: Briefing): Promise<{ id: string }> {
  // IDEMPOTENT: durable-workflow steps re-run on crash/redeploy, so upsert on a
  // deterministic key instead of insert — a re-run can't create a duplicate.
  // (Key on (patient_id, visit_id) instead if you want one briefing per visit.)
  const { data, error } = await db
    .from("briefings")
    .upsert(
      { patient_id: patientId, briefing, updated_at: new Date().toISOString() },
      { onConflict: "patient_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`saveBriefing failed: ${error.message}`);
  return { id: data.id };
}

// ── agent/tools/get_patient_bundle.ts ─────────────────────────────
// Filename -> model-facing tool name `get_patient_bundle`. Read-only.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getPatientBundle } from "../lib/bundle";

export default defineTool({
  description: "Fetch the patient's chart bundle (notes, medications, labs, allergies, upcoming visit) for visit prep. Read-only; safe to retry.",
  inputSchema: z.object({ patientId: z.string().uuid() }),
  async execute({ patientId }, ctx) {
    // ctx.session.auth available for per-tenant scoping in a multi-clinic deploy.
    return await getPatientBundle(patientId); // must be JSON-serializable
  },
});

// ── agent/tools/save_briefing.ts ──────────────────────────────────
// Final step. inputSchema embeds BriefingSchema, so eve/Zod schema-validates
// the model's structured output at the tool boundary, then persists it.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { BriefingSchema } from "../lib/schema";
import { saveBriefing } from "../lib/bundle";

export default defineTool({
  description: "Persist the final structured prep briefing. Call exactly once, as the last step. `briefing` is validated against the briefing schema.",
  inputSchema: z.object({
    patientId: z.string().uuid(),
    briefing: BriefingSchema,
  }),
  async execute({ patientId, briefing }) {
    return await saveBriefing(patientId, briefing); // idempotent upsert
  },
});
```

## Pipeline

# Clinic Prep Assistant — eve.dev agent (end-to-end)

Decision-support agent that turns a patient's chart into a grounded, one-screen pre-visit briefing for a PCP. Faithful to eve's filesystem-first model: **skills = markdown, tools = TypeScript**, model routed through the Vercel AI Gateway, with a Vercel AI SDK `generateObject` fallback so the team is never blocked on eve's exact agent-loop API.

## Project layout (eve)
```
clinic-prep-assistant/
  agent/
    instructions.md            # = the systemPrompt (always-on) + "use your tools" directive
    agent.ts                   # model + reasoning config
    skills/
      prep_briefing.md         # the skillMarkdown (loaded on demand via load_skill)
    tools/
      get_patient_bundle.ts    # read-only Supabase fetch (thin wrapper over lib/bundle)
      save_briefing.ts         # final step: schema-validates + persists the briefing
    lib/
      db.ts                    # Supabase client (standard Node, not an eve API)
      bundle.ts                # getPatientBundle / saveBriefing (the exact signatures)
      schema.ts                # BriefingSchema (Zod) — shared by tool + fallback
      prompt.ts                # SYSTEM_PROMPT export
    channels/
      eve.ts                   # REAL auth policy (PHI: never none()/placeholder in prod)
  app/                         # Next.js + shadcn UI (withEve)
    api/prep/route.ts          # proxies eve POST /session -> pipes NDJSON stream
    page.tsx                   # input -> processing -> briefing state machine
```

## Model config (`agent/agent.ts`)
```ts
import { defineAgent } from "eve";
export default defineAgent({
  model: "anthropic/claude-opus-4.8", // GATEWAY id = dotted. Auth: AI_GATEWAY_API_KEY or `vercel link` OIDC
  reasoning: "high",
});
```
Direct-Anthropic alternative (reads `ANTHROPIC_API_KEY`): `npm i @ai-sdk/anthropic`, then `model: anthropic("claude-opus-4-8")` — note the **hyphenated** id. Gateway = dot, direct = hyphen; mixing them 400s.

## How the structured output is produced
**Primary (eve-native, the tool-forcing trick):** the agent calls `get_patient_bundle`, reasons, then calls `save_briefing({ patientId, briefing })` as its final step. `save_briefing`'s `inputSchema` embeds `BriefingSchema`, so eve/Zod **validates the model's structured output at the tool boundary** and persists it in the same step. The UI reads the `briefing` object off the `save_briefing` action payload on the NDJSON stream.

**Fallback (Vercel AI SDK `generateObject` — use if eve's agent-loop/model-invocation API is unconfirmed, or you want a deterministic one-shot for the demo):**
```ts
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, NoObjectGeneratedError } from "ai";
import { BriefingSchema } from "@/agent/lib/schema";
import { getPatientBundle, saveBriefing } from "@/agent/lib/bundle";
import { SYSTEM_PROMPT } from "@/agent/lib/prompt";

export async function runPrep(patientId: string) {
  const bundle = await getPatientBundle(patientId);
  try {
    const { object } = await generateObject({
      model: anthropic("claude-opus-4-8"),          // hyphenated, direct provider
      schema: BriefingSchema,
      schemaName: "ClinicalPrepBriefing",
      system: SYSTEM_PROMPT,
      prompt: `Today is ${bundle.asOf}. The patient bundle below is your ONLY source of truth:\n${JSON.stringify(bundle, null, 2)}`,
      providerOptions: { anthropic: { structuredOutputMode: "auto" } },
    });
    await saveBriefing(patientId, object);          // idempotent upsert
    return object;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) { /* refusal/parse failure — surface, don't fabricate */ }
    throw e;
  }
}
```

## End-to-end pipeline
1. **Paste/upload** — clinician pastes notes or selects a patient in the shadcn UI.
2. **Store note** — UI writes the raw note(s) to Supabase (`notes` table) so the bundle is canonical and auditable.
3. **Agent run** — UI POSTs to `/api/prep`, which calls eve `POST /eve/v1/session` (durable session created; returns `continuationToken` + `x-eve-session-id`). The agent runs `get_patient_bundle` → reasons → `save_briefing`.
4. **Structured output** — `save_briefing` validates the briefing against `BriefingSchema` (Zod) before it can persist; an invalid shape never reaches the DB.
5. **Store briefing** — `saveBriefing` upserts into `briefings` (idempotent).
6. **Stream to shadcn** — the route handler pipes eve's `GET /eve/v1/session/:id/stream` NDJSON straight back; the client reads `fetch().body.getReader()` + `TextDecoder`, splits on `\n`, and drives `input → processing → briefing`. Render the briefing from the `save_briefing` action's `briefing` input; finish on `session.completed`.

## How eve's durability helps if a model call fails mid-run
eve runs each session as a **durable workflow on Vercel Workflows** — every step is checkpointed and the event log is replayed to reconstruct state. If the model call dies mid-run (crash, redeploy, timeout): the already-completed `get_patient_bundle` step is **replayed from its recorded result** (no second DB read), the session pauses at `session.waiting`, and it **resumes from the failed step via the `continuationToken`** — the client just re-attaches to the stream (reconnect via `startIndex`). The interrupted step **re-runs**, which is the one hazard: `save_briefing` therefore **upserts on a deterministic key**, so a re-run can't write a duplicate briefing. Read-only `get_patient_bundle` is naturally safe. Net effect: a flaky model call costs a retry, not a corrupted chart or a lost session.

## Refusal & schema warm-up (clinical content trips false positives)
- Always branch on `stop_reason === "refusal"` (Anthropic SDK) / `NoObjectGeneratedError` (AI SDK) **before** trusting output — a safety classifier can decline with HTTP 200 and return non-schema-matching JSON. On refusal, surface it; never fabricate a briefing.
- First call with a new schema pays one-time grammar-compilation latency (cached ~24h). **Warm `BriefingSchema` once before the live demo.**

## Zod equivalent of the output schema (`agent/lib/schema.ts`)
```ts
import { z } from "zod";
export const Priority = z.enum(["high", "med", "low"]);
export const BriefingSchema = z.object({
  summary: z.object({
    oneLiner: z.string().describe("Age/sex, dominant active problem, reason for visit — one sentence."),
    activeProblems: z.array(z.string()),
    medications: z.array(z.string()),
    allergies: z.array(z.string()),
    recentChanges: z.array(z.string()),
  }),
  followUpQuestions: z.array(z.object({
    question: z.string(),
    why: z.string(),
    priority: Priority,
  })),
  flags: z.array(z.object({
    category: z.enum(["safety", "missing-info", "contradiction", "stale"]),
    message: z.string(),
    evidence: z.string().describe("Quote/note reference grounding the flag, or 'absence of data'."),
  })),
  briefingMarkdown: z.string().describe("One-screen markdown briefing (~40 lines)."),
});
export type Briefing = z.infer<typeof BriefingSchema>;
```
Avoid Zod `.min()/.max()/.regex()` — Anthropic structured outputs strip those (they're enforced client-side at most). Keep `additionalProperties:false` (Zod objects are strict by default in the helper path).

## PHI / compliance caveats (do not skip)
- eve's **default HTTP channel is fail-closed** in prod (`[vercelOidc(), localDev()]`). A browser PHI app **must** author `agent/channels/eve.ts` with a real auth policy (session cookie/JWT/OIDC). The documented placeholder is `placeholderAuth()` (returns a setup 401) — there is **no `none()` helper**; never ship `none()`/placeholder for PHI.
- Vet AI Gateway / Anthropic **BAA + data-processing/retention** posture before sending real patient data. Add an AI-disclosure line, and minimize tool outputs (don't return secrets or unbounded PHI).
- Requires **Node 24+**; eve is in beta.
