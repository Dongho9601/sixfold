import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { Store } from "../server/store.ts";
import { createGameServer } from "../server/http.ts";

let browser, vite, server, store, origin;
before(async () => {
  let draws = 0;
  class FixtureStore extends Store {
    create() {
      const { token, state } = super.create();
      this.db.prepare("UPDATE players SET probabilities = ? WHERE id = ?")
        .run(JSON.stringify([0.4, 0.2, 0.15, 0.1, 0.1, 0.05]), state.id);
      draws = 0;
      return { token, state: this.get(state.id) };
    }
  }
  store = new FixtureStore(":memory:", () => draws++ === 0 ? 0.99 : 0.1);
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "spa" });
  server = createGameServer(store, (req, res) => vite.middlewares(req, res));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  });
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  store?.close();
});

async function game(t, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await page.addInitScript(() => {
    localStorage.setItem("one-of-six-sound", "off");
    localStorage.setItem("one-of-six-motion", "reduce");
  });
  await page.goto(origin);
  await page.locator("#welcome-start").click();
  return page;
}
const saved = page => page.evaluate(async () => (await fetch("/api/state")).json());
async function settled(page, gold) {
  await page.waitForFunction(value =>
    document.querySelector("#gold").textContent === value &&
    !document.querySelector('[data-target="n1"]').disabled, gold);
}

test("click a bet then R settles exactly once; uppercase R works too", async t => {
  const page = await game(t);
  await page.locator('[data-target="n6"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.target), "n6");
  await page.keyboard.press("r");
  await settled(page, "330");
  assert.equal((await saved(page)).revision, "1");
  assert.equal((await saved(page)).lastRoll.jackpot, true);
  assert.equal(await page.locator("#draft-total").innerText(), "0 G");
  assert.equal(await page.locator("#tilt-level").innerText(), "1");
  await page.locator('[data-target="n2"]').click();
  await page.keyboard.press("Shift+R");
  await settled(page, "320");
  assert.equal((await saved(page)).revision, "2");
});

test("keyboard placement with Enter then R works from the focused target", async t => {
  const page = await game(t);
  await page.locator('[data-target="row1"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#draft-total").innerText(), "10 G");
  await page.keyboard.press("r");
  await settled(page, "110");
  assert.equal((await saved(page)).lastRoll.totalReturn, "20");
});

test("S respects the lock and works from a target after a bankroll change", async t => {
  const page = await game(t);
  await page.locator('[data-target="row1"]').click();
  await page.keyboard.press("s");
  assert.equal((await saved(page)).revision, "0");
  await page.keyboard.press("r");
  await settled(page, "110");
  assert.equal((await saved(page)).canShake, true);
  await page.locator('[data-target="n1"]').click();
  await page.keyboard.press("s");
  await page.waitForFunction(() => document.querySelector("#draft-total").textContent === "0 G" &&
    !document.querySelector('[data-target="n1"]').disabled);
  const state = await saved(page);
  assert.equal(state.revision, "2");
  assert.equal(state.gold, "110");
  assert.equal(state.canShake, false);
  assert.equal(state.tiltLevel, 1);
  assert.equal(await page.locator("#shake").isDisabled(), true);
});

test("shortcuts ignore text fields, dialogs, modifiers, repeats, composition and consumed keys", async t => {
  const page = await game(t);
  await page.locator('[data-target="n6"]').click();
  await page.locator("#bet-amount").focus();
  await page.keyboard.press("r");
  await page.keyboard.press("s");
  assert.equal((await saved(page)).revision, "0");
  await page.locator("#bet-amount").fill("10");
  for (const opener of ["settings-open", "guide-open"]) {
    await page.locator(`#${opener}`).click();
    await page.locator("dialog[open] .icon-button").focus();
    await page.keyboard.press("r");
    await page.keyboard.press("s");
    assert.equal((await saved(page)).revision, "0");
    await page.keyboard.press("Escape");
  }
  const target = page.locator('[data-target="n6"]');
  await target.focus();
  for (const flag of ["ctrlKey", "metaKey", "altKey", "repeat", "isComposing"])
    await target.dispatchEvent("keydown", { key: "r", [flag]: true, bubbles: true });
  await page.evaluate(() => {
    const button = document.activeElement;
    const event = new KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true });
    event.preventDefault();
    button.dispatchEvent(event);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.innerHTML = "<span>Editable text</span>";
    document.body.append(editable);
    editable.firstChild.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
    editable.remove();
  });
  assert.equal((await saved(page)).revision, "0");
  // The blocked events did not consume or change the draft.
  await target.focus();
  await page.keyboard.press("r");
  await settled(page, "330");
});

test("busy Roll cannot be resubmitted by a second keypress", async t => {
  const page = await game(t);
  let release;
  const gate = new Promise(resolve => release = resolve);
  let requests = 0;
  await page.route("**/api/action", async route => {
    requests++;
    await gate;
    await route.continue();
  });
  await page.locator('[data-target="n6"]').click();
  await page.keyboard.press("r");
  await page.keyboard.press("r");
  await page.keyboard.press("s");
  assert.equal(await page.locator("#roll").isDisabled(), true);
  release();
  await settled(page, "330");
  assert.equal(requests, 1);
  assert.equal((await saved(page)).revision, "1");
});

test("Settings stays compact and the complete guide works on desktop and mobile", async t => {
  const page = await game(t);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#settings-open").click();
    assert.equal(await page.locator("#settings-dialog h3, #settings-dialog small").count(), 0);
    await page.locator("#nickname").fill("Reader");
    await page.locator("#save-nickname").click();
    await page.waitForFunction(() => document.querySelector("#nickname-status").textContent === "Name saved.");
    await page.locator("#show-probabilities").check();
    assert.equal(await page.locator(".probability, .group-odds").count(), 13);
    await page.locator("#show-probabilities").uncheck();
    await page.locator("#settings-guide").click();
    assert.equal(await page.locator("#settings-dialog").isVisible(), false);
    const guide = await page.locator("#welcome-dialog").innerText();
    for (const text of ["Right-click", "230 G gain", "Keyboard controls", "Sound effects", "Reduce motion", "Show probabilities", "6%–12%", "18%–36%"])
      assert.ok(guide.includes(text), `Guide missing ${text}`);
    assert.ok(!guide.includes("Full rules in Settings"));
    if (!await page.locator(".odds-example").evaluate(element => element.open))
      await page.locator(".odds-example summary").click();
    assert.match(await page.locator(".odds-example").innerText(), /34\.87%/);
    assert.equal(await page.evaluate(() => {
      const guide = document.querySelector("#welcome-dialog");
      return guide.scrollWidth > guide.clientWidth || document.documentElement.scrollWidth > innerWidth;
    }), false);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "settings-open");
    await page.locator("#tilt-info").click();
    assert.equal(await page.evaluate(() => document.activeElement.className), "tilt-guide");
    const heading = await page.locator(".tilt-guide").boundingBox();
    const header = await page.locator("#welcome-dialog .dialog-top").boundingBox();
    assert.ok(heading.y >= header.y + header.height, "Sticky title covers the Tilt heading");
    await page.locator('[data-close="welcome-dialog"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), "tilt-info");
  }
});
