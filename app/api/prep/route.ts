import { NextResponse } from "next/server";
import { getBundle, saveBriefing, getLatestBriefing } from "@/lib/db";
import { generatePrepBriefing } from "@/lib/prep";
import type { PatientBundle } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
  try {
    const body = await req.json().catch(() => ({}));

    if (body.patientId) {
      const found = await getBundle(body.patientId);
      if (!found) return NextResponse.json({ error: "patient not found" }, { status: 404 });

      const patient = { name: found.bundle.name, age: found.bundle.age, sex: found.bundle.sex };

      // Cache-first: serve a previously generated briefing instantly. Keeps the
      // deployed demo snappy and within serverless time limits. {fresh:true} regenerates.
      if (!body.fresh && found.appointmentId) {
        const cached = await getLatestBriefing(found.appointmentId);
        if (cached) return NextResponse.json({ briefing: cached, patient, cached: true });
      }

      const briefing = await generatePrepBriefing(found.bundle, { model });
      await saveBriefing({
        appointmentId: found.appointmentId,
        patientId: found.patientId,
        briefing,
        model,
      });
      return NextResponse.json({ briefing, patient });
    }

    if (body.notes) {
      const bundle: PatientBundle = {
        id: "adhoc",
        name: body.patientName ?? "Pasted notes",
        age: 0,
        sex: "",
        problemList: [],
        medications: [],
        allergies: [],
        labs: [],
        notes: [{ date: "2026-06-27", type: "pasted", text: String(body.notes) }],
        upcomingVisitReason: body.reason ?? "",
        asOf: "2026-06-27",
      };
      const briefing = await generatePrepBriefing(bundle, { model });
      return NextResponse.json({ briefing, patient: { name: bundle.name } });
    }

    return NextResponse.json({ error: "provide patientId or notes" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "generation failed" }, { status: 500 });
  }
}
