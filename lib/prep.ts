import { BriefingSchema, type Briefing } from "./schema";
import { SYSTEM_PROMPT, buildPrepPrompt } from "./prompt";
import type { PatientBundle } from "./types";

export type GenerateArgs = { system: string; prompt: string; model: string };
export type GenerateFn = (args: GenerateArgs) => Promise<Briefing>;
export type GenerateOpts = { model?: string; generate?: GenerateFn };

const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Orchestrates a grounded prep briefing: build prompt -> generate -> validate.
 * `opts.generate` is injectable so the orchestration is unit-tested without a
 * live model call or API key.
 */
export async function generatePrepBriefing(
  bundle: PatientBundle,
  opts: GenerateOpts = {},
): Promise<Briefing> {
  const prompt = buildPrepPrompt(bundle);
  const model = opts.model || process.env.CLAUDE_MODEL || DEFAULT_MODEL;
  const generate = opts.generate ?? defaultGenerate;
  const briefing = await generate({ system: SYSTEM_PROMPT, prompt, model });
  return BriefingSchema.parse(briefing);
}

// Real model path — dynamically imported so unit tests (which inject `generate`)
// never load the AI SDK or require an API key.
async function defaultGenerate({ system, prompt, model }: GenerateArgs): Promise<Briefing> {
  const { generateObject } = await import("ai");
  const { anthropic } = await import("@ai-sdk/anthropic");
  const { object } = await generateObject({
    model: anthropic(model),
    schema: BriefingSchema,
    system,
    prompt,
    maxTokens: 8000,
    temperature: 0.2,
  });
  return object;
}
