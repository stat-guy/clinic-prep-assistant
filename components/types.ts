// Shared frontend types — mirror the frozen API contract exactly.
// Do NOT import from lib/** ; these are intentionally local to the UI.

export type Priority = "high" | "med" | "low";

export type FlagCategory = "safety" | "missing-info" | "contradiction" | "stale";

/** Level of clinical concern for a tracked measure's trajectory. */
export type TrendConcern = "high" | "med" | "low" | "none";

/** A single observation of a measure at a point in time. */
export type TrendPoint = { t: string; v: number };

/** One numeric measure tracked across visits (e.g. A1c 7.1→7.9→8.4). */
export type Trend = {
  label: string;
  unit?: string;
  points: TrendPoint[];
  concern?: TrendConcern;
};

export type Briefing = {
  summary: {
    oneLiner: string;
    activeProblems: string[];
    medications: string[];
    allergies: string[];
    recentChanges: string[];
  };
  followUpQuestions: {
    question: string;
    why: string;
    priority: Priority;
  }[];
  flags: {
    category: FlagCategory;
    message: string;
    evidence: string;
  }[];
  /** Optional per-measure trajectories rendered as Tufte sparklines. */
  trends?: Trend[];
  briefingMarkdown: string;
};

export type PatientListItem = {
  id: string;
  name: string;
  age: number;
  sex: string;
  reason: string;
};

// POST /api/prep → 200 { briefing, patient }
export type PrepResponse = {
  briefing: Briefing;
  patient: { name: string; age?: number; sex?: string };
};
