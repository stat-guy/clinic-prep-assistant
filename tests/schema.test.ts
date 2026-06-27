import { describe, it, expect } from "vitest";
import { BriefingSchema } from "../lib/schema";
import { validBriefing } from "./fixtures";

describe("BriefingSchema", () => {
  it("accepts a valid briefing", () => {
    expect(BriefingSchema.parse(validBriefing)).toBeTruthy();
  });

  it("rejects an out-of-range priority", () => {
    const bad = {
      ...validBriefing,
      followUpQuestions: [{ question: "q", why: "w", priority: "urgent" }],
    };
    expect(() => BriefingSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown flag category", () => {
    const bad = {
      ...validBriefing,
      flags: [{ category: "nope", message: "m", evidence: "e" }],
    };
    expect(() => BriefingSchema.parse(bad)).toThrow();
  });

  it("requires summary.oneLiner", () => {
    const bad = {
      ...validBriefing,
      summary: { ...validBriefing.summary, oneLiner: undefined },
    };
    expect(() => BriefingSchema.parse(bad)).toThrow();
  });
});
