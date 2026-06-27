// Computer-use test: emulate an iPhone, generate a briefing on the live site,
// screenshot the rendered result. Usage: node scripts/shot.mjs [url] [out.png] [patient]
import { chromium, devices } from "playwright";

const BASE = process.argv[2] || "https://clinic-prep-assistant.vercel.app";
const OUT = process.argv[3] || "/tmp/briefing_mobile.png";
const PATIENT = process.argv[4] || "Walter Okonkwo";

const iPhone = devices["iPhone 14 Pro"] || devices["iPhone 13"];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...iPhone });
const page = await ctx.newPage();
page.on("response", (r) => {
  if (r.url().includes("/api/prep")) console.log("  /api/prep ->", r.status());
});

const t0 = Date.now();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
console.log("loaded", BASE);

// If the gate is up, capture it and stop.
const gated = await page.getByText("Authorized clinicians only").first().isVisible().catch(() => false);
if (gated) {
  await page.screenshot({ path: OUT });
  console.log("GATE active — screenshot of gate saved to", OUT);
  await browser.close();
  process.exit(0);
}

await page.waitForSelector('input[placeholder*="Search"]', { timeout: 20000 });
await page.fill('input[placeholder*="Search"]', "Walter");
await page.waitForTimeout(600);
await page.getByText(PATIENT, { exact: false }).first().click();
await page.waitForTimeout(300);

// Mobile sticky CTA (desktop button is hidden at iPhone width).
await page.getByRole("button", { name: /Generate briefing/i }).first().click();
console.log("clicked Generate");

// Wait for the rendered briefing (Follow-up / Flags section appears).
await page
  .waitForSelector("text=/Follow-up|Watch-flags|Flags|Trends|Summary/i", { timeout: 60000 })
  .then(() => console.log("briefing rendered in", ((Date.now() - t0) / 1000).toFixed(1), "s"))
  .catch(() => console.log("WARN: briefing selector not found"));
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT, fullPage: true });
console.log("screenshot saved to", OUT);
await browser.close();
process.exit(0);
