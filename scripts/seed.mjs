// Idempotent seed: loads synthetic-data/patients.json into local Supabase.
// Run with:  node --env-file=.env scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (use: node --env-file=.env scripts/seed.mjs)");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const patients = JSON.parse(
  fs.readFileSync(new URL("../synthetic-data/patients.json", import.meta.url)),
);

function fmtLabs(labs) {
  if (!labs || !labs.length) return "";
  return (
    "Structured lab values (most recent first):\n" +
    labs
      .map((l) => `- ${l.name}: ${l.value}${l.date ? ` (${l.date})` : ""}${l.flag ? ` [${l.flag}]` : ""}`)
      .join("\n")
  );
}

const { data: clin } = await sb.from("clinicians").select("id").limit(1).maybeSingle();
const clinicianId = clin?.id ?? null;

// Cascade-clear any prior run of these demo patients.
await sb.from("patients").delete().in("mrn", patients.map((p) => p.id));

for (const p of patients) {
  const [first, ...rest] = p.name.split(" ");
  const last = rest.join(" ") || first;
  const dob = `${2026 - (p.age || 0)}-01-01`;

  const { data: ins, error: pe } = await sb
    .from("patients")
    .insert({
      mrn: p.id,
      first_name: first,
      last_name: last,
      date_of_birth: dob,
      sex: p.sex ?? "",
      problem_list: p.problemList ?? [],
      medications: p.medications ?? [],
      allergies: p.allergies ?? [],
    })
    .select("id")
    .single();
  if (pe) {
    console.error("patient", p.id, pe.message);
    continue;
  }
  const pid = ins.id;

  const notes = (p.priorNotes ?? []).map((n) => ({
    patient_id: pid,
    note_date: n.date,
    author: n.author ?? null,
    note_type: n.type ?? null,
    body: n.text,
  }));
  const labsText = fmtLabs(p.labs);
  if (labsText) {
    const latest =
      (p.labs || []).map((l) => l.date).filter(Boolean).sort().slice(-1)[0] || "2026-06-22";
    notes.push({ patient_id: pid, note_date: latest, author: "Lab", note_type: "lab", body: labsText });
  }
  if (notes.length) {
    const { error: ne } = await sb.from("source_notes").insert(notes);
    if (ne) console.error("notes", p.id, ne.message);
  }

  const { error: ae } = await sb.from("appointments").insert({
    patient_id: pid,
    clinician_id: clinicianId,
    scheduled_for: "2026-06-29T09:00:00Z",
    reason: p.upcomingVisitReason ?? "",
    visit_type: "follow-up",
    context: p.clinicalTheme ?? "",
  });
  if (ae) console.error("appt", p.id, ae.message);

  console.log("seeded", p.id, "notes=" + notes.length);
}

console.log(`DONE seeding ${patients.length} patients`);
process.exit(0);
