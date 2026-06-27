// Computer-use test: iPhone-emulated, authenticate through the gate, generate a
// briefing, screenshot it. Usage: node scripts/shot.mjs [url] [out.png] [patient]
import { chromium, devices } from "playwright";

const BASE = process.argv[2] || "https://clinic-prep-assistant.vercel.app";
const OUT = process.argv[3] || "/tmp/briefing_concise.png";
const PATIENT = process.argv[4] || "Walter Okonkwo";
const EMAIL = process.env.APP_EMAIL || "a.kar.wright@gmail.com";
const PASS = process.env.APP_PASSWORD || "vercelship";

const iPhone = devices["iPhone 14 Pro"] || devices["iPhone 13"];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...iPhone });
const page = await ctx.newPage();
page.on("response", (r) => {
  if (r.url().includes("/api/prep")) console.log("  /api/prep ->", r.status());
});

// Authenticate into the browser context via the API (sets the session cookie),
// then load the now-unlocked app.
const lr = await ctx.request.post(BASE + "/api/login", { data: { email: EMAIL, password: PASS } });
console.log("login:", lr.status());

const t0 = Date.now();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
try {
  await page.waitForSelector('input[placeholder*="Search"]', { timeout: 30000 });
  await page.fill('input[placeholder*="Search"]', PATIENT.split(" ")[0]);
  await page.waitForTimeout(600);
  await page.getByText(PATIENT, { exact: false }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Generate briefing/i }).first().click();
  console.log("clicked Generate");
  await page.waitForSelector("text=/Ask today|Watch|Trends|Snapshot|Follow|flag/i", { timeout: 60000 });
  console.log("briefing rendered in", ((Date.now() - t0) / 1000).toFixed(1), "s");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT, fullPage: true });
  console.log("screenshot saved to", OUT);
} catch (e) {
  console.log("FAIL:", String(e.message).split("\n")[0], "| url:", page.url());
  await page.screenshot({ path: OUT, fullPage: true });
  console.log("failure screenshot saved to", OUT);
}
await browser.close();
process.exit(0);
