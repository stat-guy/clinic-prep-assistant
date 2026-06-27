import type { PatientBundle } from "../lib/types";
import type { Briefing } from "../lib/schema";

export const sampleBundle: PatientBundle = {
  id: "rosa-delgado-t2dm-htn",
  name: "Rosa Delgado",
  age: 58,
  sex: "Female",
  problemList: [
    "Type 2 diabetes mellitus, uncontrolled (A1c 8.4%)",
    "Essential hypertension, uncontrolled",
  ],
  medications: ["Metformin 1000 mg PO BID", "Lisinopril 20 mg PO daily"],
  allergies: ["Sulfonamides (sulfa) — hives"],
  labs: [{ name: "HbA1c", value: "8.4%", date: "2026-06-22", flag: "High" }],
  notes: [
    {
      date: "2026-01-09",
      type: "Office Visit",
      author: "O. Brindlemark, DO",
      text: "A1c today 7.9 - up from 7.1 in summer. metformin 1000 BID.",
    },
  ],
  upcomingVisitReason:
    "3-month follow-up for type 2 diabetes and hypertension.",
  asOf: "2026-06-27",
};

export const validBriefing: Briefing = {
  summary: {
    oneLiner: "58F with T2DM and HTN for a 3-month follow-up.",
    activeProblems: ["Type 2 diabetes", "Hypertension"],
    medications: ["Metformin 1000 mg BID"],
    allergies: ["Sulfa"],
    recentChanges: ["A1c rising 7.1 → 8.4%"],
  },
  followUpQuestions: [
    {
      question: "Confirm medication adherence?",
      why: "Distinguishes true pharmacologic failure from nonadherence",
      priority: "high",
    },
  ],
  flags: [
    {
      category: "missing-info",
      message: "No recent foot/monofilament exam documented",
      evidence: "absence of data",
    },
  ],
  trends: [
    {
      label: "HbA1c",
      unit: "%",
      points: [
        { t: "2025-07-15", v: 7.1 },
        { t: "2026-01-09", v: 7.9 },
        { t: "2026-06-22", v: 8.4 },
      ],
      concern: "high",
    },
  ],
  briefingMarkdown: "# Rosa Delgado\n- T2DM, HTN follow-up",
};
