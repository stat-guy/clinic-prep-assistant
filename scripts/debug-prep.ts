import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { BriefingSchema } from "../lib/schema";
import { SYSTEM_PROMPT, buildPrepPrompt } from "../lib/prompt";
import { getBundle } from "../lib/db";

const found = await getBundle("walter-okonkwo-polypharmacy-ddi");
if (!found) {
  console.log("no bundle");
  process.exit(1);
}
const prompt = buildPrepPrompt(found.bundle);
const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
console.log("MODEL", model, "promptLen", prompt.length);

try {
  const { object } = await generateObject({
    model: anthropic(model),
    schema: BriefingSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });
  console.log("OK", JSON.stringify(object).slice(0, 200));
} catch (e: any) {
  console.log("NAME", e?.name);
  console.log("MSG", e?.message);
  const txt = e?.text ?? "";
  console.log("RAW_TEXT_LEN", txt.length);
  console.log("RAW_TEXT", txt.slice(0, 2500));
  const c = e?.cause;
  console.log("CAUSE_NAME", c?.name);
  if (c?.value !== undefined) {
    const sp = BriefingSchema.safeParse(c.value);
    if (!sp.success) console.log("ZOD_ISSUES", JSON.stringify(sp.error.issues, null, 2).slice(0, 2500));
  }
}
process.exit(0);
