#!/usr/bin/env node
// Dev helper: screenshot a page of the running dev server.
//   node scripts/shot.mjs <url> <out.png> [--w 1440] [--h 900] [--full] [--wait <css selector>]
//        [--click <css selector>]... [--eval <js>] [--delay ms]
// Steps run in order: goto → wait → clicks → eval → delay → screenshot. Console errors are printed.
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const [url, out] = args;
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <out.png> [--w N] [--h N] [--full] [--wait sel] [--click sel]... [--eval js] [--delay ms]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const clicks = args.flatMap((a, i) => (a === "--click" ? [args[i + 1]] : []));

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(opt("w", 1440)), height: Number(opt("h", 900)) },
  deviceScaleFactor: 1,
});
page.on("console", (m) => {
  if (m.type() === "error") console.error(`[console.error] ${m.text()}`);
});
page.on("pageerror", (e) => console.error(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: "networkidle" });
const wait = opt("wait");
if (wait) await page.waitForSelector(wait, { timeout: 15000 });
for (const sel of clicks) {
  await page.click(sel);
  await page.waitForTimeout(400);
}
const js = opt("eval");
if (js) console.log(await page.evaluate(js));
await page.waitForTimeout(Number(opt("delay", 600)));
await page.screenshot({ path: out, fullPage: args.includes("--full") });
console.error(`saved ${out}`);
await browser.close();
