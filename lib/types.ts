// Domain types shared across the prep core (framework-agnostic, no Next/eve imports).

export type Lab = {
  name: string;
  value: string;
  date?: string;
  flag?: string;
};

export type Note = {
  date: string;
  type?: string;
  author?: string;
  text: string;
};

/** Everything the model needs to produce a grounded briefing for ONE patient. */
export type PatientBundle = {
  id: string; // public slug (stored as patients.mrn)
  name: string;
  age: number;
  sex: string;
  problemList: string[];
  medications: string[];
  allergies: string[];
  labs: Lab[];
  notes: Note[];
  upcomingVisitReason: string;
  /** "Today" for the prep run — the model treats data after this as unknown. */
  asOf: string;
};
