-- ============================================================================
-- Clinic Prep Assistant — initial schema
-- Target: a fresh local Supabase Postgres (schema `public`).
-- Scope:  primary-care follow-up prep, ONE demo clinician, NO auth.
--
-- This migration is IDEMPOTENT: it can be re-run safely. It uses
-- CREATE ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS
-- + CREATE TRIGGER, and ON CONFLICT DO NOTHING for the bootstrap row.
--
-- Place at: supabase/migrations/0001_init_clinic_prep.sql
-- Apply with: supabase db reset   (or)   supabase migration up
-- Verified: applies cleanly + re-applies cleanly on postgres:16 (Supabase engine).
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto. (On modern Postgres it is also provided
-- by core, but pgcrypto guarantees availability everywhere.)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- updated_at trigger function (shared by every table that tracks updated_at)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- 1) clinicians — the single demo clinician
-- ============================================================================
-- `singleton` + UNIQUE enforces that AT MOST ONE clinician row can ever exist
-- (the demo doctor). Drop the column/constraint if you later support many.
create table if not exists public.clinicians (
  id          uuid primary key default gen_random_uuid(),
  singleton   boolean not null default true,
  full_name   text not null,
  credentials text,                       -- e.g. 'MD', 'DO', 'NP'
  specialty   text default 'Primary Care',
  npi         text,                        -- US National Provider Identifier (optional)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clinicians_only_one unique (singleton)
);

-- ============================================================================
-- 2) patients — demographics + problem list / meds / allergies
-- ============================================================================
-- Demographics are first-class columns; the clinical lists are JSONB arrays so
-- the demo can store rich, varying structure without extra join tables. Each
-- list element is expected to be an object, e.g.:
--   problem_list: [{ "label": "Type 2 diabetes", "icd10": "E11.9", "since": "2019" }]
--   medications:  [{ "name": "Metformin", "dose": "1000 mg", "sig": "BID" }]
--   allergies:    [{ "substance": "Penicillin", "reaction": "hives", "severity": "moderate" }]
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  mrn           text unique,               -- medical record number (synthetic for demo)
  first_name    text not null,
  last_name     text not null,
  date_of_birth date,
  sex           text,                       -- free text for demo ('female','male','other',...)
  phone         text,
  email         text,
  problem_list  jsonb not null default '[]'::jsonb,
  medications   jsonb not null default '[]'::jsonb,
  allergies     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists patients_last_name_idx on public.patients (last_name);
-- GIN indexes make "which patients are on drug X / have problem Y" queries fast.
create index if not exists patients_problem_list_gin on public.patients using gin (problem_list);
create index if not exists patients_medications_gin  on public.patients using gin (medications);
create index if not exists patients_allergies_gin    on public.patients using gin (allergies);

-- ============================================================================
-- 3) source_notes — raw prior-visit notes (the INPUT the briefing reads)
-- ============================================================================
create table if not exists public.source_notes (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  note_date  date not null,                 -- date the note documents
  author     text,                          -- who wrote it (free text; may be external)
  note_type  text,                          -- 'progress','H&P','telephone','lab','imaging','discharge',...
  body       text not null,                 -- raw free-text note
  created_at timestamptz not null default now()
);

create index if not exists source_notes_patient_idx      on public.source_notes (patient_id);
-- Chronological pull of a patient's notes (newest first) — the hot path for prep.
create index if not exists source_notes_patient_date_idx on public.source_notes (patient_id, note_date desc);

-- ============================================================================
-- 4) appointments — the upcoming visit + its reason/context
-- ============================================================================
create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients  (id) on delete cascade,
  clinician_id  uuid references public.clinicians (id) on delete set null,
  scheduled_for timestamptz not null,        -- when the upcoming visit happens
  reason        text,                         -- chief complaint / reason for visit
  visit_type    text default 'follow-up',     -- 'follow-up','new','annual','telehealth',...
  context       text,                         -- extra free-text context for prep
  status        text not null default 'scheduled'
                 check (status in ('scheduled','prepped','completed','cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists appointments_patient_idx   on public.appointments (patient_id);
create index if not exists appointments_clinician_idx on public.appointments (clinician_id);
create index if not exists appointments_schedule_idx  on public.appointments (scheduled_for);
create index if not exists appointments_status_idx    on public.appointments (status);

-- ============================================================================
-- 5) briefings — the GENERATED output (one row per generation; history kept)
-- ============================================================================
-- Lifecycle: an appointment + its patient's source_notes are fed to the model,
-- which produces a structured briefing. `status` tracks the generation run.
-- Multiple rows per appointment are allowed (regeneration history); use the
-- newest by created_at, or add UNIQUE(appointment_id) if you want exactly one.
create table if not exists public.briefings (
  id                 uuid primary key default gen_random_uuid(),
  appointment_id     uuid not null references public.appointments (id) on delete cascade,
  patient_id         uuid not null references public.patients     (id) on delete cascade,
  -- Structured model output:
  summary            jsonb,                  -- key-history summary (structured)
  follow_ups         jsonb not null default '[]'::jsonb,  -- prioritized follow-up questions
  flags              jsonb not null default '[]'::jsonb,  -- warning / red-flag items
  briefing_md        text,                   -- full human-readable briefing (Markdown)
  -- Generation metadata:
  model              text,                   -- e.g. 'anthropic/claude-opus-4.8'
  status             text not null default 'pending'
                       check (status in ('pending','generating','complete','error')),
  error              text,                   -- populated when status = 'error'
  -- Optional token/usage accounting (nullable; fill if available):
  prompt_tokens      integer,
  completion_tokens  integer,
  total_tokens       integer,
  usage              jsonb,                  -- raw usage payload from the provider
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists briefings_appointment_idx  on public.briefings (appointment_id);
create index if not exists briefings_patient_idx      on public.briefings (patient_id);
create index if not exists briefings_status_idx       on public.briefings (status);
-- Fetch the latest briefing for an appointment quickly.
create index if not exists briefings_appt_created_idx on public.briefings (appointment_id, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at triggers (DROP + CREATE so the migration stays idempotent)
-- ----------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.clinicians;
create trigger set_updated_at before update on public.clinicians
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.patients;
create trigger set_updated_at before update on public.patients
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.appointments;
create trigger set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.briefings;
create trigger set_updated_at before update on public.briefings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Bootstrap the single demo clinician (idempotent).
-- The UNIQUE(singleton) constraint makes any second insert a no-op.
-- ----------------------------------------------------------------------------
insert into public.clinicians (full_name, credentials, specialty)
values ('Dr. Demo Clinician', 'MD', 'Primary Care')
on conflict (singleton) do nothing;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
-- DEMO POSTURE (current): RLS is LEFT DISABLED on every table. This app has NO
-- auth and the eve tool talks to Postgres with the Supabase SERVICE ROLE key
-- (which bypasses RLS anyway). With RLS disabled, the service role has full
-- access and the schema "just works" for the single-clinician demo.
--
-- DO NOT ship this to production with real PHI. Before going live:
--
--   1) ENABLE RLS on every table:
--        alter table public.clinicians   enable row level security;
--        alter table public.patients     enable row level security;
--        alter table public.source_notes enable row level security;
--        alter table public.appointments enable row level security;
--        alter table public.briefings    enable row level security;
--
--   2) Keep server-side access working via the service role (it still BYPASSES
--      RLS), and DENY the public/anon API by simply adding NO policies for the
--      `anon` role -- with RLS enabled and no policy, anon reads/writes return
--      zero rows / are rejected (fail-closed).
--
--   3) When you add real auth (Supabase Auth), scope each row to its owner and
--      write least-privilege policies against auth.uid(), e.g.:
--        -- add `owner_id uuid references auth.users(id)` to each table, then:
--        create policy patients_select_own on public.patients
--          for select to authenticated using (owner_id = auth.uid());
--        create policy patients_write_own on public.patients
--          for all to authenticated
--          using (owner_id = auth.uid()) with check (owner_id = auth.uid());
--      Repeat per table (join through patient_id for child tables).
--
--   4) NEVER expose the service role key to the browser. Only server-side code
--      (the eve tool / Next.js Route Handlers) should hold it.
--
-- A PERMISSIVE alternative for a throwaway PUBLIC demo (NOT for PHI) is to
-- enable RLS and add a wide-open policy per table:
--        alter table public.patients enable row level security;
--        create policy patients_demo_all on public.patients
--          for all to anon using (true) with check (true);
-- ============================================================================