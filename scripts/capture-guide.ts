import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { preview } from "vite";
import { CONFIG, TUTORIAL_VERSION } from "../src/config.ts";
import { newRun } from "../src/game/run.ts";
import { SAVE_KEY, type Save } from "../src/save.ts";

// Capture production UI in isolated browser saves. No guide-only styling,
// replacement markup, or edits to the screenshots are applied.
const directory = resolve("public/guide");
await mkdir(directory, { recursive: true });
const vite = await preview({ preview: { host: "127.0.0.1", port: 0 } });
const address = vite.httpServer.address();
if (!address || typeof address === "string") throw new Error("Preview server has no port.");
const origin = `http://127.0.0.1:${address.port}/sixfold/`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
const manifest: Record<string, unknown> = {};
const dimensions: Record<string, { width: number; height: number }> = {};

function fixture(probabilities = [.2, .2, .2, .15, .15, .1]): Save {
  const state = newRun("a".repeat(32), "Player", () => .1);
  state.probabilities = probabilities;
  return { version: 1, revision: "0", state,
    settings: { sound: false, reducedMotion: true, swapMobileActions: false,
      guideSeen: true, tutorialVersion: TUTORIAL_VERSION, guideLanguage: "en", recentAmounts: [] }, records: [] };
}

async function load(page: Page, save: Save) {
  await page.goto(origin);
  await page.evaluate(({ key, save }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(save));
  }, { key: SAVE_KEY, save });
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#gold")?.textContent !== "—");
  await page.evaluate(() => document.fonts.ready);
}

async function roll(page: Page, outcome: number, gold: string) {
  await page.evaluate(({ key, outcome }) => {
    const { probabilities } = JSON.parse(localStorage.getItem(key)!).state;
    const draw = probabilities.slice(0, outcome - 1).reduce((sum: number, value: number) => sum + value, 0) + probabilities[outcome - 1] / 2;
    const original = crypto.getRandomValues.bind(crypto);
    let first = true;
    crypto.getRandomValues = (array => {
      if (!(array instanceof Uint8Array) || array.length !== 6) return original(array);
      let value = Math.floor((first ? draw : .1) * 2 ** 48);
      first = false;
      const bytes = array;
      for (let i = 5; i >= 0; i--) { bytes[i] = value % 256; value = Math.floor(value / 256); }
      return array;
    }) as typeof crypto.getRandomValues;
  }, { key: SAVE_KEY, outcome });
  await page.locator("#roll").click();
  await page.waitForFunction(value => document.querySelector("#gold")?.textContent === value &&
    !document.querySelector<HTMLButtonElement>("#increase")?.disabled, gold);
  await page.mouse.move(0, 0);
}

async function capture(page: Page, name: string, selectors: string[], margin = 16) {
  const clip = await page.evaluate(({ selectors, margin }) => {
    // Include overflowing labels, then keep some of the real surrounding UI.
    const elements = selectors.flatMap(selector => {
      const element = document.querySelector(selector)!;
      return [element, ...element.querySelectorAll("*")];
    });
    const bounds = elements.map(element => element.getBoundingClientRect())
      .filter(bound => bound.width > 0 && bound.height > 0);
    const x = Math.max(0, Math.floor(Math.min(...bounds.map(b => b.left))) - margin);
    const y = Math.max(0, Math.floor(Math.min(...bounds.map(b => b.top))) - margin);
    const right = Math.min(innerWidth, Math.ceil(Math.max(...bounds.map(b => b.right))) + margin);
    const bottom = Math.min(innerHeight, Math.ceil(Math.max(...bounds.map(b => b.bottom))) + margin);
    return { x, y, width: right - x, height: bottom - y };
  }, { selectors, margin });
  await page.screenshot({ path: resolve(directory, `${name}.jpg`), type: "jpeg", quality: 92, clip, animations: "disabled" });
  // Captures use two device pixels per CSS pixel in both layouts.
  dimensions[name] = { width: clip.width * 2, height: clip.height * 2 };
  manifest[name] = { ...dimensions[name],
    viewport: page.viewportSize(), selectors, margin, clip,
    state: await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY),
    bets: await page.locator('[data-target][aria-pressed="true"]').evaluateAll(targets =>
      targets.map(target => ({ target: (target as HTMLElement).dataset.target, description: target.getAttribute("aria-label") }))),
    covered: await page.locator(".number-target.covered").evaluateAll(targets => targets.map(target => (target as HTMLElement).dataset.target)),
  };
}

try {
  for (const [layout, viewport] of [
    ["desktop", { width: 1100, height: 850 }],
    ["mobile", { width: 390, height: 700 }],
  ] as const) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await load(page, fixture());
    await page.mouse.move(0, 0);
    await capture(page, `start-${layout}`, ["#game"]);

    for (const [name, target, coverage] of [
      ["number", "n3", ["n3"]], ["column", "col1", ["n3", "n4"]],
      ["odds", "row0", ["n1", "n3", "n5"]], ["red", "red", ["n1", "n5", "n4"]],
    ] as const) {
      await load(page, fixture());
      const button = page.locator(`[data-target="${target}"]`);
      await button.click();
      await button.hover();
      assert.deepEqual(await page.locator(".number-target.covered").evaluateAll(targets =>
        targets.map(target => (target as HTMLElement).dataset.target)), coverage);
      assert.equal(await page.locator("#draft-gold").innerText(), "10");
      // Keep the complete table frame, including chips that overlap cell edges.
      await capture(page, `coverage-${name}-${layout}`, [".table-area"], 4);
      if (name === "number") {
        await page.mouse.move(0, 0);
        await capture(page, `bet-${layout}`, ["#game"]);
      }
    }

    await load(page, fixture());
    await page.locator('[data-target="n3"]').click();
    await page.locator('[data-target="row0"]').click();
    await roll(page, 3, "160");
    assert.equal(await page.locator("#rolls-remaining").innerText(), String(CONFIG.rollsPerRun - 1));
    assert.equal(await page.locator("#board-net").innerText(), "+60 G");
    await capture(page, `settlement-${layout}`, ["#game"]);

    await load(page, fixture());
    await page.locator('[data-target="n3"]').click();
    await roll(page, 2, "90");
    await page.locator('[data-target="n3"]').click();
    await roll(page, 3, "140");
    assert.equal(await page.locator("#board-net").innerText(), "+40 G");
    assert.equal(await page.locator("#shake").isEnabled(), true);
    await capture(page, `shake-${layout}`, ["#game"]);

    await load(page, fixture([.25, .2, .03, .2, .2, .12]));
    await page.locator('[data-target="n3"]').click();
    await page.mouse.move(0, 0);
    await capture(page, `jackpot-${layout}`, ["#game"]);

    const complete = fixture();
    Object.assign(complete.state, { gold: "150", rollsUsed: CONFIG.rollsPerRun, canShake: false });
    await load(page, complete);
    await page.locator("#run-dialog").waitFor({ state: "visible" });
    assert.equal(await page.locator("#run-score").innerText(), "150 G");
    await capture(page, `complete-${layout}`, ["#run-dialog"]);

    if (layout === "desktop") {
      for (const [name, probabilities, level] of [
        ["even", Array.from({ length: 6 }, () => 1 / 6), 1],
        ["biased", [.7, .1, .08, .05, .04, .03], 6],
      ] as const) {
        await load(page, fixture([...probabilities]));
        assert.equal(await page.locator("#tilt-number").innerText(), `Tilt ${level}`);
        await page.mouse.move(0, 0);
        await capture(page, `tilt-${name}`, ["#tilt-info"], 8);
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(resolve(directory, "captures.json"), JSON.stringify({
    source: "Production UI captured by scripts/capture-guide.ts; isolated staged saves and actual bet/roll controls.",
    configuration: CONFIG, images: manifest,
  }, null, 2) + "\n");
  await writeFile(resolve("src/guide-images.ts"), `// Generated by scripts/capture-guide.ts. Reserve space before screenshots load.\nexport const guideImages = ${JSON.stringify(dimensions, null, 2)} as const;\n`);
  console.log(`Captured ${Object.keys(manifest).length} actual-game screenshots in public/guide.`);
} finally {
  await browser.close();
  await new Promise<void>(resolve => vite.httpServer.close(() => resolve()));
}
