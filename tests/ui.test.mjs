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
  server = createGameServer(store, (req, res) => vite.middlewares(req, res), {
    // Only this in-memory fixture advances whole runs without human pacing.
    limits: { actions: { capacity: 1000, perSecond: 1000 } },
  });
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

async function game(t, width = 1280, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, ...options });
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
  // dialog.close queues its close event and focus restoration separately.
  await page.waitForFunction(() => !document.querySelector("#welcome-dialog").open && document.activeElement.id === "bet-amount");
  return page;
}
// Fixture SQL edits intentionally bypass action revisions; inspect them uncached.
const saved = page => page.evaluate(async () => (await fetch("/api/state", { cache: "no-store" })).json());
async function settled(page, gold) {
  await page.waitForFunction(value =>
    document.querySelector("#gold").textContent === value &&
    !document.querySelector('[data-target="n1"]').disabled, gold);
}

test("columns show ordinal pairs and rows show Odds/Evens at desktop and mobile widths", async t => {
  const page = await game(t);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [id, label, coverage, multiplier] of [
      ["col0", "1st 2", "1, 2", 3], ["col1", "2nd 2", "3, 4", 3], ["col2", "3rd 2", "5, 6", 3],
      ["row0", "Odds", "1, 3, 5", 2], ["row1", "Evens", "2, 4, 6", 2],
    ]) {
      const target = page.locator(`[data-target="${id}"]`);
      assert.equal(await target.locator(".group-title > span").innerText(), label);
      assert.equal(await target.locator(".group-title b").innerText(), `×${multiplier}`);
      assert.ok((await target.getAttribute("aria-label")).includes(`${label}, covers ${coverage}`));
      assert.equal(await target.locator(".group-title").evaluate(element => element.scrollWidth > element.clientWidth), false);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/board-labels-${width}.png`, fullPage: true });
  }
});

test("probabilities need confirmation, preserve draft bets, exclude the run through reload and hiding, then reset", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  store.db.prepare("UPDATE players SET best_gold='80',has_completed_run=1 WHERE id=?").run(id);
  await page.evaluate(() => localStorage.setItem("sixfold-show-probabilities", "on"));
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-target="n1"]').disabled);
  assert.equal(await page.locator(".probability, .group-odds").count(), 0);
  assert.equal((await saved(page)).showProbabilities, false);
  await page.locator('[data-target="n1"]').click();
  const chips = await page.locator('[data-target="n1"] .chip-pile').innerHTML();
  await page.locator("#settings-open").click();
  assert.equal(await page.locator('label:has(#show-probabilities) span').innerText(), "Show probabilities");
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#show-probabilities").click();
    assert.equal(await page.locator("#probabilities-dialog").isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "probabilities-cancel");
    assert.match(await page.locator("#probabilities-description").innerText(), /will not enter the leaderboard, even if you turn probabilities off later/);
    assert.equal(await page.locator("#show-probabilities").isChecked(), false);
    assert.equal(await page.locator(".probability, .group-odds").count(), 0);
    assert.equal((await saved(page)).revision, "0");
    assert.equal(await page.locator("#probabilities-dialog").evaluate(element => element.scrollWidth > element.clientWidth), false);
    await page.screenshot({ path: `test-results/probabilities-confirm-${width}.png`, fullPage: true });
    if (width === 1280) await page.locator("#probabilities-cancel").click();
    else await page.keyboard.press("Escape");
    assert.equal((await saved(page)).leaderboardEligible, true);
    assert.equal(await page.locator("#show-probabilities").isChecked(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), "show-probabilities");
  }
  await page.locator("#show-probabilities").click();
  await page.locator("#probabilities-confirm").click();
  await page.waitForFunction(() => document.querySelectorAll(".probability, .group-odds").length === 13 && !document.querySelector("#show-probabilities").disabled);
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  assert.equal(await page.locator('[data-target="n1"] .chip-pile').innerHTML(), chips);
  const shown = await saved(page);
  assert.equal(shown.showProbabilities, true);
  assert.equal(shown.leaderboardEligible, false);
  assert.equal(shown.rollsUsed, 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".probability, .group-odds").length === 13);
  await page.locator("#settings-open").click();
  assert.equal(await page.locator("#show-probabilities").isChecked(), true);
  await page.locator("#show-probabilities").click();
  await page.waitForFunction(() => document.querySelectorAll(".probability, .group-odds").length === 0 && !document.querySelector("#show-probabilities").disabled);
  assert.equal((await saved(page)).leaderboardEligible, false);
  assert.match(await page.locator("#probabilities-status").innerText(), /excluded from the leaderboard/);
  await page.keyboard.press("Escape");
  store.db.prepare("UPDATE players SET rolls_used=99 WHERE id=?").run(id);
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#rolls-remaining").textContent === "1");
  await page.locator("#bet-amount").fill("1");
  await page.locator('[data-target="red"]').click();
  await page.locator('[data-target="black"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(() => document.querySelector("#run-dialog").open);
  assert.equal(await page.locator("#run-score").innerText(), "100 G");
  assert.match(await page.locator("#run-comparison").innerText(), /excluded from the leaderboard/);
  assert.equal(await page.locator("#run-best").innerText(), "80 G");
  assert.equal(store.leaderboard(id).find(player => player.id === id).bestGold, "80");
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#run-dialog").open);
  assert.match(await page.locator("#run-comparison").innerText(), /excluded from the leaderboard/);
  await page.locator("#run-confirm").click();
  await settled(page, "100");
  const restarted = await saved(page);
  assert.equal(restarted.showProbabilities, false);
  assert.equal(restarted.leaderboardEligible, true);
  assert.equal(restarted.bestGold, "80");
  assert.equal(await page.locator(".probability, .group-odds").count(), 0);
  assert.equal(await page.locator("#run-status").isVisible(), false);
});

test("a lost probability confirmation response recovers the committed setting after reload", async t => {
  const page = await game(t);
  await page.route("**/api/action", async route => {
    const request = route.request().postDataJSON();
    if (request.action.kind === "probabilities") {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.locator("#settings-open").click();
  await page.locator("#show-probabilities").click();
  await page.locator("#probabilities-confirm").click();
  await page.waitForFunction(() => !!sessionStorage.getItem("sixfold-100-rolls-pending") && !document.querySelector("#retry").hidden);
  assert.equal((await saved(page)).leaderboardEligible, false);
  await page.unroute("**/api/action");
  await page.reload();
  await page.waitForFunction(() => !sessionStorage.getItem("sixfold-100-rolls-pending") && document.querySelectorAll(".probability, .group-odds").length === 13);
  const recovered = await saved(page);
  assert.equal(recovered.revision, "1");
  assert.equal(recovered.showProbabilities, true);
  assert.equal(recovered.leaderboardEligible, false);
});

test("click a bet then R settles exactly once; uppercase R works too", async t => {
  const page = await game(t);
  await page.locator('[data-target="n6"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.target), "n6");
  await page.keyboard.press("r");
  await settled(page, "330");
  assert.equal((await saved(page)).revision, "1");
  assert.equal((await saved(page)).lastRoll.jackpot, true);
  assert.equal(await page.locator("#draft-total").textContent(), "0 G");
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
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  await page.keyboard.press("r");
  await settled(page, "110");
  assert.equal((await saved(page)).lastRoll.totalReturn, "20");
});

test("Space respects the lock and shakes from a focused target without placing another bet", async t => {
  const page = await game(t);
  await page.locator('[data-target="row1"]').click();
  await page.keyboard.press("Space");
  assert.equal((await saved(page)).revision, "0");
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  await page.keyboard.press("r");
  await settled(page, "110");
  assert.equal((await saved(page)).canShake, true);
  await page.locator('[data-target="n1"]').click();
  await page.keyboard.press("s"); // The old shortcut is no longer active.
  assert.equal((await saved(page)).revision, "1");
  await page.keyboard.press("Space");
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
  await page.keyboard.press("Space");
  assert.equal((await saved(page)).revision, "0");
  await page.locator("#bet-amount").fill("10");
  for (const opener of ["settings-open", "guide-open"]) {
    await page.locator(`#${opener}`).click();
    await page.locator("dialog[open] .icon-button").focus();
    await page.keyboard.press("r");
    await page.locator("dialog[open] .icon-button").dispatchEvent("keydown", { key: " ", bubbles: true });
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
  await page.keyboard.press("Space");
  await page.keyboard.press("q");
  await page.keyboard.press("e");
  await page.keyboard.press("1");
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  assert.equal(await page.locator("#bet-amount").inputValue(), "10");
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
    await page.locator("#show-probabilities").click();
    await page.locator("#probabilities-confirm").click();
    await page.waitForFunction(() => document.querySelectorAll(".probability, .group-odds").length === 13 && !document.querySelector("#show-probabilities").disabled);
    await page.locator("#show-probabilities").click();
    await page.waitForFunction(() => !document.querySelector("#show-probabilities").disabled);
    assert.equal(await page.locator("#settings-dialog").getByText("How to play", { exact: true }).count(), 0);
    await page.screenshot({ path: `test-results/settings-${width}.png` });
    await page.keyboard.press("Escape");
    await page.locator("#guide-open").click();
    assert.equal(await page.locator("#settings-dialog").isVisible(), false);
    const guide = await page.locator("#welcome-dialog").innerText();
    for (const text of ["100 rolls", "least likely number", "×24", "Keyboard controls", "Tilt 1–2", "5–6", "Space", "W / E", "Q / Esc"])
      assert.ok(guide.includes(text), `Guide missing ${text}`);
    assert.ok(!guide.includes("1 in 24"));
    assert.ok(!guide.includes("Full rules in Settings"));
    if (!await page.locator(".guide-details").evaluate(element => element.open))
      await page.locator(".guide-details summary").click();
    const details = await page.locator(".guide-details").innerText();
    for (const text of ["Press and hold", "right-click", "Earlier peaks do not count", "Sound effects", "Reduce motion", "Show probabilities", "4%–8%", "5%–10%", "37.61%"])
      assert.ok(details.includes(text), `Details missing ${text}`);
    await page.screenshot({ path: `test-results/guide-details-${width}.png` });
    assert.equal(await page.evaluate(() => {
      const guide = document.querySelector("#welcome-dialog");
      return guide.scrollWidth > guide.clientWidth || document.documentElement.scrollWidth > innerWidth;
    }), false);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "guide-open");
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
  await page.waitForFunction(() => document.querySelector("#run-dialog").open);
  assert.equal(await page.locator("#gold").innerText(), "280");
  assert.equal(await page.locator("#run-score").innerText(), "280 G");
  assert.match(await page.locator("#run-comparison").innerText(), /first completed run/);
  assert.equal(await page.locator("#run-best").innerText(), "280 G");
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
  await page.waitForFunction(() => document.querySelector("#run-dialog").open);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/run-complete-${width}.png` });
  }
  assert.match(await page.locator("#run-comparison").innerText(), /first completed run/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#run-dialog").isVisible(), true);
  await page.locator("#run-nickname").fill("Finisher");
  await page.locator("#run-confirm").click();
  await settled(page, "100");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
  assert.equal((await saved(page)).bestGold, "280");
  assert.equal((await saved(page)).nickname, "Finisher");
  assert.equal(store.leaderboard().find(player => player.id === id).nickname, "Finisher");
  assert.equal(await page.locator("#run-status").isVisible(), false);
  assert.equal(await page.locator("#restart").count(), 0);
  assert.equal(await page.locator("#run-dialog").isVisible(), false);
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
    assert.ok(await page.locator("#rolls-remaining").evaluate((element, minimum) => parseFloat(getComputedStyle(element).fontSize) >= minimum, width <= 650 ? 26 : 40));
    assert.equal(await page.locator("#available, #best-gold, .tower-progress, .your-record, .leaderboard-note, #edit-draft, #clear-draft, #draft-tray, #jackpot-status, .table-wager button").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/three-cards-${width}.png`, fullPage: true });
  }
  await page.locator('[data-target="n6"]').click();
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  await page.keyboard.press("r");
  await settled(page, "330");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "99");
  await page.locator("#leaderboard-open").click();
  assert.equal(await page.locator("#leaderboard-dialog h2").innerText(), "Leaderboard");
  assert.equal(await page.locator("#leaderboard-dialog p, #leaderboard-dialog [role=progressbar]").count(), 0);
});

test("left clicks and taps on chips add bets; right-click and keyboard remove wagers", async t => {
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
  assert.equal(await touch.locator("#draft-total").textContent(), "10 G");
  await touchTarget.locator(".table-chip").tap();
  assert.equal(await touch.locator("#draft-total").textContent(), "20 G");
  assert.equal((await saved(touch)).revision, "0");
  for (const id of ["n1", "row0", "col1", "black"]) {
    const target = page.locator(`[data-target="${id}"]`);
    await target.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#draft-total").textContent(), "20 G");
    await target.locator(".table-chip:last-child").click();
    assert.equal(await page.locator("#draft-total").textContent(), "30 G");
    await target.locator(".table-chip:last-child").click({ button: "right" });
    assert.equal(await page.locator("#draft-total").textContent(), "0 G");
    for (const key of ["Delete", "Backspace"]) {
      await target.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press(key);
      assert.equal(await page.locator("#draft-total").textContent(), "0 G");
    }
    await target.click();
    await target.click({ button: "right" });
    assert.equal(await page.locator("#draft-total").textContent(), "0 G");
  }
  assert.equal(await page.locator("#gold").innerText(), "100");
  assert.equal((await saved(page)).revision, "0");
});

test("the complete phone game fits portrait and landscape viewports during play", async t => {
  const page = await game(t, 390, { isMobile: true, hasTouch: true });
  const fits = async label => {
    await page.evaluate(() => scrollTo(0, 0));
    const layout = await page.evaluate(() => ({
      width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      controls: [...document.querySelectorAll(".stat-card, #tilt-info, [data-target], .amount-selector, #recent-amounts, #roll, #shake, .site-information")].map(element => {
        const bounds = element.getBoundingClientRect();
        return { name: element.id || element.dataset.target || element.className, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
      }),
    }));
    assert.ok(layout.scrollWidth <= layout.width, `${label}: horizontal overflow`);
    assert.ok(layout.scrollHeight <= layout.height + 1, `${label}: vertical overflow (${layout.scrollHeight} / ${layout.height})`);
    for (const bounds of layout.controls) {
      assert.ok(bounds.left >= 0 && bounds.right <= layout.width + 1 && bounds.top >= 0 && bounds.bottom <= layout.height + 1,
        `${label}: ${bounds.name} is outside the viewport`);
    }
  };
  for (const [width, height] of [[320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [568, 320], [667, 375], [844, 390], [932, 430]]) {
    await page.setViewportSize({ width, height });
    await page.locator('[data-target="row1"]').tap();
    await fits(`${width} × ${height}`);
    await page.screenshot({ path: `test-results/phone-fit-${width}x${height}.png` });
    await page.locator('[data-target="row1"]').click({ button: "right" });
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('[data-target="n6"]').tap();
  await page.locator("#roll").tap();
  await settled(page, "330");
  await fits("small phone after Jackpot");
  await page.locator('[data-target="row1"]').tap();
  await page.locator("#roll").tap();
  await settled(page, "320");
  await fits("small phone after an ordinary roll");
  await page.locator("#shake").tap();
  await page.waitForFunction(() => document.querySelector("#notice").textContent.includes("A fresh die.") && !document.querySelector('[data-target="n1"]').disabled);
  await fits("small phone after Shake");
  await page.locator("#settings-open").tap();
  await page.locator("#show-probabilities").tap();
  await page.locator("#probabilities-confirm").tap();
  await page.waitForFunction(() => document.querySelectorAll(".probability, .group-odds").length === 13 && !document.querySelector("#show-probabilities").disabled);
  await page.locator('[data-close="settings-dialog"]').tap();
  await fits("small phone with probabilities");
  await page.screenshot({ path: "test-results/phone-fit-probabilities.png" });
});

test("mouse and touch holds remove only the chosen wager and consume the release click", async t => {
  for (const input of ["mouse", "touch"]) {
    const page = await game(t, input === "mouse" ? 1280 : 390, {
      hasTouch: input === "touch", isMobile: input === "touch",
      viewport: { width: input === "mouse" ? 1280 : 390, height: input === "mouse" ? 900 : 667 },
    });
    const session = input === "touch" ? await page.context().newCDPSession(page) : undefined;
    const activate = locator => input === "touch" ? locator.tap() : locator.click();
    const start = async locator => {
      const bounds = await locator.boundingBox();
      const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      if (session) await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
      else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
    };
    const release = async () => {
      if (session) await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await page.mouse.up();
    };
    await activate(page.locator('[data-target="n6"]'));
    for (const id of ["n1", "row0", "col1", "black"]) {
      const target = page.locator(`[data-target="${id}"]`);
      for (const onChip of [false, true]) {
        await activate(target);
        await activate(target);
        assert.equal(await page.locator("#draft-total").textContent(), "30 G");
        await start(onChip ? target.locator(".table-chip:last-child") : target);
        await page.waitForFunction(() => document.querySelector("#draft-total").textContent === "10 G");
        await release();
        assert.equal(await page.locator("#draft-total").textContent(), "10 G", `${input}: release restored ${id}`);
        assert.equal(await target.getAttribute("aria-pressed"), "false");
      }
    }
    // Holding an empty target must not place a new wager on release either.
    const empty = page.locator('[data-target="n1"]');
    await start(empty);
    await page.waitForTimeout(650);
    await release();
    assert.equal(await page.locator("#draft-total").textContent(), "10 G");
    await activate(empty);
    assert.equal(await page.locator("#draft-total").textContent(), "20 G");
    assert.equal(await page.locator("#gold").innerText(), "100");
    assert.equal((await saved(page)).revision, "0");
    await session?.detach();
  }
});

test("short presses add bets while dragging, cancelled touches, and lost focus abort a hold", async t => {
  const page = await game(t, 390, { hasTouch: true });
  const target = page.locator('[data-target="n1"]');
  await target.click();
  await target.click({ delay: 100 });
  assert.equal(await page.locator("#draft-total").textContent(), "20 G");
  const bounds = await target.boundingBox();
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 20, point.y);
  await page.waitForTimeout(650);
  await page.mouse.up();
  assert.equal(await page.locator("#draft-total").textContent(), "20 G");
  const session = await page.context().newCDPSession(page);
  for (const finish of ["touchMove", "touchCancel"]) {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: finish, touchPoints: finish === "touchCancel" ? [] : [{ x: point.x + 20, y: point.y, id: 1 }] });
    await page.waitForTimeout(650);
    if (finish === "touchMove") await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.equal(await page.locator("#draft-total").textContent(), "20 G");
  }
  await session.detach();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(650);
  await page.mouse.up();
  assert.equal(await page.locator("#draft-total").textContent(), "20 G");
  await target.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#draft-total").textContent(), "30 G");
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
  await page.locator("#settings-open").click();
  await page.locator("#motion").uncheck();
  await page.keyboard.press("Escape");
  await page.locator("#bet-amount").fill("100");
  await page.locator('[data-target="n1"]').click();
  await page.keyboard.press("r");
  await page.waitForFunction(() => document.querySelector("#gold").textContent === "0" && document.querySelector("#run-dialog").open);
  assert.equal(await page.locator("#rolls-remaining").innerText(), "99");
  assert.match(await page.locator("#run-comparison").innerText(), /No score was posted/);
  await page.locator("#run-confirm").click();
  await page.waitForFunction(() => document.querySelector("#game").classList.contains("is-restarting") && document.querySelector(".departing-die"));
  assert.equal(await page.locator("#run-confirm").isDisabled(), true);
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
    assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  }
  await page.locator("#settings-restart").click();
  await page.locator("#restart-confirm").click();
  await page.waitForFunction(() => document.querySelector("#game").classList.contains("is-restarting"));
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.equal(await page.locator("#settings-restart").isDisabled(), true);
  assert.equal(await page.locator('[data-target="n1"]').isDisabled(), true);
  await settled(page, "100");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
  assert.equal(await page.locator("#draft-total").textContent(), "0 G");
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

test("recent chip shortcuts remember only placed amounts and select without placing", async t => {
  const page = await game(t);
  const chips = page.locator("#recent-amounts button");
  assert.equal(await chips.count(), 3);
  assert.equal(await page.locator("#recent-amounts button:disabled").count(), 3);
  assert.equal(await page.locator("#amount-hint, .pointer-hint, .touch-hint").count(), 0);
  const place = async amount => {
    await page.locator("#bet-amount").fill(amount);
    await page.locator('[data-target="n1"]').click();
    await page.locator('[data-target="n1"]').click({ button: "right" });
  };
  for (const amount of ["5", "10", "25", "10", "40"]) await place(amount);
  const history = () => page.locator("#recent-amounts [data-amount]").evaluateAll(elements => elements.map(el => el.dataset.amount));
  assert.deepEqual(await history(), ["40", "10", "25"]);
  await place("101"); // Rejected amounts never enter history.
  await place("invalid");
  assert.deepEqual(await history(), ["40", "10", "25"]);
  await page.locator('[data-amount="25"]').click();
  assert.equal(await page.locator("#bet-amount").inputValue(), "25");
  assert.equal(await page.locator("#bet-amount").getAttribute("aria-invalid"), null);
  assert.equal(await page.locator("#draft-total").textContent(), "0 G");
  assert.deepEqual(await history(), ["40", "10", "25"]);
  await page.locator('[data-target="n1"]').click();
  assert.deepEqual(await history(), ["25", "40", "10"]);
  await page.reload();
  await page.waitForSelector('[data-amount="25"]');
  assert.deepEqual(await history(), ["25", "40", "10"]);
  for (const width of [1600, 1280, 1101, 1051, 1024, 801, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.locator(".amount-selector, #recent-amounts").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    assert.ok(bounds[1].x >= bounds[0].x + bounds[0].width, `Chips must sit next to the amount at ${width}px`);
    assert.ok(Math.abs(bounds[0].y + bounds[0].height / 2 - bounds[1].y - bounds[1].height / 2) < 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/recent-chips-${width}.png`, fullPage: true });
  }
  let release;
  const gate = new Promise(resolve => release = resolve);
  await page.route("**/api/action", async route => { await gate; await route.continue(); });
  await page.locator('[data-target="n6"]').click();
  await page.keyboard.press("r");
  assert.equal(await page.locator("#recent-amounts button:disabled").count(), 3);
  release();
  await settled(page, "330");
  await page.locator("#settings-open").click();
  await page.locator("#settings-restart").click();
  await page.locator("#restart-confirm").click();
  await settled(page, "100");
  assert.deepEqual(await history(), ["10", "25", "40"]);
});

test("Gold cards fit full exact values without changing card height, including animated counts", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    let height;
    for (const gold of ["100", "999999", "1000000", "9007199254740993", "100000000000000000000000000000001"]) {
      store.db.prepare("UPDATE players SET gold = ? WHERE id = ?").run(gold, id);
      await page.reload();
      await page.waitForFunction(value => document.querySelector("#gold").textContent === BigInt(value).toLocaleString("en-US"), gold);
      await page.locator("#bet-amount").fill(gold);
      await page.locator('[data-target="n1"]').click();
      assert.equal(await page.locator("#draft-gold").textContent(), BigInt(gold).toLocaleString("en-US"));
      const cards = await page.locator(".bankroll, .table-wager").evaluateAll(cards => cards.map(card => {
        const gold = card.querySelector(".stat-number").getBoundingClientRect();
        const unit = card.querySelector(".gold-unit").getBoundingClientRect();
        const row = card.querySelector(".stat-value").getBoundingClientRect();
        return { height: card.getBoundingClientRect().height, fits: gold.right <= unit.left && unit.right <= row.right + 1, valueHeight: gold.height, rowHeight: row.height };
      }));
      height ??= cards[0].height;
      for (const dimensions of cards) {
        assert.equal(dimensions.height, height, `${width}px / ${gold} moved the card`);
        assert.ok(dimensions.fits, `${width}px / ${gold} overflows the card`);
        assert.ok(dimensions.valueHeight <= dimensions.rowHeight + 1);
      }
      if (gold === "1000000") await page.screenshot({ path: `test-results/million-bankroll-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px / ${gold}: ` + await page.evaluate(() => [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth).map(el => el.id || el.className).join(", ")));
    }
    await page.screenshot({ path: `test-results/large-bankroll-${width}.png`, fullPage: true });
  }
  store.db.prepare("UPDATE players SET gold = ? WHERE id = ?").run("999999", id);
  await page.reload();
  await settled(page, "999,999");
  await page.locator("#settings-open").click();
  await page.locator("#motion").uncheck();
  await page.keyboard.press("Escape");
  const height = (await page.locator(".bankroll").boundingBox()).height;
  await page.evaluate(() => {
    window.cardHeights = [];
    window.goldObserver = new MutationObserver(() => window.cardHeights.push(document.querySelector(".bankroll").getBoundingClientRect().height));
    window.goldObserver.observe(document.querySelector("#gold"), { childList: true });
  });
  await page.locator('[data-target="n6"]').click();
  await page.keyboard.press("r");
  await settled(page, "1,000,229");
  const heights = await page.evaluate(() => { window.goldObserver.disconnect(); return window.cardHeights; });
  assert.ok(heights.length > 5);
  assert.ok(heights.every(value => value === height));
});

test("results compare higher, tied and lower records and recover a lost named-restart response", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  for (const [gold, best, previous, comparison] of [
    ["350", "350", "280", "New personal best! 70 G above your previous 280 G."],
    ["350", "350", "350", "You matched your personal best."],
    ["280", "350", "350", "70 G below your personal best."],
  ]) {
    store.db.prepare("UPDATE players SET gold = ?, best_gold = ?, previous_best_gold = ?, rolls_used = 100, has_completed_run = 1 WHERE id = ?")
      .run(gold, best, previous, id);
    await page.reload();
    await page.waitForSelector("#run-dialog[open]");
    assert.equal(await page.locator("#run-comparison").innerText(), comparison);
    assert.equal(await page.locator("#run-best").innerText(), `${best} G`);
  }
  await page.locator("#run-nickname").fill("a".repeat(25));
  await page.locator("#run-confirm").click();
  await page.waitForFunction(() => document.querySelector("#run-error").textContent.includes("1–24"));
  assert.equal((await saved(page)).rollsUsed, 100);
  await page.locator("#run-nickname").fill("Recovered player");
  const before = await saved(page);
  const requests = [];
  await page.route("**/api/action", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await route.fetch(); // Commit the action, but lose its response.
      await route.abort("failed");
    } else await route.continue();
  });
  await page.locator("#run-confirm").click();
  await page.waitForFunction(() => document.querySelector("#run-confirm").textContent === "Retry & play again");
  assert.equal(await page.locator("#run-dialog").isVisible(), true);
  assert.match(await page.locator("#run-error").innerText(), /saved/);
  assert.equal(await page.locator("#run-nickname").isDisabled(), true);
  await page.locator("#run-confirm").click();
  await settled(page, "100");
  assert.deepEqual(requests[0], requests[1]);
  const after = await saved(page);
  assert.equal(after.revision, String(BigInt(before.revision) + 1n));
  assert.equal(after.nickname, "Recovered player");
  assert.equal(after.bestGold, "350");
  assert.equal(after.rollsUsed, 0);
  assert.equal(await page.locator("#run-dialog").isVisible(), false);
});

test("amount shortcuts recall recent bets, adjust exact values and clear only the draft", async t => {
  const page = await game(t);
  const target = page.locator('[data-target="n1"]');
  await target.focus();
  for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
  assert.equal(await page.locator("#bet-amount").inputValue(), "10");
  for (const amount of ["5", "15", "25"]) {
    await page.locator("#bet-amount").fill(amount);
    await target.click();
    await page.keyboard.press("q");
  }
  const before = await saved(page);
  for (const [key, value] of [["1", "25"], ["2", "15"], ["3", "5"]]) {
    await page.keyboard.press(key);
    assert.equal(await page.locator("#bet-amount").inputValue(), value);
    assert.equal(await page.locator("#draft-total").textContent(), "0 G");
  }
  await page.keyboard.press("w");
  await page.keyboard.press("w");
  assert.equal(await page.locator("#bet-amount").inputValue(), "1");
  await page.keyboard.press("e");
  assert.equal(await page.locator("#bet-amount").inputValue(), "6");
  for (const key of ["q", "Escape", "Shift+Q"]) {
    await target.click();
    await page.locator('[data-target="red"]').click();
    assert.equal(await page.locator("#draft-total").textContent(), "12 G");
    await page.keyboard.press(key);
    assert.equal(await page.locator("#draft-total").textContent(), "0 G");
    assert.equal(await page.locator(".chip-pile").count(), 0);
  }
  await page.locator("#bet-amount").fill("9007199254740993");
  await target.focus();
  await page.keyboard.press("Shift+E");
  assert.equal(await page.locator("#bet-amount").inputValue(), "9007199254740998");
  await page.keyboard.press("Shift+W");
  assert.equal(await page.locator("#bet-amount").inputValue(), "9007199254740993");
  assert.deepEqual(await saved(page), before);
});

test("new shortcuts honor typing, dialog, modifier, repeat and composition guards", async t => {
  const page = await game(t);
  await page.locator('[data-target="n1"]').click();
  const before = await saved(page);
  const keys = ["r", " ", "1", "2", "3", "w", "e", "q", "Escape"];
  for (const flag of ["ctrlKey", "metaKey", "altKey", "repeat", "isComposing"]) {
    for (const key of keys)
      await page.locator('[data-target="n1"]').dispatchEvent("keydown", { key, [flag]: true, bubbles: true });
  }
  await page.locator("#bet-amount").focus();
  for (const key of keys)
    await page.locator("#bet-amount").dispatchEvent("keydown", { key, bubbles: true });
  assert.equal(await page.locator("#bet-amount").inputValue(), "10");
  await page.locator("#settings-open").click();
  for (const key of keys)
    await page.locator("#settings-title").dispatchEvent("keydown", { key, bubbles: true });
  // Escape closes the dialog through its normal behavior, preserving the board.
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  assert.deepEqual(await saved(page), before);
  await page.locator('[data-target="n1"]').focus();
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
});

test("all seven guide languages fit desktop and mobile and remember the selection", async t => {
  const page = await game(t);
  const titles = { en: "How to play", ko: "게임 방법", ja: "遊び方", zh: "玩法说明", es: "Cómo jugar", fr: "Comment jouer", de: "Spielanleitung" };
  await page.locator("#guide-open").click();
  assert.equal(await page.locator("#guide-language option").count(), 7);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [code, title] of Object.entries(titles)) {
      await page.locator("#guide-language").selectOption(code);
      assert.equal(await page.locator("#welcome-title").innerText(), title);
      assert.equal(await page.locator("#welcome-dialog").getAttribute("lang"), code);
      assert.equal(await page.locator(".guide-shortcuts > div").count(), 6);
      assert.equal(await page.locator(".guide-details").evaluate(el => el.open), false);
      assert.equal(await page.evaluate(() => {
        const dialog = document.querySelector("#welcome-dialog");
        return dialog.scrollWidth > dialog.clientWidth || document.documentElement.scrollWidth > innerWidth;
      }), false, `${code} overflows at ${width}px`);
      await page.screenshot({ path: `test-results/guide-${code}-${width}.png` });
      await page.locator(".guide-details summary").click();
      assert.equal(await page.locator(".guide-details h3").count(), 5);
      assert.equal(await page.locator("#welcome-dialog").evaluate(el => el.scrollWidth > el.clientWidth), false);
    }
  }
  await page.locator("#guide-language").selectOption("ko");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.locator("#tilt-info").click();
  assert.equal(await page.locator("#guide-language").inputValue(), "ko");
  assert.equal(await page.locator("#welcome-title").innerText(), titles.ko);
  assert.equal(await page.evaluate(() => document.activeElement.className), "tilt-guide");
  await page.locator('[data-close="welcome-dialog"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), "tilt-info");
  // A new browser starts in its own language before a saved selection exists.
  const context = await browser.newContext({ locale: "ja-JP" });
  t.after(() => context.close());
  const localized = await context.newPage();
  await localized.goto(origin);
  await localized.waitForSelector("#welcome-dialog[open]");
  assert.equal(await localized.locator("#guide-language").inputValue(), "ja");
  assert.equal(await localized.locator("#welcome-title").innerText(), titles.ja);
});

test("compact leaderboard shows top 10 and distant personal context on desktop and mobile", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  const opponents = Array.from({ length: 65 }, (_, index) => {
    const other = store.create().state.id;
    store.db.prepare("UPDATE players SET best_gold = ?, has_completed_run = 1, nickname = ? WHERE id = ?")
      .run((10n ** 30n - BigInt(index)).toString(), `Leaderboard player ${index + 1}`, other);
    return other;
  });
  t.after(() => { for (const id of opponents) store.db.prepare("DELETE FROM players WHERE id = ?").run(id); });
  store.db.prepare("UPDATE players SET best_gold = '5000', has_completed_run = 1 WHERE id = ?").run(id);
  await page.reload();
  await page.waitForSelector("#leaders .you");
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1101) await page.locator("#leaderboard-open").click();
    const ranks = await page.locator("#leaders li[value]").evaluateAll(rows => rows.map(row => row.value));
    assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 64, 65, 66]);
    assert.equal(await page.locator("#leaders .you").count(), 1);
    assert.equal(await page.locator("#leaders .you > strong").getAttribute("aria-label"), "5,000 Gold");
    assert.equal(await page.locator("#leaders .leader-gap").count(), 1);
    assert.equal(await page.locator("#leaderboard-unranked").isVisible(), false);
    const heights = await page.locator("#leaders li[value]").evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
    assert.ok(heights.every(height => height <= 48), `Rows too tall: ${heights}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator(".tower-floors").evaluate(el => el.scrollWidth > el.clientWidth), false);
    await page.screenshot({ path: `test-results/leaderboard-context-${width}.png`, fullPage: true });
    if (width < 1101) await page.keyboard.press("Escape");
  }
  store.db.prepare("UPDATE players SET best_gold = ? WHERE id = ?").run((10n ** 31n).toString(), id);
  await page.reload();
  await page.locator("#leaderboard-open").click();
  await page.waitForFunction(() => document.querySelector("#leaders .you")?.value === 1);
  assert.equal(await page.locator("#leaders li[value]").count(), 10);
  assert.equal(await page.locator("#leaders .leader-gap").count(), 0);
});

test("ordinary rolls use their action response without per-roll state or leaderboard refetches", async t => {
  const page = await game(t);
  await page.locator("#leaders li").first().waitFor();
  const counts = { state: 0, leaderboard: 0, action: 0 };
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) counts[path.slice(5)]++;
  });
  await page.locator("#bet-amount").fill("1");
  for (let i = 0; i < 10; i++) {
    await page.locator('[data-target="red"]').click();
    await page.locator('[data-target="black"]').click();
    await page.locator("#roll").click();
    await page.waitForFunction(remaining => document.querySelector("#rolls-remaining").textContent === String(remaining) && !document.querySelector('[data-target="n1"]').disabled, 99 - i);
  }
  assert.equal(counts.action, 10);
  assert.equal(counts.leaderboard, 0);
  assert.ok(counts.state <= 2, JSON.stringify(counts));
  assert.equal(await page.locator("#gold").innerText(), "100");
});

test("focus bursts share one state request; simulated hidden tabs finish committed motion and pause reads", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  let active = 0, peak = 0, reads = 0;
  await page.route("**/api/state", async route => {
    active++; reads++; peak = Math.max(peak, active);
    await page.waitForTimeout(200);
    const response = await route.fetch();
    active--;
    await route.fulfill({ response });
  });
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.dispatchEvent(new Event("focus")); });
  await page.waitForTimeout(400);
  assert.equal(peak, 1); assert.equal(reads, 1);
  await page.unroute("**/api/state");
  await page.locator("#settings-open").click();
  await page.locator("#motion").uncheck();
  await page.keyboard.press("Escape");
  await page.locator('[data-target="n6"]').click();
  const response = page.waitForResponse("**/api/action");
  await page.locator("#roll").click();
  await response;
  await page.waitForFunction(() => document.querySelector("#die").getAttribute("aria-label") === "Die rolling");
  let hiddenReads = 0;
  page.on("request", request => { if (/\/api\/(state|leaderboard)$/.test(request.url())) hiddenReads++; });
  // Browser DOM event emulation, not a physical-device claim.
  await page.evaluate(() => {
    window.testHidden = true;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => window.testHidden });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.testHidden ? "hidden" : "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await settled(page, "330");
  assert.equal(store.get(id).revision, "1");
  assert.equal(await page.locator("#effects").evaluate(el => el.childElementCount), 0);
  await page.waitForTimeout(5500);
  assert.equal(hiddenReads, 0);
  await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(400);
  assert.equal(hiddenReads, 1);
  assert.equal(store.get(id).revision, "1");
  assert.equal(await page.locator("#gold").innerText(), "330");
});

test("a 429 after an uncertain commit keeps the stable action and retry delay across reload", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  const requests = [];
  await page.route("**/api/action", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await route.fetch(); // Simulate a proxy failure after the server committed.
      await route.fulfill({ status: 429, contentType: "application/json", headers: { "Retry-After": "1" }, body: JSON.stringify({ error: "Retry shortly.", retryAfter: 1 }) });
    } else await route.continue();
  });
  await page.locator('[data-target="n6"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(() => !document.querySelector("#retry").hidden);
  assert.equal(await page.locator("#retry").isDisabled(), true);
  const pending = await page.evaluate(() => JSON.parse(sessionStorage.getItem("sixfold-100-rolls-pending")));
  assert.equal(pending.playerId, id); assert.deepEqual(pending.request, requests[0]);
  assert.equal(store.get(id).revision, "1");
  await page.reload();
  await page.waitForFunction(() => !document.querySelector("#retry").hidden);
  assert.equal(requests.length, 1);
  await page.locator("#retry").click();
  await settled(page, "330");
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(store.get(id).revision, "1");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("sixfold-100-rolls-pending")), null);
});

test("a cookie replacement cannot replay a pending roll into the new player, and invalid saved requests recover", async t => {
  const page = await game(t);
  const original = (await saved(page)).id;
  let requests = 0;
  await page.route("**/api/action", async route => { requests++; await route.abort("failed"); });
  await page.locator('[data-target="n6"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(() => !document.querySelector("#retry").hidden);
  assert.equal(requests, 1);
  await page.context().clearCookies();
  await page.reload();
  await page.locator("#welcome-start").click();
  const replacement = await saved(page);
  assert.notEqual(replacement.id, original);
  assert.equal(replacement.revision, "0"); assert.equal(replacement.gold, "100");
  assert.equal(store.get(original).revision, "0"); assert.equal(requests, 1);
  assert.match(await page.locator("#notice").innerText(), /session changed/);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("sixfold-100-rolls-pending")), null);
  await page.evaluate(() => sessionStorage.setItem("sixfold-100-rolls-pending", "{}"));
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-target="n1"]').disabled);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("sixfold-100-rolls-pending")), null);
});

test("blocked browser storage permits play with in-tab retry recovery", async t => {
  const page = await game(t);
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"])
      Object.defineProperty(window, name, { configurable: true, get: () => { throw new DOMException("Storage disabled", "SecurityError"); } });
  });
  await page.reload();
  await page.locator("#welcome-start").click();
  await page.locator("#settings-open").click();
  await page.locator("#motion").check();
  await page.keyboard.press("Escape");
  const requests = [];
  await page.route("**/api/action", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await page.locator('[data-target="n6"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(() => !document.querySelector("#retry").hidden);
  assert.match(await page.locator("#notice").innerText(), /saved in this tab/);
  await page.locator("#retry").click();
  await settled(page, "330");
  assert.deepEqual(requests[0], requests[1]);
});

test("initial reads stop after bounded backoff and Reconnect recovers a saved action exactly once", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  const requests = [];
  await page.route("**/api/action", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await page.locator('[data-target="n6"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(() => !document.querySelector("#retry").hidden);
  assert.equal(store.get(id).revision, "1");
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T00:00:01Z"));
  let reads = 0, disconnected = true;
  await page.route("**/api/state", async route => {
    reads++;
    if (disconnected) await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Offline fixture"}' });
    else await route.continue();
  });
  const waitFor = async condition => {
    for (let i = 0; i < 100; i++) {
      if (await condition()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail("Condition did not settle");
  };
  await page.reload();
  await waitFor(() => page.locator("#notice").innerText().then(text => text.includes("Could not connect")));
  assert.equal(reads, 1);
  assert.equal(await page.locator("#reconnect").isVisible(), true);
  for (const delay of [10000, 20000, 40000, 80000, 80000]) {
    const previous = reads;
    await page.clock.runFor(delay + 1);
    await waitFor(() => reads === previous + 1);
    // Allow response microtasks to schedule the next virtual timer.
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(reads, 6);
  assert.match(await page.locator("#notice").innerText(), /Reconnect/);
  await page.clock.runFor(240000);
  assert.equal(reads, 6);
  assert.equal(requests.length, 1);
  disconnected = false;
  await page.locator("#reconnect").click({ force: true });
  await waitFor(async () => await page.locator("#gold").innerText() === "330" && await page.evaluate(() => sessionStorage.getItem("sixfold-100-rolls-pending")) === null);
  assert.equal(await page.locator("#reconnect").isVisible(), false);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(store.get(id).revision, "1");
});

test("leaderboard names render as text and touch-capable mobile controls keep the layout within the viewport", async t => {
  const page = await game(t, 390, { isMobile: true, hasTouch: true });
  const id = (await saved(page)).id;
  const nickname = "<svg/onload=alert(1)>";
  store.act(id, { requestId: crypto.randomUUID(), revision: "0", action: { kind: "nickname", nickname } });
  store.db.prepare("UPDATE players SET best_gold='100',has_completed_run=1 WHERE id=?").run(id);
  await page.reload();
  await page.locator("#leaderboard-open").tap();
  await page.waitForSelector("#leaders .you");
  assert.equal(await page.locator("#leaders .you .leader-name").evaluate(el => el.childNodes[0].textContent), nickname);
  assert.equal(await page.locator("#leaders svg, #leaders script").count(), 0);
  await page.locator('[data-close="leaderboard-dialog"]').tap();
  await page.locator('[data-target="row1"]').tap();
  await page.locator("#roll").tap();
  await settled(page, "110");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: "test-results/public-mobile-touch.png", fullPage: true });
});
