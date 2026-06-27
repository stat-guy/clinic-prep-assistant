import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Briefing } from "./schema";
import type { Note, PatientBundle } from "./types";

const DEMO_NOW = "2026-06-27";

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function ageFromDob(dob: string | null): number {
  if (!dob) return 0;
  return 2026 - parseInt(dob.slice(0, 4), 10);
}

export type PatientListItem = {
  id: string;
  name: string;
  age: number;
  sex: string;
  reason: string;
};

export async function listPatients(): Promise<PatientListItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("patients")
    .select("mrn, first_name, last_name, date_of_birth, sex, appointments(reason, scheduled_for)")
    .order("last_name");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.mrn,
    name: `${p.first_name} ${p.last_name}`.trim(),
    age: ageFromDob(p.date_of_birth),
    sex: p.sex ?? "",
    reason: p.appointments?.[0]?.reason ?? "",
  }));
}

export type BundleResult = {
  bundle: PatientBundle;
  patientId: string;
  appointmentId: string | null;
};

export async function getBundle(mrn: string): Promise<BundleResult | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("patients")
    .select(
      "id, mrn, first_name, last_name, date_of_birth, sex, problem_list, medications, allergies, source_notes(note_date, note_type, author, body), appointments(id, reason, scheduled_for)",
    )
    .eq("mrn", mrn)
    .single();
  if (error || !data) return null;

  const notes: Note[] = (data.source_notes ?? [])
    .map((n: any) => ({
      date: n.note_date,
      type: n.note_type ?? undefined,
      author: n.author ?? undefined,
      text: n.body,
    }))
    .sort((a: Note, b: Note) => (a.date < b.date ? -1 : 1));

  const appt = data.appointments?.[0];

  const bundle: PatientBundle = {
    id: data.mrn,
    name: `${data.first_name} ${data.last_name}`.trim(),
    age: ageFromDob(data.date_of_birth),
    sex: data.sex ?? "",
    problemList: data.problem_list ?? [],
    medications: data.medications ?? [],
    allergies: data.allergies ?? [],
    labs: [],
    notes,
    upcomingVisitReason: appt?.reason ?? "",
    asOf: DEMO_NOW,
  };

  return { bundle, patientId: data.id, appointmentId: appt?.id ?? null };
}

export async function saveBriefing(args: {
  appointmentId: string | null;
  patientId: string;
  briefing: Briefing;
  model: string;
}): Promise<void> {
  if (!args.appointmentId) return; // paste mode: nothing to attach to
  const sb = getSupabase();
  const { error } = await sb.from("briefings").insert({
    appointment_id: args.appointmentId,
    patient_id: args.patientId,
    summary: args.briefing.summary,
    follow_ups: args.briefing.followUpQuestions,
    flags: args.briefing.flags,
    trends: args.briefing.trends ?? [],
    briefing_md: args.briefing.briefingMarkdown,
    model: args.model,
    status: "complete",
  });
  if (error) throw error;
}

// Latest completed briefing for an appointment (cache-first read for the demo).
export async function getLatestBriefing(appointmentId: string): Promise<Briefing | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("briefings")
    .select("summary, follow_ups, flags, trends, briefing_md")
    .eq("appointment_id", appointmentId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.summary) return null;
  return {
    summary: data.summary,
    followUpQuestions: data.follow_ups ?? [],
    flags: data.flags ?? [],
    trends: data.trends ?? [],
    briefingMarkdown: data.briefing_md ?? "",
  } as Briefing;
}
