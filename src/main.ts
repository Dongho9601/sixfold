import "./style.css";
import { BOARD, CONFIG, TARGET_BY_ID } from "./config";
import type {
  Action,
  ActionRequest,
  ActionResponse,
  Leader,
  PlayerState,
  Settlement,
  Wagers,
} from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;
const icon = (name: string) => {
  const paths: Record<string, string> = {
    trophy:
      '<path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 12v6m-4 3h8m-9-3h10"/>',
    settings:
      '<path d="m9 3-1 3-3 1v4l2 2-1 3 3 3 3-1 3 1 3-3-1-3 2-2V7l-3-1-1-3H9Z"/><circle cx="12" cy="11" r="3"/>',
    shake:
      '<path d="M4 8a8 8 0 0 1 14-3l2 3M20 3v5h-5M20 16A8 8 0 0 1 6 19l-2-3m0 5v-5h5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="12" cy="12" r="1"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const formatGold = (s: string | bigint) =>
  BigInt(s).toLocaleString("en-US");
const signed = (s: string) =>
  `${BigInt(s) >= 0n ? "+" : "−"}${formatGold(BigInt(s) < 0n ? -BigInt(s) : BigInt(s))}`;
const percent = (p: number) =>
  p > 0 && p < 0.0001
    ? "<0.01%"
    : `${(p * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let state: PlayerState | undefined;
let draft: Wagers = {};
let amount = CONFIG.selectedWager as string;
let busy = false;
let actionPhase = "";
let pending: ActionRequest | null = null;
let hoverTarget: string | null = null;
let sound = localStorage.getItem("one-of-six-sound") === "on";
let audioContext: AudioContext | undefined;
let announcement = "";
let networkError = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let manualReducedMotion =
  localStorage.getItem("one-of-six-motion") === "reduce";
const shouldReduceMotion = () => reducedMotion.matches || manualReducedMotion;
document.documentElement.classList.toggle("reduce-motion", manualReducedMotion);
try {
  pending = JSON.parse(sessionStorage.getItem("one-of-six-pending") || "null");
} catch {
  sessionStorage.removeItem("one-of-six-pending");
}

app.innerHTML = `
  <div class="workspace">
    <main id="game" aria-label="${CONFIG.title} game">
      <aside class="sidebar" aria-label="Your game">
        <header class="header"><a class="wordmark" href="/" aria-label="${CONFIG.title} home">${icon("dice")}${CONFIG.title}<span>PLAY THE ODDS</span></a></header>
        <section class="bankroll" aria-label="Your Gold">
          <div class="balance"><span class="eyebrow">Bankroll</span><div class="balance-value"><span id="gold">—</span><span class="gold-unit">G</span></div></div>
          <div class="personal-best"><span>Personal best</span><span id="best-gold" class="best-value">— G</span></div>
        </section>
        <div class="jackpot-line" id="jackpot-line"><span class="eyebrow">The long shot</span><span id="jackpot-text">Loading…</span></div>
        <section class="accounting" aria-label="Your wagers"><div><span>On the table</span><strong id="draft-total">0 G</strong></div><div><span>Available</span><strong id="available">— G</strong></div><div class="draft-actions"><button id="edit-draft" aria-expanded="false" aria-controls="draft-tray">Edit bets <span id="draft-count">0</span></button><button id="clear-draft">Clear</button></div></section>
        <div class="sidebar-bottom"><div class="header-actions"><button id="leaderboard-open" class="utility-button" aria-label="Open leaderboard" aria-expanded="false">${icon("trophy")}<span>Leaderboard</span></button><button id="settings-open" class="utility-button" aria-label="Settings">${icon("settings")}<span>Settings</span></button></div><span class="play-note">A little luck. A little strategy.</span></div>
      </aside>
      <div class="playfield">
        <section class="table-area" aria-label="Betting table">
          <div class="felt">
            <section class="stage" aria-label="Die and result">
              <div class="table-heading"><span class="eyebrow">MAKE YOUR CALL</span><span id="table-status">Place your bets</span></div>
              <div class="die-area"><div id="die-shadow" class="die-shadow"></div><div id="die-mover" class="die-mover"><div id="die" class="die" role="img" aria-label="Die, ready to roll"></div></div><div id="landing-ring" class="landing-ring"></div></div>
              <div id="result-display" class="result-display" aria-hidden="true"><span class="result-label">ONE ROLL. SIX POSSIBILITIES.</span><strong class="result-value">Good luck.</strong><span class="result-detail">Every number has its odds.</span></div>
            </section>
            <div id="board" class="board"></div>
            <div class="color-bets" id="color-bets"></div>
            <div class="table-footer"><span>NUMBER ×6 <i>·</i> COLUMN ×3 <i>·</i> ROW & COLOR ×2</span><span>PLAY GOLD ONLY</span></div>
          </div>
        </section>
        <section class="betting-controls" aria-label="Wager controls">
          <div class="chip-controls"><span class="control-label">Choose your bet</span><div class="denominations" role="group" aria-label="Quick bet amounts">${[1, 5, 10, 25].map(value => `<button class="denomination" data-amount="${value}" aria-label="Bet amount ${value} Gold" aria-pressed="${value === 10}"><span>${value}</span></button>`).join("")}</div><div class="amount-selector"><button id="decrease" aria-label="Decrease bet by 5 Gold">−</button><label class="sr-only" for="bet-amount">Bet amount in Gold</label><input id="bet-amount" type="text" inputmode="numeric" pattern="[0-9]*" value="10" aria-label="Bet amount in Gold" autocomplete="off" /><span>G</span><button id="increase" aria-label="Increase bet by 5 Gold">+</button></div></div>
          <div class="actions"><button id="roll" class="roll-button">${icon("dice")}<span>Roll dice</span><kbd>R</kbd></button><button id="shake" class="shake-button">${icon("shake")}<span>Shake</span><kbd>S</kbd></button></div>
          <p class="hint"><span class="pointer-hint">Click a space to bet · Right-click to take it back</span><span class="touch-hint">Tap a space to bet · Edit bets to take it back</span></p>
          <div class="messages"><p id="roll-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p><p id="notice" class="notice" role="status" aria-live="polite"></p><button id="retry" class="text-button" hidden>Retry saved action</button><button id="restart" class="restart-button" hidden>Start again with 100 G</button></div>
        </section>
      </div>
      <section id="draft-tray" class="draft-tray" aria-label="Edit your bets" hidden><div class="draft-top"><h2>On the table</h2><button id="close-draft" class="icon-button" aria-label="Close bet editor">${icon("close")}</button></div><div id="draft-rows"></div></section>
    </main>
  </div>
  <div id="effects" class="effects" aria-hidden="true"></div>
  <dialog id="leaderboard-dialog" class="leaderboard-dialog" aria-labelledby="leaderboard-title"><div class="dialog-top"><div><h2 id="leaderboard-title">Leaderboard</h2></div><button class="icon-button" data-close="leaderboard-dialog" aria-label="Close leaderboard">${icon("close")}</button></div><p class="dialog-intro">Your highest settled Gold.</p><div class="ranking-labels"><span>PLAYER</span><span>BEST GOLD</span></div><ol id="leaders"></ol><p class="leaderboard-note">Highest Gold across all games.</p><div class="your-record"><span id="your-nickname"></span><strong id="your-best"></strong></div></dialog>
  <dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="dialog-top"><div><h2 id="settings-title">Settings & how to play</h2></div><button class="icon-button" data-close="settings-dialog" aria-label="Close settings">${icon("close")}</button></div>
    <form id="nickname-form"><label for="nickname">Your leaderboard name</label><div class="nickname-row"><input id="nickname" maxlength="48" required autocomplete="nickname"/><button type="submit" id="save-nickname">Save</button></div><p id="nickname-status" role="status"></p></form>
    <label class="sound-control"><span>Sound effects<small>Soft, procedural dice and win tones</small></span><input id="sound" type="checkbox" role="switch" ${sound ? "checked" : ""}/></label>
    <label class="sound-control"><span>Reduce motion<small>Skip dice movement and celebration effects</small></span><input id="motion" type="checkbox" role="switch" ${shouldReduceMotion() ? "checked" : ""}/></label>
    <div class="instructions"><h3>How to play</h3><p>Play Gold only. No real money.</p><p>Select an amount, then tap any number or group to add a wager. Right-click a target to remove its entire wager. Use <b>Edit bets</b> to reduce or remove wagers on any device. Overlapping bets are welcome.</p><p><b>Roll</b> samples one outcome using the displayed odds. Each winning wager pays its total return: number ×6, row ×2, column ×3, color ×2.</p><p>When any wager pays, the rolled number gives 25% of its probability to the other five equally—even on a break-even or net-loss Roll. A complete miss leaves the odds unchanged.</p><p><b>Jackpot ×24:</b> wager only on the marked number. A hit pays ×24 instead of ×6, then automatically Shakes to a fresh board. The lowest probability is marked; the lowest number breaks ties.</p><p><b>Shake</b> is free and unlimited. It refreshes the probabilities and clears your draft. Gold stays yours. Rolls also clear your draft. At zero Gold, start again; your best record stays.</p><p>Gold and odds save automatically. A refresh resumes your board. Uncommitted drafts are local to this tab and clear on refresh. On desktop, <kbd>R</kbd> rolls and <kbd>S</kbd> shakes. All controls also work with Tab and Enter. Reduced-motion preferences are respected.</p></div>
  </dialog>
`;

function targetButton(id: string, classes: string, style = "") {
  return `<button class="target ${classes}" data-target="${id}" ${style ? `style="${style}"` : ""}></button>`;
}
$("board").innerHTML = [
  '<div class="board-key" aria-hidden="true"><span>Number</span><strong>×6</strong></div>',
  ...[0, 1, 2].map((i) =>
    targetButton(
      `col${i}`,
      "group column-target",
      `grid-column:${i + 1};grid-row:1`,
    ),
  ),
  ...BOARD.flatMap((row, r) =>
    row.map((cell, c) =>
      targetButton(
        `n${cell.number}`,
        `number-target ${cell.color}`,
        `grid-column:${c + 1};grid-row:${r + 2}`,
      ),
    ),
  ),
  ...[0, 1].map((r) =>
    targetButton(
      `row${r}`,
      "group row-target",
      `grid-column:4;grid-row:${r + 2}`,
    ),
  ),
].join("");
$("color-bets").innerHTML = ["red", "black"]
  .map((c) => targetButton(c, `group color-target ${c}-group`))
  .join("");

const pipPositions: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
// Opposite faces add to seven, just like a physical die.
const faceRotations: Record<number, [number, number]> = {
  1: [0, 0], 2: [0, 90], 3: [-90, 0], 4: [90, 0], 5: [0, -90], 6: [0, 180],
};
$("die").innerHTML = Object.entries(faceRotations).map(([face, [x, y]]) =>
  `<span class="die-face" style="transform:rotateX(${x}deg) rotateY(${y}deg) translateZ(var(--die-half))">${Array.from({length: 9}, (_, i) => `<span class="pip ${pipPositions[Number(face)].includes(i) ? "visible" : ""}"></span>`).join("")}</span>`,
).join("");
let dieRotation = "";
function diePose(number: number, turns = 0) {
  const [x, y] = faceRotations[number];
  return `rotateX(-16deg) rotateY(22deg) rotateY(${-y + turns * 360}deg) rotateX(${-x + turns * 360}deg)`;
}
function setDie(number: number) {
  dieRotation = diePose(number);
  $("die").style.transform = dieRotation;
  $("die").setAttribute("aria-label", `Die showing ${number}`);
}
setDie(1);

// All motion is decorative. The server settles the roll before presentation begins.
const activeAnimations = new Set<Animation>();
function motion(element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (shouldReduceMotion()) return Promise.resolve();
  const animation = element.animate(frames, options);
  activeAnimations.add(animation);
  return animation.finished.catch(() => {}).finally(() => {
    activeAnimations.delete(animation);
    animation.cancel();
  });
}
function stopMotion() {
  activeAnimations.forEach(animation => animation.cancel());
  $("effects").replaceChildren();
}
async function rollDie(outcome: number, shake = false) {
  if (shouldReduceMotion()) { setDie(outcome); return; }
  $("die").setAttribute("aria-label", shake ? "Die shaking" : "Die rolling");
  const duration = shake ? 700 : CONFIG.animationMs;
  const finalRotation = diePose(outcome, 2);
  await Promise.all([
    motion($("die"), [
      {transform: dieRotation, offset: 0},
      {transform: "rotateX(230deg) rotateY(290deg) rotateZ(-24deg)", offset: .38},
      {transform: "rotateX(510deg) rotateY(570deg) rotateZ(14deg)", offset: .69},
      {transform: finalRotation, offset: 1},
    ], {duration, easing: "cubic-bezier(.18,.62,.28,1)"}),
    motion($("die-mover"), [
      {transform: "translate3d(0,0,0)", offset: 0},
      {transform: "translate3d(-34px,-38px,24px)", offset: .22},
      {transform: "translate3d(18px,4px,0)", offset: .54},
      {transform: "translate3d(6px,-15px,8px)", offset: .7},
      {transform: "translate3d(0,2px,0)", offset: .86},
      {transform: "translate3d(0,0,0)", offset: 1},
    ], {duration, easing: "ease-in-out"}),
    motion($("die-shadow"), [
      {transform: "scale(1)", opacity: .4},
      {transform: "translateX(-20px) scale(.65)", opacity: .15, offset: .22},
      {transform: "translateX(12px) scale(1.2)", opacity: .5, offset: .54},
      {transform: "scale(.85)", opacity: .25, offset: .7},
      {transform: "scale(1)", opacity: .4},
    ], {duration}),
  ]);
  setDie(outcome);
  playTone("chip");
  void motion($("landing-ring"), [{transform: "scale(.55)", opacity: .65}, {transform: "scale(1.6)", opacity: 0}], {duration: 400, easing: "ease-out"});
}
function compactGold(value: string) {
  if (value.length <= 5) return formatGold(value);
  const units = [[18, "Qi"], [15, "Q"], [12, "T"], [9, "B"], [6, "M"], [3, "K"]] as const;
  if (value.length > 21) return `${value[0]}.${value.slice(1, 3)}e${value.length - 1}`;
  const [power, suffix] = units.find(([power]) => value.length > power)!;
  const scaled = BigInt(value) * 10n / (10n ** BigInt(power));
  return `${scaled / 10n}${scaled % 10n ? `.${scaled % 10n}` : ""}${suffix}`;
}
function coinStack(value: string) {
  const count = Math.min(5, Math.max(1, value.length + (BigInt(value) >= 20n ? 1 : 0)));
  return `<span class="coin-stack" title="${formatGold(value)} Gold wagered" aria-hidden="true">${Array.from({length: count}, (_, i) => `<i class="stack-coin" style="--coin-index:${i}"></i>`).join("")}<span class="coin-value" style="--coin-index:${count - 1}">${compactGold(value)}</span></span>`;
}
function targetElement(id: string) {
  return document.querySelector<HTMLElement>(`[data-target="${id}"]`)!;
}
function clearResult() {
  document.querySelectorAll(".hit, .paid, .missed").forEach(el => el.classList.remove("hit", "paid", "missed"));
  $("result-display").className = "result-display";
  $("result-display").innerHTML = '<span class="result-label">ONE ROLL. SIX POSSIBILITIES.</span><strong class="result-value">Good luck.</strong><span class="result-detail">Every number has its odds.</span>';
  $("table-status").textContent = "Place your bets";
}
function coinFlight(from: HTMLElement, to: HTMLElement, count = 1) {
  if (shouldReduceMotion()) return Promise.resolve();
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  return Promise.all(Array.from({length: count}, (_, i) => {
    const coin = document.createElement("span");
    coin.className = "flying-coin";
    coin.textContent = "✦";
    const x = a.left + a.width / 2, y = a.top + a.height / 2;
    const dx = b.left + b.width / 2 - x, dy = b.top + b.height / 2 - y;
    coin.style.left = `${x}px`; coin.style.top = `${y}px`;
    $("effects").append(coin);
    return motion(coin, [
      {transform: "translate(-50%,-50%) scale(.65)", opacity: 0},
      {transform: `translate(calc(-50% + ${dx * .25 + (i - count / 2) * 12}px), calc(-50% + ${Math.min(-65, dy * .6)}px)) rotate(-90deg) scale(1)`, opacity: 1, offset: .42},
      {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(30deg) scale(.55)`, opacity: 0},
    ], {duration: 620, delay: i * 65, easing: "cubic-bezier(.3,.05,.55,1)"}).finally(() => coin.remove());
  })).then(() => {});
}
function rewardBurst(element: HTMLElement, jackpot: boolean) {
  if (shouldReduceMotion()) return Promise.resolve();
  const bounds = element.getBoundingClientRect();
  const count = jackpot ? 16 : 7;
  return Promise.all(Array.from({length: count}, (_, i) => {
    const spark = document.createElement("span");
    spark.className = "reward-spark";
    spark.textContent = i % 3 === 0 ? "✦" : "·";
    spark.style.left = `${bounds.left + bounds.width / 2}px`;
    spark.style.top = `${bounds.top + bounds.height / 2}px`;
    $("effects").append(spark);
    const angle = i / count * Math.PI * 2;
    const distance = jackpot ? 65 + (i % 3) * 15 : 45;
    return motion(spark, [
      {transform: "translate(-50%,-50%) scale(.4)", opacity: 0},
      {opacity: 1, offset: .15},
      {transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(1.1)`, opacity: 0},
    ], {duration: jackpot ? 1050 : 700, easing: "ease-out"}).finally(() => spark.remove());
  })).then(() => {});
}
function countBalance(from: bigint, to: bigint) {
  if (shouldReduceMotion()) { $("gold").textContent = formatGold(to); return Promise.resolve(); }
  return new Promise<void>(resolve => {
    const start = performance.now();
    function frame(now: number) {
      const progress = shouldReduceMotion() ? 1 : Math.min(1, (now - start) / 720);
      const eased = BigInt(Math.round((1 - (1 - progress) ** 3) * 1000));
      $("gold").textContent = formatGold(from + (to - from) * eased / 1000n);
      if (progress < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}
async function revealResult(result: Settlement, wagers: Wagers, nextGold: string) {
  const hasReturn = BigInt(result.totalReturn) > 0n;
  targetElement(`n${result.outcome}`).classList.add("hit");
  Object.keys(wagers).forEach(id => targetElement(id).classList.add(result.paidTargets.includes(id) ? "paid" : "missed"));
  $("table-status").textContent = `Rolled ${result.outcome}`;
  $("result-display").className = `result-display ${hasReturn ? "won" : "lost"} ${result.jackpot ? "jackpot" : ""}`;
  $("result-display").innerHTML = `<span class="result-label">${result.jackpot ? "JACKPOT!" : hasReturn ? "RETURN" : "NO HIT THIS ROLL"}</span><strong class="result-value">${hasReturn ? `${formatGold(result.totalReturn)} G` : "Next roll."}</strong><span class="result-detail">${hasReturn ? `${signed(result.net)} G net${result.jackpot ? " · ×24" : ""}` : `−${formatGold(result.stake)} G`}</span>`;
  announceRoll(result);
  if (hasReturn) playTone(result.jackpot ? "jackpot" : "win");
  const reveals = result.paidTargets.map((id, i) => {
    const element = targetElement(id);
    const payout = BigInt(wagers[id] || "0") * BigInt(result.jackpot ? CONFIG.multipliers.jackpot : TARGET_BY_ID.get(id)!.multiplier);
    const label = document.createElement("span");
    label.className = "payout-label";
    label.textContent = `+${compactGold(payout.toString())} G`;
    element.append(label);
    return motion(label, [{opacity: 0, transform: "translateY(8px)"}, {opacity: 1, transform: "translateY(-8px)", offset: .25}, {opacity: 1, transform: "translateY(-12px)", offset: .75}, {opacity: 0, transform: "translateY(-26px)"}], {duration: result.jackpot ? 1250 : 900, delay: i * 90, fill: "backwards"}).finally(() => label.remove());
  });
  const goldBefore = BigInt(state!.gold);
  await Promise.all([
    ...reveals,
    ...result.paidTargets.map(id => rewardBurst(targetElement(id), result.jackpot)),
    ...result.paidTargets.map(id => motion(targetElement(id), [
      {boxShadow: "inset 0 0 0 2px #ffe7a2, inset 0 0 55px #ffde6a66"},
      {boxShadow: "inset 0 0 0 2px #ffe7a288, inset 0 0 20px #ffde6a11"},
      {boxShadow: "inset 0 0 0 2px #ffe7a2, inset 0 0 40px #ffde6a44"},
    ], {duration: 700, easing: "ease-in-out"})),
    ...result.paidTargets.map(id => coinFlight(targetElement(id).querySelector<HTMLElement>(".coin-stack") || targetElement(id), $("gold"), result.jackpot ? 9 : 4)),
    countBalance(goldBefore, BigInt(nextGold)),
    motion($("result-display"), [{opacity: .2, transform: "translateY(8px)"}, {opacity: 1, transform: "translateY(0)"}], {duration: 420, easing: "ease-out"}),
    ...(hasReturn ? [motion($("gold"), [{color: "#fff8c9", textShadow: "0 0 22px #eebc6388"}, {color: "#efcf89", textShadow: "0 0 0px transparent"}], {duration: 1000})] : []),
  ]);
}


function totalDraft() {
  return Object.values(draft).reduce((sum, value) => sum + BigInt(value), 0n);
}
function announce(message: string, error = false) {
  announcement = message;
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
}
function updateHighlight() {
  const ids = hoverTarget
    ? [hoverTarget]
    : Object.keys(draft).filter(
        (id) => TARGET_BY_ID.get(id)?.kind !== "number",
      );
  const coverage = new Set(
    ids.flatMap((id) => TARGET_BY_ID.get(id)?.coverage || []),
  );
  document
    .querySelectorAll<HTMLElement>(".number-target")
    .forEach((el) =>
      el.classList.toggle(
        "covered",
        coverage.has(Number(el.dataset.target!.slice(1))),
      ),
    );
}
function render() {
  if (!state) return;
  $("gold").textContent = formatGold(state.gold);
  $("gold").classList.toggle("long-gold", state.gold.length > 12);
  $("best-gold").textContent = `${formatGold(state.bestGold)} G`;
  $("best-gold").classList.toggle("long-record", state.bestGold.length > 12);
  $("game").classList.toggle(
    "vast-balance",
    state.gold.length > 12 || state.bestGold.length > 12,
  );
  $("draft-total").textContent = `${formatGold(totalDraft())} G`;
  $("available").textContent =
    `${formatGold(BigInt(state.gold) - totalDraft())} G`;
  $("draft-count").textContent = Object.keys(draft).length.toString();
  const eligible =
    Object.keys(draft).length === 1 && !!draft[`n${state.jackpotNumber}`];
  document
    .querySelectorAll<HTMLButtonElement>("[data-target]")
    .forEach((button) => {
      const id = button.dataset.target!;
      const target = TARGET_BY_ID.get(id)!;
      const placed = draft[id] || "0";
      const isNumber = target.kind === "number";
      const marked = isNumber && target.coverage[0] === state!.jackpotNumber;
      const probability = target.coverage.reduce(
        (sum, n) => sum + state!.probabilities[n - 1],
        0,
      );
      button.disabled = busy || !!pending || state!.gold === "0";
      button.classList.toggle("wagered", placed !== "0");
      button.classList.toggle("marked", marked);
      button.setAttribute("aria-pressed", String(placed !== "0"));
      button.setAttribute(
        "aria-label",
        `${target.label}, covers ${target.coverage.join(", ")}, ${percent(probability)} probability, return ${target.multiplier} times${marked ? ", Jackpot 24 times when wagered alone" : ""}, wager ${placed} Gold`,
      );
      if (isNumber) {
        button.innerHTML = `${marked ? '<span class="jackpot-marker" title="Jackpot ×24 when wagered alone">×24</span>' : ""}<span class="number">${target.coverage[0]}</span><span class="probability" title="Chance to roll">${percent(probability)}</span>${placed !== "0" ? coinStack(placed) : ""}`;
      } else {
        const name = target.kind === "color"
          ? target.label
          : target.coverage.join(" · ");
        button.innerHTML = `<span class="group-title"><span>${name}</span><b>×${target.multiplier}</b></span><span class="group-odds">${percent(probability)}</span>${placed !== "0" ? coinStack(placed) : ""}`;
      }
    });
  $("jackpot-line").classList.toggle("eligible", eligible);
  $("jackpot-text").innerHTML = eligible
    ? `<b><span class="jackpot-number">${state.jackpotNumber}</span> Jackpot ×24</b><span>You’re in. Make it count.</span>`
    : `<b><span class="jackpot-number">${state.jackpotNumber}</span> Jackpot ×24</b><span>Bet on ${state.jackpotNumber} only to qualify.</span>`;
  for (const id of [
    "shake",
    "increase",
    "decrease",
    "clear-draft",
    "edit-draft",
  ])
    $<HTMLButtonElement>(id).disabled = busy || !!pending;
  $<HTMLInputElement>("bet-amount").disabled = busy || !!pending;
  $<HTMLButtonElement>("roll").disabled =
    busy || !!pending || totalDraft() === 0n;
  $<HTMLButtonElement>("save-nickname").disabled = busy || !!pending;
  $("roll").querySelector("span")!.textContent = busy ? actionPhase || "Saving…" : "Roll dice";
  document.querySelectorAll<HTMLButtonElement>("[data-amount]").forEach(button => {
    button.disabled = busy || !!pending;
    button.setAttribute("aria-pressed", String(button.dataset.amount === amount));
  });
  $("restart").hidden = state.gold !== "0";
  $<HTMLButtonElement>("restart").disabled = busy || !!pending;
  $("retry").hidden = !pending || busy;
  $("your-nickname").textContent = `${state.nickname} · you`;
  $("your-best").textContent = `${formatGold(state.bestGold)} G`;
  renderDraft();
  updateHighlight();
}
function renderDraft() {
  $("draft-rows").innerHTML =
    Object.entries(draft)
      .map(
        ([id, value]) =>
          `<div class="draft-row"><span>${TARGET_BY_ID.get(id)!.label}</span><strong>${formatGold(value)} G</strong><button data-reduce="${id}" aria-label="Reduce ${TARGET_BY_ID.get(id)!.label} wager by ${amount} Gold" ${busy || pending ? "disabled" : ""}>−</button><button data-remove="${id}" aria-label="Remove ${TARGET_BY_ID.get(id)!.label} wager" ${busy || pending ? "disabled" : ""}>Remove</button></div>`,
      )
      .join("") || "<p>No wagers yet. Tap any target to begin.</p>";
}
function readAmount(): bigint | null {
  const value = $<HTMLInputElement>("bet-amount").value.trim();
  if (!/^\d+$/.test(value) || BigInt(value) < BigInt(CONFIG.minimumWager)) {
    announce("Enter a whole bet amount of at least 1 G.", true);
    $<HTMLInputElement>("bet-amount").setAttribute("aria-invalid", "true");
    return null;
  }
  amount = BigInt(value).toString();
  $<HTMLInputElement>("bet-amount").removeAttribute("aria-invalid");
  return BigInt(amount);
}
function addBet(id: string) {
  if (!state || busy || pending) return;
  const value = readAmount();
  if (value === null) return;
  if (value + totalDraft() > BigInt(state.gold)) {
    announce(
      `Only ${formatGold(BigInt(state.gold) - totalDraft())} G is available. Lower the bet amount or edit your wagers.`,
      true,
    );
    return;
  }
  clearResult();
  draft[id] = ((draft[id] ? BigInt(draft[id]) : 0n) + value).toString();
  if (draft[id].length > 12) {
    $("draft-tray").hidden = false;
    $("edit-draft").setAttribute("aria-expanded", "true");
  }
  announce("");
  playTone("chip");
  render();
  const stack = targetElement(id).querySelector<HTMLElement>(".coin-stack")!;
  void motion(stack, [{transform: "translateY(-18px) rotate(-12deg)", opacity: .2}, {transform: "translateY(3px) rotate(3deg)", opacity: 1, offset: .65}, {transform: "translateY(0) rotate(0)"}], {duration: 330, easing: "ease-out"});
}

function cancelBet(id: string) {
  if (!state || busy || pending || !draft[id]) return;
  delete draft[id];
  announce("");
  render();
}

function playTone(kind: "chip" | "roll" | "win" | "jackpot") {
  if (!sound) return;
  try {
    audioContext ||= new AudioContext();
    void audioContext.resume();
    const notes =
      kind === "jackpot"
        ? [523, 659, 784, 1047]
        : kind === "win"
          ? [440, 659]
          : [kind === "chip" ? 520 : 160];
    notes.forEach((frequency, i) => {
      const osc = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      const start = audioContext!.currentTime + i * 0.09;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
      osc.connect(gain);
      gain.connect(audioContext!.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  } catch {
    /* Audio support is optional; settlement never depends on sound. */
  }
}

function announceRoll(result: Settlement) {
  $("roll-announcement").textContent =
    `Rolled ${result.outcome}. ${result.jackpot ? "Jackpot. " : ""}Return ${formatGold(result.totalReturn)} Gold. Net ${signed(result.net)} Gold.`;
}
async function getState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load your game.");
  return (await response.json()) as PlayerState;
}
async function refreshLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const leaders: Leader[] = await response.json();
    $("leaders").innerHTML = leaders
      .map(
        (leader) =>
          `<li class="${leader.id === state?.id ? "you" : ""}"><span class="rank">${String(leader.rank).padStart(2, "0")}</span><span class="leader-name">${escape(leader.nickname)}${leader.id === state?.id ? "<small>YOU</small>" : ""}</span><strong>${formatGold(leader.bestGold)}<small> G</small></strong></li>`,
      )
      .join("");
  } catch {
    $("leaders").innerHTML =
      "<li>Leaderboard unavailable. Retrying shortly.</li>";
  }
}
function savePending(value: ActionRequest | null) {
  pending = value;
  if (value)
    sessionStorage.setItem("one-of-six-pending", JSON.stringify(value));
  else sessionStorage.removeItem("one-of-six-pending");
}
async function perform(action?: Action) {
  if (!state || busy) return;
  if (action && pending) return;
  if (action)
    savePending({
      requestId: crypto.randomUUID(),
      revision: state.revision,
      action,
    });
  if (!pending) return;
  const request = pending;
  busy = true;
  actionPhase = request.action.kind === "roll" ? "Rolling…" : request.action.kind === "shake" ? "Shaking…" : "Saving…";
  if (request.action.kind !== "nickname") clearResult();
  if (request.action.kind === "roll" || request.action.kind === "shake") {
    $("table-status").textContent = request.action.kind === "roll" ? "No more bets" : "Fresh odds coming";
  }
  announce("");
  render();
  try {
    const response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status < 500) {
        savePending(null);
        if (payload.state) {
          state = payload.state;
          draft = {};
          setDie(1);
        }
      }
      throw new Error(
        payload.error || "The server could not confirm this action.",
      );
    }
    const data = payload as ActionResponse;
    // Settlement is already committed. This animation only presents its stored outcome.
    if (data.result) {
      playTone("roll");
      await rollDie(data.result.outcome);
      actionPhase = "Settling…";
      $("roll").querySelector("span")!.textContent = actionPhase;
      await revealResult(data.result, request.action.kind === "roll" ? request.action.wagers : {}, data.state.gold);
      if (data.result.jackpot) announce("Jackpot! Fresh odds are on the table.");
    } else if (request.action.kind === "shake") {
      playTone("roll");
      await rollDie(1, true);
      $("table-status").textContent = "Fresh odds. Your call.";
    } else if (request.action.kind === "restart") {
      amount = CONFIG.selectedWager;
      $<HTMLInputElement>("bet-amount").value = amount;
      announce("");
      setDie(1);
    } else {
      $("nickname-status").textContent = "Name saved.";
    }
    state = data.state;
    if (request.action.kind !== "nickname") {
      draft = {};
      $("draft-tray").hidden = true;
      $("edit-draft").setAttribute("aria-expanded", "false");
    }
    savePending(null);
    networkError = false;
    // A replay can describe an older revision when another tab has since acted.
    const current = await getState().catch(() => null);
    if (
      current &&
      (current.id !== state.id ||
        BigInt(current.revision) > BigInt(state.revision))
    ) {
      state = current;
      draft = {};
      clearResult();
      setDie(1);
      announce(
        "Another tab has updated the game. The latest saved board is shown.",
      );
    }
    void refreshLeaderboard();
  } catch (error) {
    $("table-status").textContent = pending ? "Waiting to reconnect" : "Place your bets";
    const message =
      error instanceof Error ? error.message : "Connection interrupted.";
    announce(
      pending
        ? `${message} Your action is saved. Retry to recover the same result.`
        : message,
      true,
    );
    if (request.action.kind === "nickname")
      $("nickname-status").textContent = message;
  } finally {
    busy = false;
    actionPhase = "";
    render();
  }
}

app.addEventListener("contextmenu", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-target]");
  if (!target) return;
  event.preventDefault();
  cancelBet(target.dataset.target!);
});

app.addEventListener("click", (event) => {
  const element = event.target as HTMLElement;
  const target = element.closest<HTMLElement>("[data-target]");
  if (target) addBet(target.dataset.target!);
  const remove = element.closest<HTMLElement>("[data-remove]");
  const reduce = element.closest<HTMLElement>("[data-reduce]");
  if ((remove || reduce) && !busy && !pending) {
    const id = remove?.dataset.remove || reduce!.dataset.reduce!;
    const value = remove ? 0n : BigInt(draft[id]) - (readAmount() || 0n);
    if (value <= 0n) delete draft[id];
    else draft[id] = value.toString();
    render();
    if (!$("draft-tray").querySelector(`[data-reduce="${id}"]`))
      $("edit-draft").focus();
    else
      $("draft-tray")
        .querySelector<HTMLButtonElement>(`[data-reduce="${id}"]`)!
        .focus();
  }
  const denomination = element.closest<HTMLElement>("[data-amount]");
  if (denomination && !busy && !pending) {
    amount = denomination.dataset.amount!;
    $<HTMLInputElement>("bet-amount").value = amount;
    $<HTMLInputElement>("bet-amount").removeAttribute("aria-invalid");
    render();
    playTone("chip");
  }
  const close = element.closest<HTMLElement>("[data-close]");
  if (close) $<HTMLDialogElement>(close.dataset.close!).close();
});
for (const eventName of ["pointerover", "focusin"])
  app.addEventListener(eventName, (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-target]",
    );
    if (target) {
      hoverTarget = target.dataset.target!;
      updateHighlight();
    }
  });
for (const eventName of ["pointerout", "focusout"])
  app.addEventListener(eventName, (event) => {
    const target = (event.target as HTMLElement).closest("[data-target]");
    const next = (event as FocusEvent).relatedTarget as HTMLElement | null;
    if (target && !target.contains(next)) {
      hoverTarget = null;
      updateHighlight();
    }
  });
$("roll").addEventListener("click", () => {
  if (totalDraft() > 0n) void perform({ kind: "roll", wagers: { ...draft } });
});
$("shake").addEventListener("click", () => void perform({ kind: "shake" }));
$("restart").addEventListener("click", () => void perform({ kind: "restart" }));
$("retry").addEventListener("click", () => void perform());
$("clear-draft").addEventListener("click", () => {
  if (!busy && !pending) {
    draft = {};
    announce("");
    render();
  }
});
$("edit-draft").addEventListener("click", () => {
  $("draft-tray").hidden = !$("draft-tray").hidden;
  $("edit-draft").setAttribute(
    "aria-expanded",
    String(!$("draft-tray").hidden),
  );
  if (!$("draft-tray").hidden) $("close-draft").focus({preventScroll: true});
});
$("close-draft").addEventListener("click", () => {
  $("draft-tray").hidden = true;
  $("edit-draft").setAttribute("aria-expanded", "false");
  $("edit-draft").focus();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("draft-tray").hidden) $("close-draft").click();
});
for (const [id, step] of [
  ["increase", 5n],
  ["decrease", -5n],
] as const)
  $(id).addEventListener("click", () => {
    const value = readAmount();
    if (value !== null) {
      amount = (value + step < 1n ? 1n : value + step).toString();
      $<HTMLInputElement>("bet-amount").value = amount;
      render();
    }
  });
$("bet-amount").addEventListener("change", () => {
  readAmount();
  render();
});
function openLeaderboard() {
  $<HTMLDialogElement>("leaderboard-dialog").showModal();
  $("leaderboard-open").setAttribute("aria-expanded", "true");
  void refreshLeaderboard();
}
$("leaderboard-open").addEventListener("click", openLeaderboard);
$("leaderboard-dialog").addEventListener("close", () =>
  $("leaderboard-open").setAttribute("aria-expanded", "false"),
);
$("settings-open").addEventListener("click", () => {
  $<HTMLInputElement>("nickname").value = state?.nickname || "";
  $("nickname-status").textContent = "";
  $<HTMLDialogElement>("settings-dialog").showModal();
});
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (
        e.clientX < bounds.left ||
        e.clientX > bounds.right ||
        e.clientY < bounds.top ||
        e.clientY > bounds.bottom
      )
        dialog.close();
    }
  }),
);
$("nickname-form").addEventListener("submit", (e) => {
  e.preventDefault();
  void perform({
    kind: "nickname",
    nickname: $<HTMLInputElement>("nickname").value,
  });
});
$("sound").addEventListener("change", () => {
  sound = $<HTMLInputElement>("sound").checked;
  localStorage.setItem("one-of-six-sound", sound ? "on" : "off");
  playTone("chip");
});
$("motion").addEventListener("change", () => {
  manualReducedMotion = $<HTMLInputElement>("motion").checked;
  localStorage.setItem(
    "one-of-six-motion",
    manualReducedMotion ? "reduce" : "normal",
  );
  document.documentElement.classList.toggle(
    "reduce-motion",
    manualReducedMotion,
  );
  if (shouldReduceMotion()) stopMotion();
  $<HTMLInputElement>("motion").checked = shouldReduceMotion();
});
reducedMotion.addEventListener("change", () => {
  if (shouldReduceMotion()) stopMotion();
  $<HTMLInputElement>("motion").checked = shouldReduceMotion();
});
document.addEventListener("keydown", (event) => {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    document.querySelector("dialog[open]") ||
    (event.target as HTMLElement).matches("input,textarea,select,button")
  )
    return;
  if (event.key.toLowerCase() === "r") $("roll").click();
  if (event.key.toLowerCase() === "s") $("shake").click();
});

async function sync() {
  if (!state) {
    await initialize();
    return;
  }
  if (busy || pending || document.visibilityState === "hidden") return;
  try {
    const latest = await getState();
    // A response initiated before a local action must never overwrite that action.
    if (busy || pending) return;
    if (
      !state ||
      latest.id !== state.id ||
      BigInt(latest.revision) > BigInt(state.revision)
    ) {
      const existed = !!state;
      state = latest;
      draft = {};
      clearResult();
      setDie(1);
      render();
      if (existed)
        announce(
          "This game changed in another tab. Draft cleared; review the new board.",
        );
    }
    if (networkError) {
      networkError = false;
      announce("Connected. Your saved game is ready.");
    }
  } catch {
    networkError = true;
    if (!announcement)
      announce(
        "Connection unavailable. Reconnecting to your saved game…",
        true,
      );
  }
  if ($<HTMLDialogElement>("leaderboard-dialog").open)
    void refreshLeaderboard();
}
async function initialize() {
  try {
    state = await getState();
    setDie(1);
    render();
    void refreshLeaderboard();
    if (pending) {
      announce("Recovering your last saved action…");
      await perform();
    }
  } catch {
    networkError = true;
    announce(
      "Could not connect. Start the local server; this page will retry automatically.",
      true,
    );
  }
}
void initialize();
setInterval(() => void sync(), CONFIG.syncIntervalMs);
window.addEventListener("focus", () => void sync());
