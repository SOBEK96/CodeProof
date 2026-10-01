#!/usr/bin/env node
// Verifies the built HUD loads the LIVE contract with zero console errors.
//
//   npm run build && npm run console-check
//
// Env: CHECK_URL (skip the built-in preview server), CHROME_PATH (Chrome/Chromium binary).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const PORT = 4173;
const URL_TO_CHECK = process.env.CHECK_URL ?? `http://127.0.0.1:${PORT}/`;
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error("No Chrome binary found. Set CHROME_PATH.");
  process.exit(2);
}

let server = null;
if (!process.env.CHECK_URL) {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL_TO_CHECK)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

const problems = [];
const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const loc = m.location()?.url ?? "";
    if (FONT_HOSTS.some((h) => loc.includes(h))) return; // offline font CDN is cosmetic
    problems.push(`console.error: ${m.text()} ${loc}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    if (FONT_HOSTS.some((h) => r.url().includes(h))) return;
    problems.push(`requestfailed: ${r.url()} (${r.failure()?.errorText})`);
  });

  await page.goto(URL_TO_CHECK, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('[data-testid="grants-loaded"]', { timeout: 90000 });

  const banner = await page.evaluate(() => document.querySelector('[data-testid="load-error"]')?.textContent ?? null);
  if (banner) problems.push(`contract load error banner: ${banner}`);
  const rows = await page.evaluate(() => document.querySelectorAll("#milestones article").length);
  if (rows === 0 && !banner) problems.push("live contract loaded but returned zero grants");
  const navH = await page.evaluate(() => Math.round(document.querySelector("header nav").getBoundingClientRect().height));
  if (navH !== 64) problems.push(`navbar height is ${navH}px, expected 64px`);

  console.log(`rows rendered from live contract: ${rows}, navbar height: ${navH}px`);
} catch (e) {
  problems.push(`check failed: ${e.message}`);
} finally {
  await browser.close();
  server?.kill();
}

if (problems.length) {
  console.error(`\nFAIL - ${problems.length} problem(s):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log("PASS - zero console errors on live contract load");
