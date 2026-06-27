// Pre-generates + caches a briefing for every patient so the deployed demo is
// instant (cache-first) and never hits the serverless timeout.
// Run with:  bun scripts/warm.ts
import { getSupabase, getBundle, saveBriefing } from "../lib/db";
import { generatePrepBriefing } from "../lib/prep";

const sb = getSupabase();
const { data } = await sb.from("patients").select("mrn").order("mrn");
const mrns = (data ?? []).map((r: any) => r.mrn);
const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const CONC = 6;
let idx = 0;
let ok = 0;
let fail = 0;

async function worker() {
  while (idx < mrns.length) {
    const mrn = mrns[idx++];
    try {
      const found = await getBundle(mrn);
      if (!found) {
        fail++;
        continue;
      }
      const briefing = await generatePrepBriefing(found.bundle, { model });
      await saveBriefing({
        appointmentId: found.appointmentId,
        patientId: found.patientId,
        briefing,
        model,
      });
      ok++;
      if (ok % 10 === 0) console.log(`warmed ${ok}/${mrns.length}`);
    } catch (e: any) {
      fail++;
      console.log("FAIL", mrn, (e?.message || "").slice(0, 80));
    }
  }
}

await Promise.all(Array.from({ length: CONC }, worker));
console.log(`DONE warm ok=${ok} fail=${fail}`);
process.exit(0);
