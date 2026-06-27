import { z } from "zod";

// ── ClinicalPrepBriefing — the structured contract Claude must return. ──
// Decision support only. Mirrors docs/agent-design.md output schema.

export const PrioritySchema = z.enum(["high", "med", "low"]);
export type Priority = z.infer<typeof PrioritySchema>;

export const FlagCategorySchema = z.enum([
  "safety",
  "missing-info",
  "contradiction",
  "stale",
]);
export type FlagCategory = z.infer<typeof FlagCategorySchema>;

export const BriefingSchema = z.object({
  summary: z.object({
    oneLiner: z.string(),
    activeProblems: z.array(z.string()),
    medications: z.array(z.string()),
    allergies: z.array(z.string()),
    recentChanges: z.array(z.string()),
  }),
  followUpQuestions: z.array(
    z.object({
      question: z.string(),
      why: z.string(),
      priority: PrioritySchema,
    }),
  ),
  flags: z.array(
    z.object({
      category: FlagCategorySchema,
      message: z.string(),
      evidence: z.string(),
    }),
  ),
  trends: z
    .array(
      z.object({
        label: z.string(),
        unit: z.string().optional(),
        points: z.array(z.object({ t: z.string(), v: z.number() })),
        concern: z.enum(["high", "med", "low", "none"]).optional(),
      }),
    )
    .default([]),
  briefingMarkdown: z.string(),
});

export type Briefing = z.infer<typeof BriefingSchema>;
