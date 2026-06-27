import { NextResponse } from "next/server";
import { listPatients } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const patients = await listPatients();
    return NextResponse.json({ patients });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed to list patients" }, { status: 500 });
  }
}
