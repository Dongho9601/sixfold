import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";
import { newRun } from "../src/game/run.ts";
import { SAVE_KEY } from "../src/save.ts";
import { TILT_LABELS } from "../src/config.ts";
import { probabilityEntropy } from "../src/game/rules.ts";
import { distributionHint } from "../src/distribution-hint.ts";
import { guideLanguages, guides } from "../src/guide.ts";

let browser, vite, origin;
before(async () => {
  vite = await preview({ preview: { port: 0, host: "127.0.0.1" } });
  origin = `http://127.0.0.1:${vite.httpServer.address().port}/sixfold/`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  });
});
after(async () => {
  await browser?.close();
  if (vite) await new Promise(resolve => vite.httpServer.close(resolve));
});

function fixture() {
  const state = newRun("a".repeat(32), "Player", () => .1);
  state.probabilities = [.4, .2, .15, .1, .1, .05];
  return { version: 1, revision: "0", state,
    settings: { sound: false, reducedMotion: true, guideLanguage: null, guideSeen: false, recentAmounts: [] }, records: [] };
}
async function game(t, width = 1280, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, ...options });
  const page = await context.newPage();
  const errors = [], api = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.includes("/api/")) api.push(request.url()); });
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); assert.deepEqual(api, []); });
  await page.addInitScript(({ key, save }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(save));
    let draws = 0;
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = array => {
      if (array.length !== 6) return original(array);
      let value = Math.floor((draws++ === 0 ? .99 : .1) * 2 ** 48);
      for (let i = 5; i >= 0; i--) { array[i] = value % 256; value = Math.floor(value / 256); }
      return array;
    };
  }, { key: SAVE_KEY, save: fixture() });
  await page.goto(origin);
  await page.locator("#welcome-start").click();
  await page.waitForFunction(() => !document.querySelector("#welcome-dialog").open && document.activeElement.id === "bet-amount");
  // Guide close saves asynchronously; later fixtures must start after that write.
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.guideSeen === true, SAVE_KEY);
  return page;
}
const save = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const saved = async page => (await save(page)).state;
async function patchSave(page, state = {}, rest = {}) {
  await page.evaluate(({ key, state, rest }) => {
    const save = JSON.parse(localStorage.getItem(key));
    Object.assign(save.state, state);
    Object.assign(save, rest);
    save.revision = (BigInt(save.revision) + 1n).toString();
    localStorage.setItem(key, JSON.stringify(save));
  }, { key: SAVE_KEY, state, rest });
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#gold").textContent !== "—");
}
async function settled(page, gold) {
  await page.waitForFunction(value => document.querySelector("#gold").textContent === value &&
    !document.querySelector('[data-target="n1"]').disabled, gold);
}
async function land(page, outcome) {
  const { probabilities } = await saved(page);
  await page.evaluate(({ probabilities, outcome }) => {
    const sample = probabilities.slice(0, outcome - 1).reduce((a, b) => a + b, 0) + probabilities[outcome - 1] / 2;
    let first = true;
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = array => {
      if (array.length !== 6) return original(array);
      let value = Math.floor((first ? sample : .1) * 2 ** 48);
      first = false;
      for (let i = 5; i >= 0; i--) { array[i] = value % 256; value = Math.floor(value / 256); }
      return array;
    };
  }, { probabilities, outcome });
}
const hintOpacities = page => page.locator(".distribution-square")
  .evaluateAll(squares => squares.map(square => Number(getComputedStyle(square).opacity)));

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
    const seam = await page.evaluate(() => {
      const column = document.querySelector('[data-target="col2"]').getBoundingClientRect();
      const key = document.querySelector(".board-key").getBoundingClientRect();
      const number = document.querySelector('[data-target="n5"]');
      const odds = document.querySelector('[data-target="row0"]');
      return { columnBottom: column.bottom, keyBottom: key.bottom,
        numberTop: number.getBoundingClientRect().top, oddsTop: odds.getBoundingClientRect().top,
        numberBorder: getComputedStyle(number).borderTopWidth, oddsBorder: getComputedStyle(odds).borderTopWidth,
        keyBorder: getComputedStyle(document.querySelector(".board-key")).borderBottomWidth };
    });
    assert.equal(seam.numberTop, seam.oddsTop);
    assert.equal(seam.columnBottom, seam.keyBottom);
    assert.equal(seam.columnBottom, seam.numberTop);
    assert.equal(seam.numberBorder, seam.oddsBorder);
    assert.equal(seam.keyBorder, "1px");
    await page.screenshot({ path: `test-results/board-labels-${width}.png`, fullPage: true });
  }
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
  assert.equal(await page.locator("#tilt-number").innerText(), "Tilt 1");
  assert.equal(await page.locator("#tilt-level").innerText(), "NEARLY EVEN");
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
  assert.equal(await page.locator("#board-net").innerText(), "0 G");
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
  assert.equal(await page.locator("#board-net").innerText(), "+10 G");
  await page.reload();
  assert.equal(await page.locator("#board-net").innerText(), "+10 G");
  await page.locator('[data-target="n2"]').click();
  await page.locator("#roll").click();
  await settled(page, "100");
  assert.equal(await page.locator("#board-net").innerText(), "0 G");
  await page.locator('[data-target="n2"]').click();
  await page.locator("#roll").click();
  await settled(page, "90");
  assert.equal(await page.locator("#board-net").innerText(), "−10 G");
  await page.locator("#shake").click();
  await settled(page, "90");
  assert.equal(await page.locator("#board-net").innerText(), "0 G");
  await page.reload();
  assert.equal(await page.locator("#board-net").innerText(), "0 G");
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

test("Settings stays compact and the complete guide works on desktop and mobile", async t => {
  const page = await game(t);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#settings-open").click();
    const website = page.locator('#settings-dialog a[href="https://dongho9601.github.io/"]');
    assert.equal(await website.innerText(), "dongho9601.github.io");
    assert.equal(await website.getAttribute("target"), "_blank");
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
    for (const text of ["100 rolls", "least likely number", "×24", "Keyboard controls", "Tilt 1", "Tilt 6", "▲", "▼", "BOARD NET", "Space", "W / E", "Q / Esc"])
      assert.ok(guide.includes(text), `Guide missing ${text}`);
    assert.ok(!guide.includes("1 in 24"));
    assert.ok(!guide.includes("Full rules in Settings"));
    if (!await page.locator(".guide-details").evaluate(element => element.open))
      await page.locator(".guide-details summary").click();
    const details = await page.locator(".guide-details").innerText();
    for (const text of ["Press and hold", "right-click", "Earlier peaks do not count", "Sound effects", "Reduce motion", "Show probabilities", "Swap Roll and Shake on mobile", "keypad", "10%, 20%, and 30%", "4%–8%", "9%–18%", "5%–10%", "7.5%", "37.15%", ...TILT_LABELS])
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
  assert.equal(await page.locator("#leaderboard-dialog h2").innerText(), "Personal records");
  assert.equal(await page.locator("#leaderboard-dialog .personal-records-note").count(), 1);
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
  const boardGeometry = () => page.evaluate(() =>
    [...document.querySelectorAll("#board, [data-target]")].map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { target: element.id || element.dataset.target, x, y, width, height };
    }));
  const staysStill = async (expected, label) => {
    assert.deepEqual(await boardGeometry(), expected, `${label}: betting cells moved or resized`);
  };
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
    if (layout.width < layout.height)
      assert.ok(await page.locator("main").evaluate(element => element.getBoundingClientRect().bottom >= innerHeight - 36), `${label}: phone layout leaves unused height`);
    if (layout.width < layout.height) {
      assert.ok(await page.evaluate(() => {
        const footer = document.querySelector(".site-information").getBoundingClientRect();
        return [...document.querySelectorAll(".messages .notice:not(:empty):not([hidden])")]
          .filter(element => getComputedStyle(element).display !== "none")
          .every(element => element.getBoundingClientRect().bottom <= footer.top - 2);
      }), `${label}: feedback overlaps the footer`);
    }
    for (const bounds of layout.controls) {
      assert.ok(bounds.left >= 0 && bounds.right <= layout.width + 1 && bounds.top >= 0 && bounds.bottom <= layout.height + 1,
        `${label}: ${bounds.name} is outside the viewport`);
    }
  };
  for (const [width, height] of [[320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [568, 320], [667, 375], [844, 390], [932, 430]]) {
    await page.setViewportSize({ width, height });
    const initial = await boardGeometry();
    await fits(`${width} × ${height} before betting`);
    await page.locator('[data-target="row1"]').tap();
    await staysStill(initial, `${width} × ${height} after betting`);
    await fits(`${width} × ${height}`);
    await page.screenshot({ path: `test-results/phone-fit-${width}x${height}.png` });
    await page.locator('[data-target="row1"]').click({ button: "right" });
    await staysStill(initial, `${width} × ${height} after removing a bet`);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  const initial = await boardGeometry();
  await page.locator('[data-target="n6"]').tap();
  await page.locator("#roll").tap();
  await settled(page, "330");
  await staysStill(initial, "small phone after Jackpot");
  await fits("small phone after Jackpot");
  await page.locator('[data-target="row1"]').tap();
  await staysStill(initial, "small phone betting after Jackpot");
  await page.locator("#roll").tap();
  await settled(page, "320");
  await staysStill(initial, "small phone after an ordinary roll");
  await fits("small phone after an ordinary roll");
  await page.locator("#shake").tap();
  await page.waitForFunction(() => document.querySelector("#notice").textContent.includes("A fresh die.") && !document.querySelector('[data-target="n1"]').disabled);
  await staysStill(initial, "small phone after Shake");
  await fits("small phone after Shake");
  await page.locator('[data-target="n1"]').tap();
  await staysStill(initial, "small phone betting after Shake");
  await fits("small phone betting after Shake");
  await page.locator("#settings-open").tap();
  await page.locator("#show-probabilities").tap();
  await page.locator("#probabilities-confirm").tap();
  await page.waitForFunction(() => document.querySelectorAll(".probability, .group-odds").length === 13 && !document.querySelector("#show-probabilities").disabled);
  await page.locator('[data-close="settings-dialog"]').tap();
  await fits("small phone with probabilities");
  await page.screenshot({ path: "test-results/phone-fit-probabilities.png" });
});

test("the phone bet keypad overlays a stationary game and commits or cancels exact amounts", async t => {
  const page = await game(t, 390, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const geometry = () => page.evaluate(() => ({
    scrollX, scrollY, width: innerWidth, height: innerHeight,
    cells: [...document.querySelectorAll("#board, [data-target], .amount-selector, .actions")].map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }),
  }));
  for (const [width, height] of [[390, 844], [320, 568], [568, 320], [932, 430]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.locator("#bet-amount").evaluate(input => input.readOnly && input.inputMode === "none"));
    const before = await geometry();
    await page.locator("#bet-amount").tap();
    assert.equal(await page.locator("#bet-keypad").isVisible(), true);
    assert.deepEqual(await geometry(), before, `${width} × ${height}: opening keypad moved the game`);
    await page.locator('[data-key="clear"]').tap();
    await page.locator('[data-key="0"]').tap();
    assert.equal(await page.locator("#keypad-done").isDisabled(), true);
    assert.equal(await page.locator("#keypad-validation").innerText(), "Enter at least 1 G.");
    await page.locator('[data-key="clear"]').tap();
    await page.locator('[data-key="2"]').tap();
    await page.locator('[data-key="5"]').tap();
    assert.equal(await page.locator("#keypad-amount").innerText(), "25");
    assert.deepEqual(await geometry(), before, `${width} × ${height}: typing moved the game`);
    assert.ok(await page.locator("#bet-keypad").evaluate(dialog => {
      const bounds = dialog.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= innerHeight + 1 && dialog.scrollWidth <= dialog.clientWidth && dialog.scrollHeight <= dialog.clientHeight + 1 &&
        [...dialog.querySelectorAll("button")].every(button => {
          const key = button.getBoundingClientRect();
          return key.height >= 44 && key.top >= bounds.top && key.bottom <= bounds.bottom;
        });
    }));
    await page.screenshot({ path: `test-results/bet-keypad-${width}x${height}.png` });
    await page.locator("#keypad-done").tap();
    assert.equal(await page.locator("#bet-amount").inputValue(), "25");
    assert.equal(await page.locator("#bet-keypad").isVisible(), false);
    assert.deepEqual(await geometry(), before, `${width} × ${height}: closing keypad moved the game`);
  }
  await page.locator("#bet-amount").tap();
  await page.locator('[data-key="3"]').tap();
  await page.locator('[data-key="0"]').tap();
  await page.locator('[data-key="backspace"]').tap();
  assert.equal(await page.locator("#keypad-amount").innerText(), "3");
  await page.locator("#keypad-cancel").tap();
  assert.equal(await page.locator("#bet-amount").inputValue(), "25");
  await page.locator("#bet-amount").tap();
  await page.keyboard.type("40");
  await page.locator("#keypad-cancel").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#bet-keypad").isVisible(), false);
  assert.equal(await page.locator("#bet-amount").inputValue(), "25");
  await page.locator("#bet-amount").tap();
  await page.keyboard.type("9007199254740993");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#bet-amount").inputValue(), "9007199254740993");
  assert.equal(await page.locator("#bet-amount").getAttribute("aria-valuenow"), "9007199254740993");
  assert.equal((await saved(page)).gold, "100");
  assert.equal((await saved(page)).rollsUsed, 0);
});

test("keypad percentages use the current bankroll with exact whole-Gold arithmetic", async t => {
  const page = await game(t, 390, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.locator('[data-target="n1"]').tap();
  await page.locator("#bet-amount").tap();
  for (const percent of [10, 20, 30]) {
    await page.getByRole("button", { name: `${percent}% of current bankroll`, exact: true }).tap();
    assert.equal(await page.locator("#keypad-amount").innerText(), String(percent));
    assert.equal(await page.locator("#keypad-done").isDisabled(), false);
  }
  await page.locator("#keypad-cancel").tap();
  assert.equal(await page.locator("#bet-amount").inputValue(), "10");
  await page.locator("#roll").tap();
  await settled(page, "90");
  await page.locator("#bet-amount").tap();
  for (const [percent, expected] of [[10, "9"], [20, "18"], [30, "27"]]) {
    await page.locator(`[data-bankroll-percent="${percent}"]`).tap();
    assert.equal(await page.locator("#keypad-amount").innerText(), expected);
  }
  await page.locator("#keypad-done").tap();
  assert.equal(await page.locator("#bet-amount").inputValue(), "27");
  assert.equal(await page.locator("#bet-amount").getAttribute("aria-valuenow"), "27");
  await page.locator('[data-target="n1"]').tap();
  assert.equal(await page.locator("#draft-total").textContent(), "27 G");
  for (const gold of ["101", "1", "9007199254740993123456789"]) {
    await patchSave(page, { gold });
    await page.locator("#bet-amount").tap();
    for (const percent of [10, 20, 30]) {
      await page.locator(`[data-bankroll-percent="${percent}"]`).tap();
      const amount = BigInt(gold) * BigInt(percent) / 100n;
      assert.equal(await page.locator("#keypad-amount").innerText(), String(amount < 1n ? 1n : amount));
      assert.equal(await page.locator("#keypad-done").isDisabled(), false);
    }
    await page.locator("#keypad-done").tap();
    const amount = BigInt(gold) * 30n / 100n;
    assert.equal(await page.locator("#bet-amount").inputValue(), String(amount < 1n ? 1n : amount));
    assert.equal((await saved(page)).gold, gold);
  }
});

test("desktop bet input stays editable at phone-sized window widths", async t => {
  const page = await game(t);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator("#bet-amount").evaluate(input => input.readOnly), false);
    await page.locator("#bet-amount").fill("35");
    assert.equal(await page.locator("#bet-keypad").isVisible(), false);
  }
});

test("the saved mobile action setting swaps positions and widths while keeping desktop order", async t => {
  const page = await game(t, 390, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const order = () => page.locator(".actions > button").evaluateAll(buttons => buttons.map(button => button.id));
  assert.deepEqual(await order(), ["roll", "shake"]);
  await page.locator("#settings-open").tap();
  await page.locator("#swap-mobile-actions").check();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.swapMobileActions === true, SAVE_KEY);
  await page.screenshot({ path: "test-results/mobile-action-settings.png" });
  await page.locator('[data-close="settings-dialog"]').tap();
  assert.deepEqual(await order(), ["shake", "roll"]);
  assert.ok((await page.locator("#roll").boundingBox()).width > (await page.locator("#shake").boundingBox()).width);
  await page.screenshot({ path: "test-results/mobile-actions-swapped.png" });
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#gold").textContent !== "—");
  assert.deepEqual(await order(), ["shake", "roll"]);
  for (const [width, height, expected] of [[568, 320, ["shake", "roll"]], [1280, 900, ["roll", "shake"]], [320, 568, ["shake", "roll"]]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(expected => [...document.querySelectorAll(".actions > button")].map(button => button.id).join() === expected.join(), expected);
    assert.deepEqual(await order(), expected);
  }
  await page.locator("#settings-open").tap();
  assert.equal(await page.locator("#swap-mobile-actions").isChecked(), true);
  await page.locator("#swap-mobile-actions").uncheck();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.swapMobileActions === false, SAVE_KEY);
  await page.locator('[data-close="settings-dialog"]').tap();
  assert.deepEqual(await order(), ["roll", "shake"]);
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

test("anonymous distribution squares show the five shapes and fit beside Tilt", async t => {
  const page = await game(t);
  const examples = [
    [[65, 7, 7, 7, 7, 7], [1, .16, .16, .16, .16, .16]],
    [[42, 42, 4, 4, 4, 4], [1, 1, .16, .16, .16, .16]],
    [[30, 30, 30, 4, 3, 3], [1, 1, 1, .16, .16, .16]],
    [[50, 20, 20, 4, 3, 3], [1, .49, .49, .16, .16, .16]],
    [[18, 17, 17, 16, 16, 16], [.49, .49, .49, .49, .49, .49]],
  ];
  for (const [index, [percentages, expected]] of examples.entries()) {
    // Deliberately put the strongest face in a different position from the first square.
    const probabilities = [2, 4, 1, 5, 0, 3].map(i => percentages[i] / 100);
    await patchSave(page, { probabilities });
    assert.deepEqual(await hintOpacities(page), expected);
    assert.deepEqual((await saved(page)).probabilities, probabilities);
    assert.equal((await saved(page)).showProbabilities, false);
    assert.equal((await saved(page)).leaderboardEligible, true);
    assert.equal(await page.locator(".probability, .group-odds").count(), 0);
    const description = distributionHint(probabilities).description;
    assert.equal(await page.getByRole("img", { name: description, exact: true }).count(), 1);
    assert.equal(await page.locator("#distribution-hint").getAttribute("aria-label"), description);
    assert.equal(await page.locator("#tilt-info").getAttribute("aria-describedby"), "distribution-hint");
    assert.equal(await page.locator("#distribution-hint[title], #distribution-hint [title]").count(), 0);
    for (const [width, height] of [[1280, 900], [768, 900], [390, 844], [320, 568], [568, 320]]) {
      await page.setViewportSize({ width, height });
      const dimensions = await page.locator("#distribution-hint").evaluate(hint => {
        const label = document.querySelector("#tilt-number").getBoundingClientRect();
        const bounds = hint.getBoundingClientRect();
        const stage = hint.closest(".stage").getBoundingClientRect();
        const die = document.querySelector("#die-mover").getBoundingClientRect();
        const squares = [...hint.children].map(square => ({
          x: square.getBoundingClientRect().x, y: square.getBoundingClientRect().y,
          width: square.getBoundingClientRect().width, height: square.getBoundingClientRect().height,
          radius: getComputedStyle(square).borderRadius, color: getComputedStyle(square).backgroundColor,
          animations: square.getAnimations().length, transition: getComputedStyle(square).transitionDuration,
        }));
        return {
          aligned: Math.abs((label.top + label.bottom) / 2 - (bounds.top + bounds.bottom) / 2) < 1,
          beside: bounds.left > label.right && bounds.left - label.right <= 8,
          fits: bounds.left >= stage.left && bounds.right <= stage.right &&
            (bounds.right <= die.left || bounds.bottom <= die.top),
          labelColor: getComputedStyle(document.querySelector("#tilt-number")).color, squares,
        };
      });
      assert.ok(dimensions.aligned && dimensions.beside && dimensions.fits, `${width} × ${height}: ${JSON.stringify(dimensions)}`);
      assert.equal(dimensions.squares.length, 6);
      assert.ok(dimensions.squares.every(square => square.width === square.height && square.width >= 10 &&
        square.width === dimensions.squares[0].width && square.y === dimensions.squares[0].y &&
        square.radius === "3px" && square.color === dimensions.labelColor &&
        square.animations === 0 && square.transition === "0s"));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 1280 || width === 320)
        await page.locator(".stage").screenshot({ path: `test-results/distribution-example-${index + 1}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 320, height: 568 });
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    assert.deepEqual(await hintOpacities(page), examples[4][1]);
  }
  await page.screenshot({ path: "test-results/distribution-mobile-320.png", fullPage: true });
  await page.locator("#tilt-info").click();
  for (const [language] of guideLanguages) {
    await page.locator("#guide-language").selectOption(language);
    assert.ok((await page.locator(".tilt-guide + p").innerText()).endsWith(guides[language].tiltHint));
  }
});

test("distribution hint waits for reveal and follows redistribution, Shake, Jackpot, and resume", async t => {
  const page = await game(t);
  const probabilities = [.254, ...Array(5).fill((1 - .254) / 5)];
  await patchSave(page, { probabilities }, { settings: { ...(await save(page)).settings, reducedMotion: false } });
  const beforeTilt = await page.locator("#tilt-number").innerText();
  const before = [1, .49, .49, .49, .49, .49];
  assert.deepEqual(await hintOpacities(page), before);
  await page.evaluate(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = array => {
      if (array.length !== 6) return original(array);
      let value = Math.floor(.1 * 2 ** 48);
      for (let i = 5; i >= 0; i--) { array[i] = value % 256; value = Math.floor(value / 256); }
      return array;
    };
    window.hintUpdates = [];
    window.hintObserver = new MutationObserver(() => window.hintUpdates.push({
      die: document.querySelector("#die").getAttribute("aria-label"),
      opacities: [...document.querySelectorAll(".distribution-square")].map(square => Number(square.style.opacity)),
    }));
    window.hintObserver.observe(document.querySelector("#distribution-hint"), { childList: true, attributes: true });
  });
  await page.locator('[data-target="n1"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(() => document.querySelector("#die").getAnimations().length > 0);
  await page.evaluate(() => document.querySelector("#die").getAnimations().forEach(animation => animation.pause()));
  assert.equal((await saved(page)).rollsUsed, 1);
  assert.deepEqual(distributionHint((await saved(page)).probabilities).opacities, Array(6).fill(.49));
  assert.equal(await page.locator("#die").getAttribute("aria-label"), "Die rolling");
  assert.deepEqual(await hintOpacities(page), before);
  assert.deepEqual(await page.evaluate(() => window.hintUpdates), []);
  await page.evaluate(() => document.querySelector("#die").getAnimations().forEach(animation => animation.play()));
  await settled(page, "150");
  assert.equal(await page.locator("#tilt-number").innerText(), beforeTilt);
  assert.deepEqual(await hintOpacities(page), Array(6).fill(.49));
  const updates = await page.evaluate(() => { window.hintObserver.disconnect(); return window.hintUpdates; });
  assert.equal(updates.length, 1, "All six squares and their description update together");
  assert.notEqual(updates[0].die, "Die rolling");
  assert.deepEqual(updates[0].opacities, Array(6).fill(.49));

  await patchSave(page, { probabilities: [.5, .2, .2, .04, .03, .03] });
  const preShake = await hintOpacities(page);
  await page.locator("#shake").click();
  await page.waitForFunction(() => document.querySelector("#die").getAttribute("aria-label") === "Replacing the die");
  assert.deepEqual(await hintOpacities(page), preShake);
  await settled(page, "150");
  assert.deepEqual(await hintOpacities(page), distributionHint((await saved(page)).probabilities).opacities);
  assert.notDeepEqual(await hintOpacities(page), preShake);

  await patchSave(page, { probabilities: [.5, .2, .2, .04, .03, .03], rollsUsed: 99 },
    { settings: { ...(await save(page)).settings, reducedMotion: true } });
  const marked = (await saved(page)).jackpotNumber;
  const jackpotProbabilities = (await saved(page)).probabilities;
  const sample = jackpotProbabilities.slice(0, marked - 1).reduce((a, b) => a + b, 0) + jackpotProbabilities[marked - 1] / 2;
  await page.evaluate(sample => {
    const original = crypto.getRandomValues.bind(crypto);
    let first = true;
    crypto.getRandomValues = array => {
      if (array.length !== 6) return original(array);
      let value = Math.floor((first ? sample : .1) * 2 ** 48);
      first = false;
      for (let i = 5; i >= 0; i--) { array[i] = value % 256; value = Math.floor(value / 256); }
      return array;
    };
  }, sample);
  await page.locator(`[data-target="n${marked}"]`).click();
  await page.locator("#roll").click();
  await page.locator("#run-dialog[open]").waitFor();
  const committed = await saved(page);
  assert.equal(committed.lastRoll.jackpot, true);
  assert.equal(committed.showProbabilities, false);
  assert.equal(committed.leaderboardEligible, true);
  assert.equal((await save(page)).records.length, 1);
  assert.deepEqual(await hintOpacities(page), Array(6).fill(.49));
  await page.reload();
  await page.locator("#run-dialog[open]").waitFor();
  assert.deepEqual(await saved(page), committed);
  assert.deepEqual(await hintOpacities(page), Array(6).fill(.49));
});

test("the table and guide display all six Tilt levels", async t => {
  const page = await game(t);
  for (const [index, peak] of [1 / 6, .4, .475, .5, .55, .7].entries()) {
    const probabilities = [peak, ...Array(5).fill((1 - peak) / 5)];
    await patchSave(page, { probabilities });
    await page.reload();
    const caption = TILT_LABELS[index];
    await page.waitForFunction(caption => document.querySelector("#tilt-level").textContent === caption, caption);
    assert.match(await page.locator("#tilt-info").getAttribute("aria-label"), new RegExp(`level ${index + 1} of 6`));
    for (const [width, height] of [[1280, 900], [768, 900], [390, 844], [320, 568], [568, 320]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.locator("#tilt-level").innerText(), caption);
      assert.equal(await page.locator("#tilt-number").innerText(), `Tilt ${index + 1}`);
      const fits = await page.locator("#tilt-level").evaluate(element => {
        const text = document.createRange();
        text.selectNodeContents(element);
        const lines = text.getClientRects();
        const bounds = element.getBoundingClientRect();
        const space = element.closest(".stage").getBoundingClientRect();
        const net = document.querySelector("#result-display").getBoundingClientRect();
        const number = document.querySelector("#tilt-number");
        const numberStyle = getComputedStyle(number);
        return lines.length === 1 && element.scrollWidth <= element.clientWidth &&
          bounds.left >= space.left && bounds.right <= net.left &&
          bounds.top >= space.top && bounds.bottom <= space.bottom &&
          number.getBoundingClientRect().bottom <= bounds.top && numberStyle.color === "rgb(255, 255, 255)" &&
          parseFloat(numberStyle.fontSize) < parseFloat(getComputedStyle(element).fontSize);
      });
      assert.ok(fits, `Tilt ${index + 1} above ${caption} must fit with a smaller white title at ${width} × ${height}`);
    }
  }
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/six-tilts-${width}.png`, fullPage: true });
  }
});

test("Tilt stays visible, animates a changed level, and respects reduced motion", async t => {
  const page = await game(t, 320, { viewport: { width: 320, height: 568 } });
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
  assert.equal(await page.locator(".tilt-help").count(), 0);
  await page.locator("#settings-open").click();
  await page.locator("#motion").uncheck();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.documentElement.classList.contains("reduce-motion"));
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.reducedMotion === false, SAVE_KEY);
  const changeTilt = peak => page.evaluate(({ key, peak }) => {
    const save = JSON.parse(localStorage.getItem(key));
    const before = save.state.probabilities;
    save.state.probabilities = [peak, ...Array(5).fill((1 - peak) / 5)];
    // Simulate a roll settled by another tab, including its settlement receipt.
    save.state.lastRoll = { outcome: 1, stake: "10", totalReturn: "60", net: "50", jackpot: false,
      paidTargets: ["n1"], probabilitiesBefore: before, probabilitiesAfter: save.state.probabilities,
      markerBefore: save.state.jackpotNumber, transferred: true };
    save.state.rollsUsed++;
    save.state.gold = (BigInt(save.state.gold) + 50n).toString();
    save.state.canShake = true;
    save.state.revision = (BigInt(save.state.revision) + 1n).toString();
    save.revision = (BigInt(save.revision) + 1n).toString();
    localStorage.setItem(key, JSON.stringify(save));
    window.dispatchEvent(new StorageEvent("storage", { key }));
    const tilt = document.querySelector("#tilt-level");
    const bounds = tilt.getBoundingClientRect();
    const control = document.querySelector("#tilt-info").getBoundingClientRect();
    return { text: tilt.textContent, animations: tilt.getAnimations().length, fits: tilt.scrollWidth <= tilt.clientWidth && bounds.bottom <= control.bottom + 1 };
  }, { key: SAVE_KEY, peak });
  assert.deepEqual(await changeTilt(.7), { text: "EXTREME BIAS", animations: 1, fits: true });
  assert.equal(await page.locator("#tilt-change").innerText(), "▲");
  assert.match(await page.locator("#tilt-info").getAttribute("aria-label"), /Tilt increased from level 2 to 6/);
  await page.locator("#increase").click();
  assert.equal(await page.locator("#tilt-change").innerText(), "▲");
  assert.ok(await page.locator(".tilt-description").evaluate(row => {
    const indicator = row.querySelector("#tilt-change").getBoundingClientRect();
    return indicator.left >= row.querySelector("#tilt-level").getBoundingClientRect().right &&
      indicator.right <= document.querySelector("#result-display").getBoundingClientRect().left;
  }));
  await page.waitForFunction(() => document.querySelector("#tilt-level").getAnimations().length === 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.deepEqual(await changeTilt(1 / 6), { text: "NEARLY EVEN", animations: 0, fits: true });
  assert.equal(await page.locator("#tilt-change").innerText(), "▼");
  assert.match(await page.locator("#tilt-info").getAttribute("aria-label"), /Tilt decreased from level 6 to 1/);
  await page.screenshot({ path: "test-results/tilt-direction-mobile.png" });
  await page.locator("#settings-open").click();
  await page.locator("#settings-restart").click();
  await page.locator("#restart-confirm").click();
  await page.waitForFunction(() => document.querySelector("#notice").textContent.includes("New run."));
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
});

test("Tilt arrows track actual rolls and reset after unchanged rolls, Shake, and Jackpot", async t => {
  const page = await game(t);
  await patchSave(page, { probabilities: [.3562, ...Array(5).fill((1 - .3562) / 5)] });
  assert.equal(await page.locator("#tilt-number").innerText(), "Tilt 1");
  await page.locator('[data-target="row1"]').click();
  await page.locator("#roll").click();
  await settled(page, "110");
  assert.equal(await page.locator("#tilt-number").innerText(), "Tilt 2");
  assert.equal(await page.locator("#tilt-change").innerText(), "▲");
  await page.locator("#increase").click();
  assert.equal(await page.locator("#tilt-change").innerText(), "▲");
  await page.locator('[data-target="n2"]').click();
  await page.locator("#roll").click();
  await settled(page, "95");
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
  await patchSave(page, { probabilities: [.36, ...Array(5).fill((1 - .36) / 5)] });
  await land(page, 1);
  await page.locator('[data-target="n1"]').click();
  await page.locator("#roll").click();
  await settled(page, "145");
  assert.equal(await page.locator("#tilt-number").innerText(), "Tilt 1");
  assert.equal(await page.locator("#tilt-change").innerText(), "▼");
  await page.locator("#shake").click();
  await settled(page, "145");
  assert.equal(await page.locator("#tilt-number").innerText(), "Tilt 1");
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
  await page.locator('[data-target="row0"]').click();
  await page.locator("#roll").click();
  await settled(page, "155");
  assert.equal(await page.locator("#tilt-change").innerText(), "▲");
  assert.match(await page.locator("#tilt-info").getAttribute("aria-label"), /Bias increased \(entropy decreased\).*Tilt remains at level 1/);
  await page.locator("#shake").click();
  await settled(page, "155");
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
  await patchSave(page, { probabilities: [.36, ...Array(5).fill((1 - .36) / 5)] });
  await land(page, 1);
  await page.locator('[data-target="n1"]').click();
  await page.locator("#roll").click();
  await settled(page, "205");
  assert.equal(await page.locator("#tilt-change").innerText(), "▼");
  const state = await saved(page);
  const marked = state.jackpotNumber;
  await land(page, marked);
  await page.locator(`[data-target="n${marked}"]`).click();
  await page.locator("#roll").click();
  await settled(page, "435");
  assert.equal((await saved(page)).lastRoll.jackpot, true);
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
});

test("Tilt arrows show entropy changes in both directions within the same level", async t => {
  const page = await game(t);
  for (const { probabilities, outcome, target, level, gold, arrow, description } of [
    { probabilities: [.5, .1, .1, .1, .1, .1], outcome: 2, target: "row1", level: 4,
      gold: "110", arrow: "▲", description: "Bias increased (entropy decreased)" },
    { probabilities: [.4, .2, .15, .1, .1, .05], outcome: 1, target: "row0", level: 2,
      gold: "120", arrow: "▼", description: "Bias decreased (entropy increased)" },
  ]) {
    await patchSave(page, { probabilities });
    assert.equal(await page.locator("#tilt-change").innerText(), "-");
    assert.equal(await page.locator("#tilt-number").innerText(), `Tilt ${level}`);
    await land(page, outcome);
    await page.locator(`[data-target="${target}"]`).click();
    await page.locator("#roll").click();
    await settled(page, gold);
    const result = (await saved(page)).lastRoll;
    assert.equal(result.jackpot, false);
    const change = probabilityEntropy(result.probabilitiesAfter) - probabilityEntropy(result.probabilitiesBefore);
    assert.ok(arrow === "▲" ? change < 0 : change > 0);
    assert.equal(await page.locator("#tilt-number").innerText(), `Tilt ${level}`);
    assert.equal(await page.locator("#tilt-change").innerText(), arrow);
    const label = await page.locator("#tilt-info").getAttribute("aria-label");
    assert.ok(label.includes(description));
    assert.ok(label.includes(`Tilt remains at level ${level}.`));
    assert.ok((await page.locator("#tilt-change").getAttribute("title")).includes(description));
    await page.locator("#increase").click();
    assert.equal(await page.locator("#tilt-change").innerText(), arrow);
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#gold").textContent === "120");
  assert.equal(await page.locator("#tilt-change").innerText(), "-");
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
  const leaders = (await save(page)).records;
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
  assert.deepEqual((await save(page)).records, leaders);
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

test("a committed roll survives refresh during animation and rapid inputs settle once", async t => {
  const page = await game(t);
  await page.locator("#settings-open").click();
  await page.locator("#motion").uncheck();
  await page.keyboard.press("Escape");
  await page.locator('[data-target="n6"]').click();
  await page.evaluate(() => {
    document.querySelector("#roll").click();
    document.querySelector("#roll").click();
    document.querySelector('[data-target="n1"]').click();
    document.querySelector("#settings-restart").click();
  });
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).state.rollsUsed === 1, SAVE_KEY);
  assert.equal(await page.locator("#roll").isDisabled(), true);
  assert.equal((await saved(page)).gold, "330");
  assert.equal((await saved(page)).revision, "1");
  const committed = await saved(page);
  await page.reload();
  await settled(page, "330");
  assert.deepEqual(await saved(page), committed);
  assert.deepEqual(await hintOpacities(page), distributionHint(committed.probabilities).opacities);
  assert.equal(await page.locator("#draft-total").textContent(), "0 G");
  assert.equal(await page.locator("#rolls-remaining").innerText(), "99");
});

test("the final roll records once before animation, reloads frozen, and named restart retains records and settings", async t => {
  const page = await game(t);
  await patchSave(page, { rollsUsed: 99 }, { settings: { ...(await save(page)).settings, reducedMotion: false } });
  await page.locator('[data-target="n6"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).state.recorded, SAVE_KEY);
  assert.equal((await save(page)).records.length, 1);
  const completed = await saved(page);
  await page.reload();
  await page.locator("#run-dialog[open]").waitFor();
  assert.equal(await page.locator("#run-score").innerText(), "330 G");
  assert.match(await page.locator("#run-comparison").innerText(), /first completed run/);
  assert.equal(await page.locator("#roll").isDisabled(), true);
  assert.equal(await page.locator("#shake").isDisabled(), true);
  assert.deepEqual(await saved(page), completed);
  await page.screenshot({ path: "test-results/current-run-results-desktop.png", fullPage: true });
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await page.locator("#run-dialog[open]").waitFor();
    assert.equal((await save(page)).records.length, 1);
  }
  const preferences = (await save(page)).settings;
  await page.locator("#run-nickname").fill("Finisher");
  await page.locator("#run-confirm").click();
  await settled(page, "100");
  const restarted = await save(page);
  assert.equal(restarted.state.rollsUsed, 0);
  assert.notEqual(restarted.state.id, completed.id);
  assert.equal(restarted.state.nickname, "Finisher");
  assert.equal(restarted.records[0].nickname, "Finisher");
  assert.equal(restarted.records[0].score, "330");
  assert.deepEqual(restarted.settings, preferences);
  await page.reload();
  await settled(page, "100");
  assert.deepEqual((await save(page)).records, restarted.records);
});

test("probabilities require confirmation and exclusion survives hiding and reload; restart preserves prior records", async t => {
  const page = await game(t);
  const records = [{ id: "b".repeat(32), nickname: "Earlier", score: "80", order: "0" }];
  await patchSave(page, { bestGold: "80", hasCompletedRun: true }, { records });
  await page.locator('[data-target="n1"]').click();
  await page.locator("#settings-open").click();
  await page.locator("#show-probabilities").click();
  await page.locator("#probabilities-cancel").click();
  assert.equal((await saved(page)).showProbabilities, false);
  assert.equal(await page.locator("#draft-total").textContent(), "10 G");
  await page.locator("#show-probabilities").click();
  await page.locator("#probabilities-confirm").click();
  await page.waitForFunction(() => !document.querySelector("#show-probabilities").disabled);
  assert.equal((await saved(page)).leaderboardEligible, false);
  await page.locator("#show-probabilities").click();
  await page.waitForFunction(() => !document.querySelector("#show-probabilities").disabled);
  await page.reload();
  assert.equal((await saved(page)).leaderboardEligible, false);
  assert.equal((await saved(page)).showProbabilities, false);
  await patchSave(page, { rollsUsed: 99 });
  await page.locator('[data-target="red"]').click();
  await page.locator('[data-target="black"]').click();
  await page.locator("#roll").click();
  await page.locator("#run-dialog[open]").waitFor();
  assert.deepEqual((await save(page)).records, records);
  assert.match(await page.locator("#run-comparison").innerText(), /excluded from personal records/);
  await page.locator("#run-confirm").click();
  await settled(page, "100");
  assert.equal((await saved(page)).leaderboardEligible, true);
  assert.deepEqual((await save(page)).records, records);
});

test("personal records sort huge adjacent scores exactly with stable ties and safely render names", async t => {
  const page = await game(t);
  const large = 10n ** 80n;
  const records = Array.from({ length: 10 }, (_, index) => ({
    id: (index + 1).toString(16).padStart(32, "0"), nickname: index === 0 ? "<svg/onload=alert(1)>" : `Run ${index + 1}`,
    score: (large + BigInt(index)).toString(), order: String(index + 1),
  }));
  records[0].score = records[9].score;
  await patchSave(page, { bestGold: records[9].score, hasCompletedRun: true }, { records: records.reverse() });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1101) await page.locator("#leaderboard-open").click();
    assert.equal(await page.locator("#leaders li[value]").count(), 10);
    const names = await page.locator("#leaders .leader-name").evaluateAll(rows => rows.map(row => row.childNodes[0].textContent));
    assert.equal(names[0], "<svg/onload=alert(1)>");
    assert.equal(names[1], "Run 10");
    assert.equal(names[2], "Run 9");
    assert.equal(await page.locator("#leaders svg, #leaders script").count(), 0);
    assert.equal(await page.locator("#leaders li[value='3'] > strong").getAttribute("aria-label"), `${(large + 8n).toLocaleString("en-US")} Gold`);
    assert.match(await page.locator(".personal-records-note").innerText(), /stored in this browser/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/current-records-${width}.png`, fullPage: true });
    if (width < 1101) await page.keyboard.press("Escape");
  }
  await page.reload();
  assert.equal(await page.locator("#leaders .leader-name").first().evaluate(el => el.childNodes[0].textContent), "<svg/onload=alert(1)>");
});

test("malformed saves recover, preserve the unreadable value, and leave neighboring projects untouched", async t => {
  const page = await game(t);
  await page.evaluate(key => {
    localStorage.setItem("homepage:preference", "keep");
    localStorage.setItem(key, "{broken");
  }, SAVE_KEY);
  await page.reload();
  await page.locator("#welcome-start").click();
  assert.match(await page.locator("#save-notice").innerText(), /could not be read/);
  assert.equal(await page.evaluate(() => localStorage.getItem("sixfold:save:recovery")), "{broken");
  await page.locator('[data-target="red"]').click();
  await page.locator('[data-target="black"]').click();
  await page.locator("#roll").click();
  await page.waitForFunction(() => !document.querySelector('[data-target="n1"]').disabled);
  assert.equal((await saved(page)).rollsUsed, 1);
  await page.locator("#settings-open").click();
  await page.locator("#settings-restart").click();
  await page.locator("#restart-confirm").click();
  await settled(page, "100");
  assert.equal(await page.evaluate(() => localStorage.getItem("homepage:preference")), "keep");
});

test("blocked storage and quota failures explain unsaved progress while permitting play and restart", async t => {
  for (const failure of ["getter", "quota"]) {
    const page = await game(t);
    await page.addInitScript(mode => {
      if (mode === "getter") Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("Blocked", "SecurityError"); } });
      else Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
    }, failure);
    await page.reload();
    if (failure === "getter") await page.locator("#welcome-start").click();
    await page.locator("#settings-open").click();
    await page.locator("#motion").check();
    await page.keyboard.press("Escape");
    await page.locator('[data-target="red"]').click();
    await page.locator('[data-target="black"]').click();
    await page.locator("#roll").click();
    await settled(page, "100");
    assert.equal(await page.locator("#rolls-remaining").innerText(), "99");
    assert.match(await page.locator("#save-notice").innerText(), /cannot be saved/);
    await page.locator("#settings-open").click();
    await page.locator("#settings-restart").click();
    await page.locator("#restart-confirm").click();
    await settled(page, "100");
    assert.equal(await page.locator("#rolls-remaining").innerText(), "100");
  }
});

test("same-origin tabs cannot settle two stale drafts or overwrite a restarted run", async t => {
  const page = await game(t);
  const other = await page.context().newPage();
  await other.goto(origin);
  await other.waitForSelector('[data-target="n6"]:enabled');
  await page.locator('[data-target="n6"]').click();
  await other.locator('[data-target="n6"]').click();
  await Promise.all([page.evaluate(() => document.querySelector("#roll").click()), other.evaluate(() => document.querySelector("#roll").click())]);
  await page.waitForFunction(() => !document.querySelector('[data-target="n1"]').disabled);
  await other.waitForFunction(() => !document.querySelector('[data-target="n1"]').disabled);
  assert.equal((await saved(page)).rollsUsed, 1);
  assert.equal((await saved(page)).gold, "330");
  await page.locator("#settings-open").click();
  await page.locator("#settings-restart").click();
  await page.locator("#restart-confirm").click();
  await settled(page, "100");
  await settled(other, "100");
  assert.equal(await other.locator("#rolls-remaining").innerText(), "100");
  assert.equal(await other.locator("#draft-total").textContent(), "0 G");
});

test("project-path assets and About navigation resolve; normal gameplay makes no requests even offline", async t => {
  const page = await game(t);
  const paths = await page.locator('script[src], link[rel="stylesheet"], link[rel="icon"]').evaluateAll(nodes => nodes.map(node => node.src || node.href));
  for (const url of paths) {
    assert.ok(new URL(url).pathname.startsWith("/sixfold/"), url);
    const response = await page.request.get(url);
    assert.equal(response.status(), 200, url);
  }
  await page.locator(".site-information").click();
  assert.ok(page.url().endsWith("/sixfold/about.html"));
  const back = await page.locator("nav a").getAttribute("href");
  assert.equal(new URL(back, page.url()).pathname, "/sixfold/");
  const favicon = await page.locator('link[rel="icon"]').evaluate(node => node.href);
  assert.equal(new URL(favicon).pathname, "/sixfold/favicon.svg");
  assert.equal((await page.request.get(favicon)).status(), 200);
  const notice = await page.locator('a[href="./third-party-notices.txt"]').getAttribute("href");
  const noticeResponse = await page.request.get(new URL(notice, page.url()).href);
  assert.equal(noticeResponse.status(), 200);
  assert.match(await noticeResponse.text(), /MIT License/);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `About overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator("nav a").click();
  await settled(page, "100");
  const requests = [];
  page.on("request", request => requests.push(request.url()));
  await page.context().setOffline(true);
  await page.locator('[data-target="n6"]').click();
  await page.locator("#roll").click();
  await settled(page, "330");
  await page.locator("#settings-open").click();
  await page.locator("#nickname").fill("Offline");
  await page.locator("#save-nickname").click();
  await page.waitForFunction(() => document.querySelector("#nickname-status").textContent === "Name saved.");
  await page.locator("#settings-restart").click();
  await page.locator("#restart-confirm").click();
  await settled(page, "100");
  assert.deepEqual(requests, []);
  assert.equal((await saved(page)).nickname, "Offline");
  await page.context().setOffline(false);
  await page.mouse.move(0, 0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "test-results/current-game-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/current-game-mobile.png", fullPage: true });
  const records = [7500, 1250, 330, 280, 190, 100].map((score, index) => ({
    id: (index + 1).toString(16).padStart(32, "0"), nickname: `Run ${index + 1}`,
    score: String(score), order: String(index + 1),
  }));
  await patchSave(page, { bestGold: "7500", hasCompletedRun: true }, { records });
  await page.locator("#leaderboard-open").click();
  await page.screenshot({ path: "test-results/current-personal-records-mobile.png", fullPage: true });
});

test("Gold cards fit full exact values without changing card height, including animated counts", async t => {
  const page = await game(t);
  const id = (await saved(page)).id;
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    let height;
    for (const gold of ["100", "999999", "1000000", "9007199254740993", "100000000000000000000000000000001"]) {
      await patchSave(page, { gold });
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
  await patchSave(page, { gold: "999999" });
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
