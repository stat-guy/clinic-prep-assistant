-- Persist the structured trend series (powering the Tufte sparklines) on each briefing.
alter table public.briefings
  add column if not exists trends jsonb not null default '[]'::jsonb;
