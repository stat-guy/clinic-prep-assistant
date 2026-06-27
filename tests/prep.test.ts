import { describe, it, expect, vi } from "vitest";
import { generatePrepBriefing } from "../lib/prep";
import { BriefingSchema } from "../lib/schema";
import { sampleBundle, validBriefing } from "./fixtures";

describe("generatePrepBriefing", () => {
  it("feeds the system prompt + a grounded user prompt to the generator and returns a schema-valid briefing", async () => {
    const generate = vi.fn(async ({ system, prompt }: { system: string; prompt: string }) => {
      expect(system).toContain("NEVER diagnose");
      expect(prompt).toContain("Metformin 1000 mg PO BID");
      expect(prompt).toContain("Rosa Delgado");
      return validBriefing;
    });

    const out = await generatePrepBriefing(sampleBundle, { generate });

    expect(generate).toHaveBeenCalledOnce();
    expect(() => BriefingSchema.parse(out)).not.toThrow();
    expect(out.summary.oneLiner).toContain("58F");
  });
});
