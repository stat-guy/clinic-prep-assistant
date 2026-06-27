import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, buildPrepPrompt } from "../lib/prompt";
import { sampleBundle } from "./fixtures";

describe("SYSTEM_PROMPT", () => {
  it("encodes the never-diagnose guardrail", () => {
    expect(SYSTEM_PROMPT).toContain("NEVER diagnose");
  });
  it("instructs to mark unknowns as 'not documented'", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("not documented");
  });
});

describe("buildPrepPrompt", () => {
  const prompt = buildPrepPrompt(sampleBundle);

  it("includes the patient name and age", () => {
    expect(prompt).toContain("Rosa Delgado");
    expect(prompt).toContain("58");
  });
  it("includes medications verbatim", () => {
    expect(prompt).toContain("Metformin 1000 mg PO BID");
  });
  it("includes prior note text", () => {
    expect(prompt).toContain("A1c today 7.9");
  });
  it("includes the upcoming visit reason and the as-of date", () => {
    expect(prompt).toContain("3-month follow-up");
    expect(prompt).toContain("2026-06-27");
  });
});
