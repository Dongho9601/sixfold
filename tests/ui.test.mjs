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
        .run(JSON.stringify([0.4, 0.2, 0.15, 0.12, 0.1, 0.03]), state.id);
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
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#settings-restart").isDisabled(), true);
  await page.keyboard.press("Escape");
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
    for (const text of ["Right-click", "230 G gain", "100 rolls", "1 in 24", "Earlier peaks do not count", "Keyboard controls", "Sound effects", "Reduce motion", "Show probabilities", "1 to 6", "levels 5–6", "4%–8%", "5%–10%"])
      assert.ok(guide.includes(text), `Guide missing ${text}`);
    assert.ok(!guide.includes("Full rules in Settings"));
    if (!await page.locator(".odds-example").evaluate(element => element.open))
      await page.locator(".odds-example summary").click();
    assert.match(await page.locator(".odds-example").innerText(), /37\.61%/);
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

test("the final roll posts the final balance, freezes controls, and survives reload and restart", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
  assert.equal(await page.locator("#best-gold, #available").count(), 0);
  assert.equal(await page.locator("#jackpot-status").count(), 0);
  await page.locator('[data-target="n6"]').click();
  await page.keyboard.press("r");
  await settled(page, "330");
  assert.equal(await page.locator("#jackpot-status").count(), 0);
  assert.equal(await page.locator("#best-gold, #available").count(), 0);
  // Advance using the same HTTP API. Every safe hedge must consume a roll.
  await page.evaluate(async () => {
    let state = await (await fetch("/api/state")).json();
    for (let i = 0; i < 98; i++) {
      const response = await fetch("/api/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), revision: state.revision,
          action: { kind: "roll", wagers: { red: "1", black: "1" } } }),
      });
      if (!response.ok) throw new Error("Could not advance fixture run");
      state = (await response.json()).state;
    }
  });
  assert.ok(!store.leaderboard().some(player => player.id === id));
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#rolls-remaining").textContent === "1");
  await page.locator("#bet-amount").fill("50");
  await page.locator('[data-target="n6"]').click();
  await page.keyboard.press("r");
  await page.waitForFunction(() => !document.querySelector("#restart").hidden);
  assert.equal(await page.locator("#gold").innerText(), "280");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "0");
  assert.match(await page.locator("#run-status").innerText(), /Final score: 280 G/);
  for (const selector of ['[data-target="n1"]', "#roll", "#shake", "#bet-amount"])
    assert.equal(await page.locator(selector).isDisabled(), true);
  const completed = await saved(page);
  await page.keyboard.press("r");
  await page.keyboard.press("s");
  assert.equal((await saved(page)).revision, completed.revision);
  assert.equal(store.leaderboard().find(player => player.id === id).bestGold, "280");
  await page.reload();
  await page.waitForFunction(() => !document.querySelector("#restart").hidden);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/run-complete-${width}.png`, fullPage: true });
  }
  await page.locator("#restart").click();
  await settled(page, "100");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
  assert.equal((await saved(page)).bestGold, "280");
  assert.equal(await page.locator("#run-status").isVisible(), false);
  assert.equal(await page.locator("#restart").isVisible(), false);
  await page.screenshot({ path: "test-results/new-run-320.png", fullPage: true });
});

test("three sidebar cards highlight remaining rolls and keep the leaderboard compact", async t => {
  const page = await game(t);
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator(".sidebar > .stat-card").count(), 3);
    assert.deepEqual(await page.locator(".stat-card .eyebrow").allTextContents(),
      ["Bankroll", "Rolls remaining", "On the table"]);
    assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
    assert.ok(await page.locator("#rolls-remaining").evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 40));
    assert.equal(await page.locator("#available, #best-gold, .tower-progress, .your-record, .leaderboard-note, #edit-draft, #clear-draft, #draft-tray, #jackpot-status, .table-wager button").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/three-cards-${width}.png`, fullPage: true });
  }
  await page.locator('[data-target="n6"]').click();
  assert.equal(await page.locator("#draft-total").innerText(), "10 G");
  await page.keyboard.press("r");
  await settled(page, "330");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "99");
  await page.locator("#leaderboard-open").click();
  assert.equal(await page.locator("#leaderboard-dialog h2").innerText(), "Leaderboard");
  assert.equal(await page.locator("#leaderboard-dialog p, #leaderboard-dialog [role=progressbar]").count(), 0);
});

test("chips remove wagers on touch and desktop, and focused targets support keyboard removal", async t => {
  const page = await game(t, 390);
  // A real touch context exercises hit testing, not just a synthetic DOM click.
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  t.after(() => touchContext.close());
  await touchContext.addInitScript(() => {
    localStorage.setItem("one-of-six-sound", "off");
    localStorage.setItem("one-of-six-motion", "reduce");
  });
  const touch = await touchContext.newPage();
  await touch.goto(origin);
  await touch.locator("#welcome-start").tap();
  const touchTarget = touch.locator('[data-target="row0"]');
  await touchTarget.tap();
  assert.equal(await touch.locator("#draft-total").innerText(), "10 G");
  await touchTarget.locator(".table-chip").tap();
  assert.equal(await touch.locator("#draft-total").innerText(), "0 G");
  assert.equal((await saved(touch)).revision, "0");
  for (const id of ["n1", "row0", "col1", "black"]) {
    const target = page.locator(`[data-target="${id}"]`);
    await target.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#draft-total").innerText(), "20 G");
    await target.locator(".table-chip:last-child").click();
    assert.equal(await page.locator("#draft-total").innerText(), "0 G");
    for (const key of ["Delete", "Backspace"]) {
      await target.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press(key);
      assert.equal(await page.locator("#draft-total").innerText(), "0 G");
    }
    await target.click();
    await target.click({ button: "right" });
    assert.equal(await page.locator("#draft-total").innerText(), "0 G");
  }
  assert.equal(await page.locator("#gold").innerText(), "100");
  assert.equal((await saved(page)).revision, "0");
});

test("the table and guide display all six Tilt levels", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  for (const [index, peak] of [1 / 6, .4, .475, .5, .55, .7].entries()) {
    const probabilities = [peak, ...Array(5).fill((1 - peak) / 5)];
    store.db.prepare("UPDATE players SET probabilities = ? WHERE id = ?").run(JSON.stringify(probabilities), id);
    await page.reload();
    await page.waitForFunction(level => document.querySelector("#tilt-level").textContent === level, String(index + 1));
    assert.match(await page.locator("#tilt-info").getAttribute("aria-label"), new RegExp(`level ${index + 1} of 6`));
  }
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/six-tilts-${width}.png`, fullPage: true });
  }
});

test("bankruptcy restart animates the die and cards while actions stay locked", async t => {
  const page = await game(t);
  await page.locator("#bet-amount").fill("100");
  await page.locator('[data-target="n1"]').click();
  await page.keyboard.press("r");
  await page.waitForFunction(() => document.querySelector("#gold").textContent === "0" && !document.querySelector("#restart").hidden);
  assert.equal(await page.locator("#rolls-remaining").innerText(), "99");
  await page.locator("#settings-open").click();
  await page.locator("#motion").uncheck();
  await page.keyboard.press("Escape");
  await page.locator("#restart").click();
  await page.waitForFunction(() => document.querySelector("#game").classList.contains("is-restarting") && document.querySelector(".departing-die"));
  assert.equal(await page.locator("#restart").isDisabled(), true);
  assert.equal(await page.locator('[data-target="n1"]').isDisabled(), true);
  assert.ok(await page.locator(".remaining-rolls").evaluate(element => element.getAnimations().length > 0));
  await page.keyboard.press("r");
  await page.keyboard.press("s");
  await page.screenshot({ path: "test-results/restart-transition.png", fullPage: true });
  await settled(page, "100");
  assert.equal(await page.locator(".departing-die, .is-restarting").count(), 0);
  assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
  const state = await saved(page);
  assert.equal(state.revision, "2");
  assert.equal(state.rollsUsed, 0);
  assert.equal(state.canShake, false);
  assert.equal(state.hasCompletedRun, false);
});

test("Settings restart requires confirmation, cancels safely, and animates a fresh run", async t => {
  const page = await game(t);
  await page.locator('[data-target="n6"]').click();
  await page.keyboard.press("r");
  await settled(page, "330");
  await page.locator('[data-target="n2"]').click();
  const before = await saved(page);
  const leaders = store.leaderboard();
  await page.locator("#settings-open").click();
  await page.locator("#motion").uncheck();
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/settings-restart-${width}.png`, fullPage: true });
    await page.locator("#settings-restart").click();
    assert.equal(await page.locator("#restart-dialog").isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "restart-cancel");
    assert.match(await page.locator("#restart-description").innerText(), /100 G and 100 rolls/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.keyboard.press("r");
    await page.keyboard.press("s");
    await page.screenshot({ path: `test-results/restart-confirm-${width}.png`, fullPage: true });
    if (width === 1280) await page.locator("#restart-cancel").click();
    else await page.keyboard.press("Escape");
    assert.equal(await page.locator("#restart-dialog").isVisible(), false);
    assert.equal(await page.locator("#settings-dialog").isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "settings-restart");
    assert.deepEqual(await saved(page), before);
    assert.equal(await page.locator("#draft-total").innerText(), "10 G");
  }
  await page.locator("#settings-restart").click();
  await page.locator("#restart-confirm").click();
  await page.waitForFunction(() => document.querySelector("#game").classList.contains("is-restarting"));
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.equal(await page.locator("#settings-restart").isDisabled(), true);
  assert.equal(await page.locator('[data-target="n1"]').isDisabled(), true);
  await settled(page, "100");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
  assert.equal(await page.locator("#draft-total").innerText(), "0 G");
  const restarted = await saved(page);
  assert.equal(restarted.revision, "2");
  assert.equal(restarted.rollsUsed, 0);
  assert.equal(restarted.lastRoll, null);
  assert.equal(restarted.canShake, false);
  assert.equal(restarted.hasCompletedRun, false);
  assert.deepEqual(store.leaderboard(), leaders);
  await page.reload();
  await settled(page, "100");
  assert.deepEqual(await saved(page), restarted);
});
