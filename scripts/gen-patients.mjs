// Generates ~94 additional synthetic patients (healthy + chronic + staged cancers
// across all life stages) so the panel totals 100 with the 6 hero patients.
// Programmatic + deterministic (index-driven, no RNG). Run with:
//   bun scripts/gen-patients.mjs    (or: node --env-file=.env.local scripts/gen-patients.mjs)
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const TOTAL = 94;

const FIRST_F = ["Maria","Aisha","Linda","Wei","Priya","Sofia","Hannah","Yuki","Fatima","Grace","Elena","Nina","Camila","Chloe","Amara","Ingrid","Leila","Mei","Naomi","Olivia","Deborah","Ruth","Zoe","Hana","Lucia"];
const FIRST_M = ["James","Mohammed","Carlos","Liam","Raj","Hiroshi","David","Kwame","Noah","Ethan","Omar","Lucas","Andre","Victor","Henry","Diego","Jamal","Theo","Frank","George","Ravi","Peter","Samuel","Tomas","Eli"];
const LAST = ["Nguyen","Okafor","Patel","Garcia","Kim","Johnson","Ali","Rossi","Khan","Cohen","Mbeki","Tanaka","Lopez","Brown","Singh","Murphy","Hassan","Schmidt","Dubois","Ivanov","Olsen","Reyes","Adler","Costa","Wong","Bauer","Flores","Park","Day","Romano"];

const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const dParts = (mo, yr) => `${yr}-${String(mo).padStart(2, "0")}-12`;

// Each archetype: cat, age range, and make(name, age, variant) -> patient fields.
const ARCH = [
  { key: "healthy-adult", cat: "healthy", age: [22, 45], make: (n, a) => ({
    problemList: [], medications: [], allergies: ["NKDA"],
    labs: [{ name: "Lipid panel", value: "LDL 96, HDL 58", date: "2026-03-10", flag: "Normal" }],
    reason: "Routine annual wellness visit; no acute concerns.",
    notes: [{ date: "2025-04-02", type: "Wellness", author: "PCP", text: `${a}yo here for annual exam. Feels well, exercises 3x/wk, nonsmoker. No meds. ROS neg. BP 118/74, BMI 23. A/P: healthy, routine labs, return 1 yr.` }],
  }) },
  { key: "well-child", cat: "healthy", age: [4, 16], make: (n, a) => ({
    problemList: [], medications: [], allergies: ["NKDA"], labs: [],
    reason: "Well-child / sports physical clearance.",
    notes: [{ date: "2025-09-01", type: "Well-Child", author: "Peds", text: `${a}yo for sports physical. Growth on curve, immunizations UTD. No chronic conditions. Cleared for athletics.` }],
  }) },
  { key: "healthy-senior", cat: "healthy", age: [66, 84], make: (n, a) => ({
    problemList: ["Osteopenia"], medications: ["Vitamin D 1000 IU daily"], allergies: ["NKDA"],
    labs: [{ name: "A1c", value: "5.6%", date: "2026-01-20", flag: "Normal" }],
    reason: "Medicare annual wellness visit.",
    notes: [{ date: "2025-06-15", type: "Wellness", author: "PCP", text: `${a}yo for AWV. Independent, walks daily. Falls screen neg. Colonoscopy 2022 normal. A/P: continue vit D, age-appropriate screening.` }],
  }) },
  { key: "htn", cat: "chronic", age: [40, 78], make: (n, a) => ({
    problemList: ["Essential hypertension"], medications: ["Amlodipine 5 mg daily"], allergies: ["NKDA"],
    labs: [{ name: "BMP", value: "K 4.1, Cr 0.9", date: "2026-02-02", flag: "Normal" }],
    reason: "Hypertension follow-up; review home BP log.",
    notes: [{ date: "2026-02-02", type: "Office Visit", author: "PCP", text: `${a}yo HTN f/u. Home BP avg 134/82. adherent. no sob/cp. BP 136/84 office. cont amlodipine, recheck 3 mo.` }],
  }) },
  { key: "t2dm", cat: "chronic", age: [38, 75], make: (n, a) => ({
    problemList: ["Type 2 diabetes mellitus", "Hyperlipidemia"], medications: ["Metformin 1000 mg BID", "Atorvastatin 20 mg daily"], allergies: ["NKDA"],
    labs: [{ name: "A1c", value: "6.9%", date: "2026-03-05", flag: "At goal" }],
    reason: "Diabetes 3-month follow-up.",
    notes: [{ date: "2026-03-05", type: "Office Visit", author: "PCP", text: `${a}yo T2DM f/u. A1c 6.9 (was 7.1). tolerating metformin. feet ok. cont regimen, retinal exam due.` }],
  }) },
  { key: "copd", cat: "chronic", age: [55, 82], make: (n, a) => ({
    problemList: ["COPD, moderate", "Former tobacco use"], medications: ["Tiotropium inhaler daily", "Albuterol PRN"], allergies: ["NKDA"],
    labs: [], reason: "COPD follow-up; refill inhalers.",
    notes: [{ date: "2026-01-12", type: "Office Visit", author: "PCP", text: `${a}yo COPD f/u. 1 exacerbation last winter. quit smoking 2021. SpO2 95%. cont tiotropium, flu/pneumo UTD.` }],
  }) },
  { key: "anxiety", cat: "chronic", age: [19, 50], make: (n, a) => ({
    problemList: ["Generalized anxiety disorder"], medications: ["Sertraline 50 mg daily"], allergies: ["NKDA"],
    labs: [], reason: "Mental health follow-up; medication review.",
    notes: [{ date: "2026-02-20", type: "Office Visit", author: "PCP", text: `${a}yo GAD f/u on sertraline 50. improved sleep, GAD-7 down to 8 from 14. tolerating. cont, f/u 8 wks.` }],
  }) },
  { key: "hypothyroid", cat: "chronic", age: [28, 70], make: (n, a) => ({
    problemList: ["Hypothyroidism"], medications: ["Levothyroxine 75 mcg daily"], allergies: ["NKDA"],
    labs: [{ name: "TSH", value: "2.1 mIU/L", date: "2026-01-30", flag: "Normal" }],
    reason: "Thyroid follow-up; recheck TSH.",
    notes: [{ date: "2026-01-30", type: "Lab Review", author: "PCP", text: `${a}yo hypothyroid. TSH 2.1 on levo 75. asymptomatic. continue same dose, recheck 6-12 mo.` }],
  }) },
  { key: "cad", cat: "chronic", age: [52, 80], make: (n, a) => ({
    problemList: ["Coronary artery disease, s/p stent", "Hyperlipidemia"], medications: ["Aspirin 81 mg daily", "Atorvastatin 40 mg daily", "Metoprolol 25 mg BID"], allergies: ["NKDA"],
    labs: [{ name: "LDL", value: "71 mg/dL", date: "2026-02-14", flag: "Near goal" }],
    reason: "Cardiac risk follow-up.",
    notes: [{ date: "2026-02-14", type: "Office Visit", author: "PCP", text: `${a}yo CAD s/p RCA stent 2021. no angina. LDL 71. cont ASA/statin/BB, stress as needed.` }],
  }) },
  // ── Cancer archetypes (variant selects stage / life phase) ──
  { key: "breast-ca", cat: "cancer", age: [34, 78], make: (n, a, v) => {
    const stages = [
      { s: "Stage I invasive ductal carcinoma, s/p lumpectomy + radiation, on anastrozole (adjuvant endocrine therapy)", meds: ["Anastrozole 1 mg daily", "Calcium/Vitamin D"], note: "doing well 14 mo post-op, hot flashes, mild arthralgia on AI. mammo NED.", reason: "Survivorship visit — breast cancer on adjuvant endocrine therapy." },
      { s: "Stage IIB invasive ductal carcinoma, currently on adjuvant chemotherapy (AC-T)", meds: ["Ondansetron PRN", "Pegfilgrastim (post-cycle)", "Dexamethasone (chemo days)"], note: "cycle 3 of 4 AC. fatigue, neuropathy mild. ANC recovered. PCP visit for supportive care.", reason: "PCP coordination visit during active breast-cancer chemotherapy." },
      { s: "Stage IV metastatic breast cancer (bone, liver), on palbociclib + letrozole", meds: ["Palbociclib 125 mg daily (21/7)", "Letrozole 2.5 mg daily", "Denosumab q4wk"], note: "metastatic dz, stable on CDK4/6i. ECOG 1. mild cytopenias. goals-of-care discussed, prefers active tx.", reason: "PCP visit — metastatic breast cancer on targeted therapy; symptom management." },
      { s: "Breast cancer, 6 years NED (survivorship)", meds: [], note: "6y out from stage I breast ca, off endocrine tx. annual mammo NED. discussing bone health, exercise.", reason: "Cancer survivorship wellness visit." },
    ];
    const st = stages[v % stages.length];
    return { problemList: [st.s, "Hypertension"], medications: [...st.meds, "Lisinopril 10 mg daily"], allergies: ["NKDA"],
      labs: [{ name: "CBC (ANC)", value: "ANC 2.1", date: "2026-05-30", flag: v === 1 ? "Low-normal post-chemo" : "Normal" }],
      reason: st.reason,
      notes: [{ date: "2026-05-30", type: "Oncology Coordination", author: "Oncology + PCP", text: `${a}F. ${st.note}` }] };
  } },
  { key: "colorectal-ca", cat: "cancer", age: [45, 80], make: (n, a, v) => {
    const stages = [
      { s: "Stage III colon adenocarcinoma, s/p right hemicolectomy + adjuvant FOLFOX (completed)", meds: ["Multivitamin"], note: "completed 12 cycles FOLFOX 4 mo ago. residual grade 1 neuropathy. CEA normal, surveillance CT clear.", reason: "Colorectal cancer surveillance visit, post-adjuvant chemo." },
      { s: "Stage IV metastatic colorectal cancer (liver mets), on FOLFIRI + bevacizumab", meds: ["Loperamide PRN", "Ondansetron PRN"], note: "metastatic CRC, on 2nd-line. ECOG 1. diarrhea managed. discussing port care, nutrition.", reason: "PCP supportive-care visit during metastatic CRC chemotherapy." },
      { s: "Stage II colon cancer, s/p resection, surveillance (no chemo)", meds: ["Aspirin 81 mg daily"], note: "2y s/p colectomy stage II. surveillance colonoscopy clean. CEA wnl. doing well.", reason: "Colon cancer surveillance follow-up." },
    ];
    const st = stages[v % stages.length];
    return { problemList: [st.s, "Type 2 diabetes mellitus"], medications: [...st.meds, "Metformin 500 mg BID"], allergies: ["NKDA"],
      labs: [{ name: "CEA", value: v === 1 ? "8.4 ng/mL" : "2.1 ng/mL", date: "2026-05-18", flag: v === 1 ? "Elevated" : "Normal" }],
      reason: st.reason,
      notes: [{ date: "2026-05-18", type: "Oncology Coordination", author: "Oncology + PCP", text: `${a}yo. ${st.note}` }] };
  } },
  { key: "lung-ca", cat: "cancer", age: [55, 82], make: (n, a, v) => {
    const stages = [
      { s: "Stage IIIA NSCLC, s/p chemoradiation, now on durvalumab (consolidation immunotherapy)", meds: ["Levothyroxine 50 mcg daily (immune-related hypothyroid)"], note: "on durvalumab consolidation. monitoring for pneumonitis/thyroiditis — developed mild hypothyroid, replaced. SOB stable.", reason: "PCP visit — NSCLC on consolidation immunotherapy; irAE monitoring." },
      { s: "Stage IV NSCLC, EGFR-mutated, on osimertinib", meds: [], note: "metastatic EGFR+ NSCLC, excellent response to osimertinib 10 mo. ECOG 1. mild rash, watching QTc.", reason: "PCP coordination — metastatic lung cancer on targeted therapy." },
    ];
    const st = stages[v % stages.length];
    return { problemList: [st.s, "Former tobacco use", "COPD"], medications: [...st.meds, "Tiotropium inhaler daily", "Albuterol PRN"], allergies: ["NKDA"],
      labs: [{ name: "TSH", value: v === 0 ? "8.9 mIU/L" : "1.8 mIU/L", date: "2026-05-22", flag: v === 0 ? "High (irAE)" : "Normal" }],
      reason: st.reason,
      notes: [{ date: "2026-05-22", type: "Oncology Coordination", author: "Oncology + PCP", text: `${a}yo. ${st.note}` }] };
  } },
  { key: "prostate-ca", cat: "cancer", age: [55, 85], make: (n, a, v) => {
    const stages = [
      { s: "Localized prostate cancer (Gleason 6), on active surveillance", meds: ["Tamsulosin 0.4 mg daily"], note: "low-risk prostate ca on AS. PSA stable 5.2. repeat biopsy stable. asymptomatic.", reason: "Active-surveillance follow-up for prostate cancer." },
      { s: "Metastatic castration-resistant prostate cancer, on abiraterone + ADT + prednisone", meds: ["Abiraterone 1000 mg daily", "Prednisone 5 mg daily", "Leuprolide depot q3mo"], note: "mCRPC on abiraterone/ADT. PSA down. fatigue, hot flashes. monitoring BP/glucose on steroid.", reason: "PCP visit — metastatic prostate cancer on systemic therapy." },
    ];
    const st = stages[v % stages.length];
    return { problemList: [st.s, "Benign prostatic hyperplasia"], medications: [...st.meds], allergies: ["Sulfa — rash"],
      labs: [{ name: "PSA", value: v === 0 ? "5.2 ng/mL" : "0.8 ng/mL", date: "2026-05-10", flag: v === 0 ? "Stable (AS)" : "Responding" }],
      reason: st.reason,
      notes: [{ date: "2026-05-10", type: "Oncology Coordination", author: "Urology/Onc + PCP", text: `${a}M. ${st.note}` }] };
  } },
  { key: "lymphoma", cat: "cancer", age: [18, 75], make: (n, a, v) => {
    const stages = [
      { s: "Diffuse large B-cell lymphoma, on R-CHOP (cycle 4 of 6)", meds: ["Allopurinol 300 mg daily", "Acyclovir prophylaxis", "TMP-SMX prophylaxis"], note: "DLBCL mid-treatment. interim PET responding. neutropenic precautions reviewed. fatigue.", reason: "PCP supportive visit during R-CHOP for lymphoma." },
      { s: "Hodgkin lymphoma, 3 years in remission (survivorship)", meds: [], note: "3y post-ABVD for Hodgkin, in remission. monitoring late effects (cardiac, thyroid, 2nd malignancy). well.", reason: "Lymphoma survivorship visit." },
    ];
    const st = stages[v % stages.length];
    return { problemList: [st.s], medications: [...st.meds], allergies: ["NKDA"],
      labs: [{ name: "CBC", value: v === 0 ? "WBC 2.8, ANC 1.1" : "WBC 6.2", date: "2026-05-28", flag: v === 0 ? "Neutropenic" : "Normal" }],
      reason: st.reason,
      notes: [{ date: "2026-05-28", type: "Oncology Coordination", author: "Hematology + PCP", text: `${a}yo. ${st.note}` }] };
  } },
  { key: "melanoma", cat: "cancer", age: [30, 75], make: (n, a, v) => {
    const stages = [
      { s: "Stage IIB melanoma, s/p wide local excision + SLNB, surveillance", meds: [], note: "resected melanoma, negative nodes. skin surveillance q3mo. sun protection counseled. NED.", reason: "Melanoma surveillance visit." },
      { s: "Stage IV metastatic melanoma, on pembrolizumab (immunotherapy)", meds: ["Levothyroxine 75 mcg daily (irAE)"], note: "metastatic melanoma on pembro, partial response. immune-related hypothyroid managed. watching colitis/hepatitis.", reason: "PCP visit — metastatic melanoma on immunotherapy; irAE monitoring." },
    ];
    const st = stages[v % stages.length];
    return { problemList: [st.s], medications: [...st.meds], allergies: ["NKDA"],
      labs: [{ name: "LFTs", value: "AST 28, ALT 31", date: "2026-05-26", flag: "Normal" }],
      reason: st.reason,
      notes: [{ date: "2026-05-26", type: "Oncology Coordination", author: "Oncology + PCP", text: `${a}yo. ${st.note}` }] };
  } },
  { key: "leukemia", cat: "cancer", age: [8, 78], make: (n, a, v) => {
    const stages = [
      { s: "Chronic lymphocytic leukemia, Rai stage 0, watch-and-wait", meds: [], note: "early CLL, asymptomatic, watch-and-wait. WBC mildly up, no cytopenias/adenopathy needing tx. counseled infection precautions.", reason: "CLL surveillance visit (watch-and-wait)." },
      { s: "Acute lymphoblastic leukemia, pediatric, in maintenance therapy", meds: ["6-mercaptopurine", "Methotrexate weekly", "TMP-SMX prophylaxis"], note: "pediatric ALL in maintenance. counts stable. school part-time. parents managing meds; coordinating with peds-onc.", reason: "Pediatric coordination visit — ALL maintenance therapy." },
    ];
    const st = stages[v % stages.length];
    return { problemList: [st.s], medications: [...st.meds], allergies: ["NKDA"],
      labs: [{ name: "WBC", value: v === 0 ? "22 K/uL" : "4.5 K/uL", date: "2026-05-24", flag: v === 0 ? "Elevated (CLL)" : "Normal" }],
      reason: st.reason,
      notes: [{ date: "2026-05-24", type: "Heme-Onc Coordination", author: "Hematology + PCP", text: `${a}yo. ${st.note}` }] };
  } },
  { key: "thyroid-ca", cat: "cancer", age: [25, 65], make: (n, a) => ({
    problemList: ["Papillary thyroid carcinoma, s/p total thyroidectomy + RAI, NED", "Post-surgical hypothyroidism"],
    medications: ["Levothyroxine 137 mcg daily (TSH-suppressive)"], allergies: ["NKDA"],
    labs: [{ name: "Thyroglobulin", value: "<0.2 ng/mL", date: "2026-04-15", flag: "Undetectable (NED)" }, { name: "TSH", value: "0.4 mIU/L", date: "2026-04-15", flag: "Suppressed (intentional)" }],
    reason: "Thyroid cancer surveillance; review TSH suppression.",
    notes: [{ date: "2026-04-15", type: "Endocrine Coordination", author: "Endocrine + PCP", text: `${a}yo s/p total thyroidectomy + RAI for papillary thyroid ca. thyroglobulin undetectable, NED. on suppressive levo, TSH 0.4 as targeted. neck US clear.` }],
  }) },
  { key: "pancreatic-ca", cat: "cancer", age: [58, 82], make: (n, a) => ({
    problemList: ["Stage IV pancreatic adenocarcinoma, on FOLFIRINOX", "Cancer-related cachexia", "Type 2 diabetes (new, tumor-related)"],
    medications: ["Pancreatic enzyme replacement with meals", "Ondansetron PRN", "Insulin glargine 10 units qHS", "Oxycodone 5 mg PRN pain"], allergies: ["NKDA"],
    labs: [{ name: "CA 19-9", value: "640 U/mL", date: "2026-05-20", flag: "Elevated (trending down on tx)" }],
    reason: "PCP supportive-care visit — metastatic pancreatic cancer; symptom and nutrition management.",
    notes: [{ date: "2026-05-20", type: "Oncology Coordination", author: "Oncology + PCP + Palliative", text: `${a}yo metastatic pancreatic ca on FOLFIRINOX. weight loss, on enzymes + nutrition support. pain controlled on prn oxycodone. palliative care co-managing. goals-of-care revisited.` }],
  }) },
];

async function run() {
  const { data: clin } = await sb.from("clinicians").select("id").limit(1).maybeSingle();
  const clinicianId = clin?.id ?? null;

  // Clear any prior generated cohort (keeps the 6 hero patients untouched).
  await sb.from("patients").delete().like("mrn", "gen-%");

  let ok = 0;
  for (let i = 0; i < TOTAL; i++) {
    const a = ARCH[i % ARCH.length];
    const variant = Math.floor(i / ARCH.length);
    const sex = i % 2 === 0 ? "Female" : "Male";
    const first = sex === "Female" ? pick(FIRST_F, i) : pick(FIRST_M, i);
    const last = pick(LAST, i * 7 + 3);
    const span = a.age[1] - a.age[0];
    const age = a.age[0] + ((i * 13) % (span + 1));
    const fields = a.make(`${first} ${last}`, age, variant);
    const mrn = `gen-${String(i + 1).padStart(4, "0")}-${a.key}`;
    const dob = `${2026 - age}-06-12`;

    const { data: ins, error: pe } = await sb.from("patients").insert({
      mrn, first_name: first, last_name: last, date_of_birth: dob, sex,
      problem_list: fields.problemList ?? [], medications: fields.medications ?? [], allergies: fields.allergies ?? [],
    }).select("id").single();
    if (pe) { console.error(mrn, pe.message); continue; }
    const pid = ins.id;

    const notes = (fields.notes ?? []).map((nt) => ({ patient_id: pid, note_date: nt.date, author: nt.author ?? "PCP", note_type: nt.type ?? "note", body: nt.text }));
    if (fields.labs && fields.labs.length) {
      notes.push({ patient_id: pid, note_date: fields.labs[fields.labs.length - 1].date || "2026-05-01", author: "Lab", note_type: "lab",
        body: "Structured lab values:\n" + fields.labs.map((l) => `- ${l.name}: ${l.value}${l.date ? ` (${l.date})` : ""}${l.flag ? ` [${l.flag}]` : ""}`).join("\n") });
    }
    if (notes.length) await sb.from("source_notes").insert(notes);

    await sb.from("appointments").insert({ patient_id: pid, clinician_id: clinicianId, scheduled_for: "2026-06-29T09:00:00Z",
      reason: fields.reason ?? "Follow-up visit", visit_type: "follow-up", context: a.cat });
    ok++;
  }
  console.log(`Generated ${ok}/${TOTAL} patients across ${ARCH.length} archetypes (categories: healthy, chronic, cancer).`);
  process.exit(0);
}
run();
