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
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 1.8-2.5 3.5M12 16h.01"/>',
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
let sound = localStorage.getItem("one-of-six-sound") !== "off";
let showProbabilities = localStorage.getItem("sixfold-show-probabilities") === "on";
type ChipPose = { x: number; y: number; rotation: number; tone: number };
const chipPoses = new Map<string, ChipPose[]>();
let audioContext: AudioContext | undefined;
const audioSources = new Set<AudioScheduledSourceNode>();
let previousRank: number | undefined;
let announcement = "";
let networkError = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let manualReducedMotion =
  localStorage.getItem("one-of-six-motion") === "reduce";
const shouldReduceMotion = () => reducedMotion.matches || manualReducedMotion;
document.documentElement.classList.toggle("reduce-motion", manualReducedMotion);
try {
  pending = JSON.parse(sessionStorage.getItem("sixfold-100-rolls-pending") || "null");
} catch {
  sessionStorage.removeItem("sixfold-100-rolls-pending");
}

const transferRange = (level: number) => {
  const { min, max } = CONFIG.transferRates[level - 1];
  return `${percent(min)}–${percent(max)}`;
};
const exampleRate = (CONFIG.transferRates[1].min + CONFIG.transferRates[1].max) / 2;
const exampleTransfer = exampleRate * (0.4 - CONFIG.probabilityFloor);
const oddsGuide = `
  <h3>Every board is different</h3>
  <p>A fresh board draws a new random set of hidden odds. Every number keeps at least a <b>2% chance</b>, but some can be much more likely than others. Red and Black are not necessarily a 50–50 bet.</p>
  <h3 class="tilt-guide" tabindex="-1">Read the Tilt</h3>
  <p><b>Tilt runs from 1 to 6.</b> It describes how uneven the whole board is. Tap the Tilt number on the table to return to this explanation.</p>
  <p><b>Low Tilt · levels 1–2.</b> The chances are more evenly spread across the six numbers, though they are not necessarily equal. A few repeats can still happen by chance. Payouts change these boards gently, giving you more time to observe them.</p>
  <p><b>High Tilt · levels 5–6.</b> More of the chance is concentrated on fewer numbers, so some faces are much more likely than others. Tilt does not reveal which ones. Payouts change these boards a little faster, but the gentler pace gives you time to try a pattern.</p>
  <p><b>Levels 3–4 are in between.</b> Combine the level with the results you see, and keep observing after payouts. High Tilt does not guarantee a better bet, and low Tilt does not make every bet fair.</p>
  <h3>Payouts change the odds</h3>
  <p>After a payout other than a Jackpot, the rolled number gives up a random share of its probability above the <b>2% minimum</b>. The transfer rate rises with the Tilt shown before the roll: <b>${transferRange(1)} at level 1, up to ${transferRange(6)} at level 6</b>. The other five numbers receive random shares of that amount.</p>
  <p>One transfer happens per paying roll, regardless of wager size or how many bets pay. Even on a high-Tilt board, a rare number has little probability to give away. Tilt can rise, fall, or stay at the same level; faster changes do not guarantee that it falls.</p>
  <details class="odds-example"><summary>See one possible change</summary><p>On a Tilt 2 board, the transfer rate is ${transferRange(2)}. A number at 40% has 38 percentage points above the minimum. If this roll transfers ${percent(exampleRate)} of that surplus, the number falls to ${percent(0.4 - exampleTransfer)}. The other five share the ${(exampleTransfer * 100).toFixed(2)} percentage points randomly. The next payout draws a new rate and new shares. This happens even when your total return leaves the roll at break-even or a net loss. If no wager pays, the odds stay the same. A Jackpot instead brings in a fresh die and a new board.</p></details>
  <h3>Earn your next Shake</h3>
  <p><b>Shake</b> costs no Gold, but a roll must first change your settled bankroll: any gain or loss counts, even 1 G. A break-even roll does not count. Betting 10 G on all six numbers returns 60 G and does not unlock Shake. Editing bets does not count either.</p>
  <p>Once unlocked, Shake stays available until you use it. It draws fresh odds, clears your bets, and locks again. A new game or a Jackpot’s automatic Shake also starts locked. Start with small bets and use the Tilt and results to decide whether to keep exploring the board.</p>
`;

app.innerHTML = `
  <div class="workspace">
    <main id="game" aria-label="${CONFIG.title} game">
      <aside class="sidebar" aria-label="Your game">
        <header class="header"><a class="wordmark" href="/" aria-label="${CONFIG.title} home">${icon("dice")}${CONFIG.title}<span>PLAY THE ODDS</span></a></header>
        <section class="stat-card bankroll" aria-label="Your Gold">
          <div class="balance"><span class="eyebrow">Bankroll</span><div class="balance-value"><span id="gold">—</span><span class="gold-unit">G</span></div></div>
        </section>
        <section class="stat-card remaining-rolls" aria-labelledby="rolls-label"><span id="rolls-label" class="eyebrow">Rolls remaining</span><strong id="rolls-remaining" class="rolls-value" aria-live="polite">${CONFIG.rollsPerRun}</strong></section>
        <section class="stat-card table-wager" aria-label="On the table"><span class="eyebrow">On the table</span><strong id="draft-total" class="wager-value">0 G</strong></section>
        <div class="sidebar-bottom"><div class="header-actions"><button id="leaderboard-open" class="utility-button" aria-label="Open leaderboard" aria-expanded="false">${icon("trophy")}<span>Leaderboard</span></button><button id="guide-open" class="utility-button" aria-label="How to play">${icon("help")}<span>How to play</span></button><button id="settings-open" class="utility-button" aria-label="Settings">${icon("settings")}<span>Settings</span></button></div><span class="play-note">Play Gold only</span></div>
      </aside>
      <div class="playfield">
        <section class="table-area" aria-label="Betting table">
          <div class="felt">
            <section class="stage" aria-label="Die and result">
              <div class="table-heading"><button id="tilt-info" class="board-tilt" aria-label="About board Tilt" aria-haspopup="dialog" aria-controls="welcome-dialog"><strong id="tilt-level">—</strong><span class="tilt-copy"><span class="tilt-name">Tilt</span><span class="tilt-help">Guide ${icon("chevron")}</span></span></button><span id="table-status">Place your bets</span></div>
              <div class="die-area"><div id="die-shadow" class="die-shadow"></div><div id="die-mover" class="die-mover"><div id="die" class="die" role="img" aria-label="Die, ready to roll"></div></div><div id="landing-ring" class="landing-ring"></div></div>
              <div id="result-display" class="result-display" aria-hidden="true"><span class="result-label">ONE ROLL. SIX POSSIBILITIES.</span><strong class="result-value">Good luck.</strong><span class="result-detail">Every number has its odds.</span></div>
            </section>
            <div id="board" class="board"></div>
            <div class="color-bets" id="color-bets"></div>
            <div class="table-footer"><span>NUMBER ×6 <i>·</i> COLUMN ×3 <i>·</i> ROW & COLOR ×2</span><span>PLAY GOLD ONLY</span></div>
          </div>
        </section>
        <section class="betting-controls" aria-label="Wager controls">
          <div class="chip-controls"><label class="control-label" for="bet-amount">Bet amount</label><div class="amount-selector"><button id="decrease" aria-label="Decrease bet by 5 Gold">−</button><input id="bet-amount" type="text" role="spinbutton" inputmode="numeric" pattern="[0-9]*" value="${CONFIG.selectedWager}" aria-valuemin="1" aria-valuenow="${CONFIG.selectedWager}" aria-label="Bet amount in Gold" aria-describedby="amount-hint" autocomplete="off" /><span>G</span><button id="increase" aria-label="Increase bet by 5 Gold">+</button></div><span id="amount-hint" class="amount-hint">Type an amount or ↑ ↓ by 5 G</span></div>
          <div class="actions"><button id="roll" class="roll-button" aria-keyshortcuts="r">${icon("dice")}<span>Roll dice</span><kbd>R</kbd></button><button id="shake" class="shake-button" aria-keyshortcuts="s" aria-describedby="shake-hint" disabled>${icon("shake")}<span>Shake</span><kbd>S</kbd></button></div>
          <p id="shake-hint" class="shake-hint">Shake unlocks after a roll changes your bankroll.</p>
          <p class="hint"><span class="pointer-hint">Click a space to bet · Click a chip to take it back</span><span class="touch-hint">Tap a space to bet · Tap a chip to take it back</span></p>
          <div class="messages"><p id="run-status" class="notice" role="status" hidden></p><p id="roll-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p><p id="notice" class="notice" role="status" aria-live="polite"></p><button id="retry" class="text-button" hidden>Retry saved action</button><button id="restart" class="restart-button" hidden>New run · 100 G</button></div>
        </section>
      </div>
      <aside id="leaderboard-rail" class="leaderboard-rail" aria-label="Leaderboard tower"></aside>
    </main>
  </div>
  <div id="effects" class="effects" aria-hidden="true"></div>
  <dialog id="leaderboard-dialog" class="leaderboard-dialog" aria-labelledby="leaderboard-title"><div id="leaderboard-content"><div class="tower-heading"><h2 id="leaderboard-title">Leaderboard</h2><button class="icon-button" data-close="leaderboard-dialog" aria-label="Close leaderboard">${icon("close")}</button></div><div class="tower-floors"><ol id="leaders" aria-label="Scores after 100 rolls"></ol></div></div></dialog>
  <dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="dialog-top"><div><h2 id="settings-title">Settings</h2></div><button class="icon-button" data-close="settings-dialog" aria-label="Close settings">${icon("close")}</button></div>
    <form id="nickname-form"><label for="nickname">Your leaderboard name</label><div class="nickname-row"><input id="nickname" maxlength="48" required autocomplete="nickname"/><button type="submit" id="save-nickname">Save</button></div><p id="nickname-status" role="status"></p></form>
    <label class="sound-control"><span>Sound effects</span><input id="sound" type="checkbox" role="switch" ${sound ? "checked" : ""}/></label>
    <label class="sound-control"><span>Reduce motion</span><input id="motion" type="checkbox" role="switch" ${shouldReduceMotion() ? "checked" : ""}/></label>
    <label class="sound-control"><span>Show probabilities (developer)</span><input id="show-probabilities" type="checkbox" role="switch" ${showProbabilities ? "checked" : ""}/></label>
    <button id="settings-guide" class="text-button">How to play ${icon("chevron")}</button>
    <div class="settings-restart"><button id="settings-restart" class="danger-button" aria-haspopup="dialog" aria-controls="restart-dialog" disabled>Restart run</button></div>
  </dialog>
  <dialog id="restart-dialog" class="restart-dialog" aria-labelledby="restart-title" aria-describedby="restart-description">
    <div class="dialog-top"><h2 id="restart-title">Restart this run?</h2></div>
    <p id="restart-description" class="dialog-intro">Your current progress and bets will be discarded. Start fresh with ${formatGold(CONFIG.startingGold)} G and ${CONFIG.rollsPerRun} rolls. Your completed leaderboard score stays.</p>
    <div class="confirm-actions"><button id="restart-cancel" class="cancel-button" data-close="restart-dialog" autofocus>Cancel</button><button id="restart-confirm" class="danger-button" disabled>Restart run</button></div>
  </dialog>
  <dialog id="welcome-dialog" class="welcome-dialog" aria-labelledby="welcome-title" aria-describedby="welcome-intro">
    <div class="dialog-top"><h2 id="welcome-title">How to play</h2><button class="icon-button" data-close="welcome-dialog" aria-label="Close gameplay guide">${icon("close")}</button></div>
    <p id="welcome-intro" class="dialog-intro">Each run starts with 100 G and lasts ${CONFIG.rollsPerRun} rolls. Your Gold after the final roll is your score.</p>
    <ol class="welcome-steps">
      <li><h3>Place your bets</h3><p>Type a whole amount, then tap a number, row, column, or color to add it. Tap again to add more. You can combine bets up to your available Gold. The + / − buttons and ↑ / ↓ keys in the amount control change your selected amount by 5 G, down to 1 G.</p><p>Tap or click a placed chip to take back that target’s entire wager. Right-clicking its target does the same. With a target focused, press <kbd>Delete</kbd> or <kbd>Backspace</kbd> to remove its wager. Add a smaller amount to reduce a bet. Editing a draft never spends Gold.</p></li>
      <li><h3>Roll & collect</h3><p><b>Roll</b> draws one outcome using the hidden odds. A number pays ×6, a column ×3, and a row or color ×2. All matching bets pay, including overlapping groups. Returns include your winning stake: a 10 G number bet returns 60 G, a 50 G gain if that was your only bet.</p></li>
    </ol>
    <div class="guide-odds">
      ${oddsGuide}
      <h3>The hidden Jackpot</h3><p>A sole wager on the least likely number pays <b>×24</b> only when that number’s chance is <b>at most 1 in 24</b> (about 4.17%). Its availability and target stay hidden. When the chance is higher, the number pays the ordinary ×6. A Jackpot hit automatically Shakes to a fresh board without using an extra roll. A 10 G Jackpot returns 240 G, a 230 G gain. The target is hidden; the lowest number breaks ties. Any other positive bet removes Jackpot eligibility, even if it covers that number too.</p>
      <h3>Make your 100 rolls count</h3><p>Every settled Roll counts, including losses and break-even bets. Shake keeps your Gold and does not use or restore rolls. Rolls and Shakes clear your draft. After roll 100, your final Gold posts to the leaderboard if it is your best completed run. Earlier peaks do not count. Betting and Shake then stop until you choose <b>New run</b>.</p><p>If you reach zero Gold before roll 100, the run ends without posting a score. You can start again with 100 G and 100 rolls. Your best completed score stays. There is no limit on new runs.</p><p>Gold, odds, and your roll count save automatically. A refresh resumes your board but clears uncommitted bets. Your browser identifies your player; keep its game cookie to return to the same record.</p>
      <h3>Keyboard controls</h3><p>Press <kbd>R</kbd> to roll and <kbd>S</kbd> to Shake, including just after placing a bet. Shortcuts pause while you type in a field or have a dialog open. Holding a key does not repeat an action. Use Tab to move between controls and Enter or Space to activate buttons.</p>
      <h3>Make yourself comfortable</h3><p>In <b>Settings</b>, choose a leaderboard name of 1–24 visible characters. <b>Sound effects</b> controls dice sounds, coin showers, and fanfares. <b>Reduce motion</b> skips dice movement and celebration effects; your system’s reduced-motion preference is respected too.</p><p><b>Show probabilities</b> is a developer option that reveals the hidden number and group odds. It changes the display only. Sound, motion, and probability visibility are remembered in this browser.</p>
    </div>
    <button id="welcome-start" class="roll-button">Let’s play ${icon("chevron")}</button><p class="welcome-footnote">Play Gold only · No real money</p>
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
async function rollDie(outcome: number) {
  if (shouldReduceMotion()) { setDie(outcome); return; }
  $("die").setAttribute("aria-label", "Die rolling");
  const duration = CONFIG.animationMs;
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
async function replaceDie() {
  if (shouldReduceMotion()) { setDie(1); return; }
  const mover = $("die-mover");
  const shadow = $("die-shadow");
  const area = mover.parentElement!;
  // Keep a decorative copy of the old die while the fresh one slides in.
  const outgoing = mover.cloneNode(true) as HTMLElement;
  const oldShadow = shadow.cloneNode(true) as HTMLElement;
  for (const copy of [outgoing, oldShadow]) {
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
    copy.setAttribute("aria-hidden", "true");
    copy.classList.add("departing-die");
    area.append(copy);
  }
  area.classList.add("is-replacing");
  setDie(1);
  $("die").setAttribute("aria-label", "Replacing the die");
  const duration = CONFIG.replacementMs;
  try {
    await Promise.all([
      motion(outgoing, [
        {transform: "translateX(0) scale(1)", opacity: 1},
        {transform: "translateX(-92px) scale(.8)", opacity: 0, offset: .48},
        {transform: "translateX(-92px) scale(.8)", opacity: 0},
      ], {duration, easing: "ease-in-out"}),
      motion(mover, [
        {transform: "translate(92px,-8px) scale(.85)", opacity: 0},
        {transform: "translate(92px,-8px) scale(.85)", opacity: 0, offset: .3},
        {transform: "translate(0,2px) scale(1.02)", opacity: 1, offset: .85},
        {transform: "translate(0,0) scale(1)", opacity: 1},
      ], {duration, easing: "ease-out"}),
      motion(oldShadow, [
        {transform: "translateX(0) scale(1)", opacity: .4},
        {transform: "translateX(-92px) scale(.6)", opacity: 0, offset: .48},
        {transform: "translateX(-92px) scale(.6)", opacity: 0},
      ], {duration, easing: "ease-in-out"}),
      motion(shadow, [
        {transform: "translateX(92px) scale(.6)", opacity: 0},
        {transform: "translateX(92px) scale(.6)", opacity: 0, offset: .3},
        {transform: "translateX(0) scale(1)", opacity: .4},
      ], {duration, easing: "ease-out"}),
    ]);
  } finally {
    outgoing.remove();
    oldShadow.remove();
    area.classList.remove("is-replacing");
    setDie(1);
  }
  playTone("chip");
}
function compactGold(value: string) {
  if (value.length <= 5) return formatGold(value);
  const units = [[18, "Qi"], [15, "Q"], [12, "T"], [9, "B"], [6, "M"], [3, "K"]] as const;
  if (value.length > 21) return `${value[0]}.${value.slice(1, 3)}e${value.length - 1}`;
  const [power, suffix] = units.find(([power]) => value.length > power)!;
  const scaled = BigInt(value) * 10n / (10n ** BigInt(power));
  return `${scaled / 10n}${scaled % 10n ? `.${scaled % 10n}` : ""}${suffix}`;
}
function tossChip(id: string) {
  const poses = chipPoses.get(id) || [];
  // Decorative randomness stays local. Only the server samples game outcomes.
  poses.push({ x: 34 + Math.random() * 32, y: 36 + Math.random() * 28, rotation: -28 + Math.random() * 56, tone: Math.floor(Math.random() * 3) });
  chipPoses.set(id, poses.slice(-5));
}
function chipPile(id: string, value: string) {
  if (!chipPoses.has(id)) tossChip(id);
  const poses = chipPoses.get(id)!;
  const label = compactGold(value);
  return `<span class="chip-pile" aria-hidden="true">${poses.map((pose, i) => `<span class="table-chip chip-tone-${pose.tone}" style="--chip-x:${pose.x}%;--chip-y:${pose.y}%;--chip-turn:${pose.rotation}deg;z-index:${i}"><span class="chip-face ${label.length > 5 ? "compact-chip" : ""}">${i === poses.length - 1 ? label : "·"}</span></span>`).join("")}</span>`;
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
  const count = jackpot ? 28 : 16;
  return Promise.all(Array.from({length: count}, (_, i) => {
    const spark = document.createElement("span");
    spark.className = "reward-spark";
    spark.textContent = i % 3 === 0 ? "✦" : "·";
    spark.style.left = `${bounds.left + bounds.width / 2}px`;
    spark.style.top = `${bounds.top + bounds.height / 2}px`;
    $("effects").append(spark);
    const angle = i / count * Math.PI * 2;
    const distance = jackpot ? 130 + (i % 3) * 30 : 85 + (i % 3) * 18;
    return motion(spark, [
      {transform: "translate(-50%,-50%) scale(.4)", opacity: 0},
      {opacity: 1, offset: .15},
      {transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(1.1)`, opacity: 0},
    ], {duration: jackpot ? 1400 : 1100, easing: "ease-out"}).finally(() => spark.remove());
  })).then(() => {});
}
function celebrateWin(result: Settlement, nextGold: string) {
  if (shouldReduceMotion() || BigInt(result.net) <= 0n) return Promise.resolve();
  const bounds = document.querySelector(".table-area")!.getBoundingClientRect();
  const x = bounds.left + bounds.width / 2;
  const y = Math.max(140, Math.min(innerHeight - 150, bounds.top + bounds.height * .48));
  const duration = result.jackpot ? 2400 : 1900;
  const banner = document.createElement("div");
  banner.className = `win-banner ${result.jackpot ? "jackpot-win" : ""}`;
  banner.style.left = `${x}px`;
  banner.style.top = `${y}px`;
  const record = state!.rollsUsed + 1 === CONFIG.rollsPerRun
    && (!state!.hasCompletedRun || BigInt(nextGold) > BigInt(state!.bestGold));
  const big = BigInt(result.totalReturn) >= BigInt(result.stake) * 6n;
  banner.innerHTML = `<span>${record ? "NEW PERSONAL BEST" : "MAKE IT RAIN"}</span><h2>${result.jackpot ? "JACKPOT!" : big ? "BIG WIN!" : "YOU WIN!"}</h2><strong>+${compactGold(result.net)} <small>G</small></strong><p>${formatGold(result.totalReturn)} G returned</p>`;
  $("effects").append(banner);
  const particles = Array.from({length: result.jackpot ? 64 : 40}, (_, i) => {
    const coin = document.createElement("span");
    coin.className = i % 3 === 0 ? "win-confetti" : "shower-coin";
    coin.style.left = `${x}px`;
    coin.style.top = `${y}px`;
    coin.style.setProperty("--confetti-color", ["#f9d98a", "#d98c6b", "#eee7bd"][i % 3]);
    const dx = (Math.random() - .5) * Math.min(innerWidth * 1.2, 1100);
    const rise = -90 - Math.random() * 180;
    $("effects").append(coin);
    return motion(coin, [
      {transform: "translate(-50%,-50%) rotate(0) scale(.3)", opacity: 0},
      {transform: `translate(${dx * .5}px, ${rise}px) rotate(${i * 35}deg) scale(1)`, opacity: 1, offset: .36},
      {transform: `translate(${dx}px, ${innerHeight - y + 50}px) rotate(${i * 65 + 180}deg) scale(.75)`, opacity: 0},
    ], {duration: duration - 250, delay: i % 8 * 38, easing: "cubic-bezier(.18,.5,.5,1)"}).finally(() => coin.remove());
  });
  return Promise.all([
    ...particles,
    motion(banner, [
      {scale: ".4", opacity: 0, rotate: "-5deg"},
      {scale: "1.1", opacity: 1, rotate: "2deg", offset: .16},
      {scale: "1", opacity: 1, rotate: "0deg", offset: .27},
      {scale: "1.04", opacity: 1, offset: .8},
      {scale: "1.12", opacity: 0},
    ], {duration, easing: "ease-out"}).finally(() => banner.remove()),
  ]).then(() => {});
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
async function presentNewRun(next: PlayerState) {
  $("game").classList.add("is-restarting");
  $("run-status").hidden = true;
  $("table-status").textContent = "New run";
  $("rolls-remaining").textContent = String(CONFIG.rollsPerRun - next.rollsUsed);
  try {
    await Promise.all([
      replaceDie(),
      countBalance(BigInt(state!.gold), BigInt(next.gold)),
      ...Array.from(document.querySelectorAll<HTMLElement>(".stat-card")).map((card, i) =>
        motion(card, [
          { opacity: .35, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 600, delay: i * 80, easing: "ease-out" })),
    ]);
  } finally {
    $("game").classList.remove("is-restarting");
  }
}

async function revealResult(result: Settlement, wagers: Wagers, nextGold: string) {
  const hasReturn = BigInt(result.totalReturn) > 0n;
  targetElement(`n${result.outcome}`).classList.add("hit");
  Object.keys(wagers).forEach(id => targetElement(id).classList.add(result.paidTargets.includes(id) ? "paid" : "missed"));
  $("table-status").textContent = `Rolled ${result.outcome}`;
  $("result-display").className = `result-display ${hasReturn ? "won" : "lost"} ${result.jackpot ? "jackpot" : ""}`;
  $("result-display").innerHTML = `<span class="result-label">${result.jackpot ? "JACKPOT!" : hasReturn ? "RETURN" : "NO HIT THIS ROLL"}</span><strong class="result-value">${hasReturn ? `${formatGold(result.totalReturn)} G` : "Next roll."}</strong><span class="result-detail">${hasReturn ? `${signed(result.net)} G net${result.jackpot ? " · ×24" : ""}` : `−${formatGold(result.stake)} G`}</span>`;
  announceRoll(result);
  if (hasReturn) playTone(result.jackpot ? "jackpot" : BigInt(result.net) > 0n ? "win" : "chip");
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
    celebrateWin(result, nextGold),
    ...reveals,
    ...result.paidTargets.map(id => rewardBurst(targetElement(id), result.jackpot)),
    ...result.paidTargets.map(id => motion(targetElement(id), [
      {boxShadow: "inset 0 0 0 2px #ffe7a2, inset 0 0 55px #ffde6a66"},
      {boxShadow: "inset 0 0 0 2px #ffe7a288, inset 0 0 20px #ffde6a11"},
      {boxShadow: "inset 0 0 0 2px #ffe7a2, inset 0 0 40px #ffde6a44"},
    ], {duration: 700, easing: "ease-in-out"})),
    ...result.paidTargets.map(id => coinFlight(targetElement(id).querySelector<HTMLElement>(".table-chip:last-child") || targetElement(id), $("gold"), result.jackpot ? 20 : 10)),
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
const numberMeasure = document.createElement("canvas").getContext("2d")!;
function centerBoardNumbers() {
  document.querySelectorAll<SVGTextElement>(".number text").forEach(text => {
    const style = getComputedStyle(text);
    numberMeasure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    numberMeasure.textAlign = "center";
    // SVG getBBox includes the font's ascent/descent box for text, not its ink.
    // Actual glyph metrics also account for Georgia's descending 3, 4, and 5.
    const ink = numberMeasure.measureText(text.textContent || "");
    text.setAttribute("x", String(50 + (ink.actualBoundingBoxLeft - ink.actualBoundingBoxRight) / 2));
    text.setAttribute("y", String(50 + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2));
  });
}
void document.fonts.ready.then(centerBoardNumbers);
const runEnded = () => !!state && (state.rollsUsed >= CONFIG.rollsPerRun || state.gold === "0");
function render() {
  if (!state) return;
  $("gold").textContent = formatGold(state.gold);
  $("gold").classList.toggle("long-gold", state.gold.length > 12);
  $("rolls-remaining").textContent = String(CONFIG.rollsPerRun - state.rollsUsed);
  $("run-status").hidden = !runEnded();
  $("run-status").textContent = state.rollsUsed === CONFIG.rollsPerRun
    ? `Final score: ${formatGold(state.gold)} G.`
    : "Out of Gold. This run ended before 100 rolls; no score was posted.";
  if (runEnded() && !busy) {
    $("table-status").textContent = "Run complete";
    $("result-display").className = "result-display";
    $("result-display").innerHTML = `<span class="result-label">${state.rollsUsed === CONFIG.rollsPerRun ? "FINAL SCORE" : "OUT OF GOLD"}</span><strong class="result-value">${compactGold(state.gold)} G</strong><span class="result-detail">${state.rollsUsed === CONFIG.rollsPerRun ? "100 rolls complete" : "No score posted"}</span>`;
  }
  $("tilt-level").textContent = String(state.tiltLevel);
  $("tilt-info").setAttribute("aria-label", `Board Tilt, level ${state.tiltLevel} of 6. Open Tilt guide.`);
  $("draft-total").textContent = `${formatGold(totalDraft())} G`;
  $("draft-total").classList.toggle("long-gold", totalDraft().toString().length > 12);
  for (const id of chipPoses.keys()) if (!draft[id]) chipPoses.delete(id);
  document
    .querySelectorAll<HTMLButtonElement>("[data-target]")
    .forEach((button) => {
      const id = button.dataset.target!;
      const target = TARGET_BY_ID.get(id)!;
      const placed = draft[id] || "0";
      const isNumber = target.kind === "number";
      const probability = target.coverage.reduce(
        (sum, n) => sum + state!.probabilities[n - 1],
        0,
      );
      button.disabled = busy || !!pending || runEnded();
      button.classList.toggle("wagered", placed !== "0");
      if (placed !== "0") button.title = `${target.label} · ${formatGold(placed)} Gold wagered`;
      else button.removeAttribute("title");
      button.setAttribute("aria-pressed", String(placed !== "0"));
      button.setAttribute("aria-keyshortcuts", "Delete Backspace");
      button.setAttribute(
        "aria-label",
        `${target.label}, covers ${target.coverage.join(", ")}${showProbabilities ? `, ${percent(probability)} probability` : ""}, return ${target.multiplier} times, wager ${placed} Gold${placed !== "0" ? ". Press Delete to remove wager" : ""}`,
      );
      if (isNumber) {
        button.innerHTML = `<svg class="number" viewBox="0 0 100 100" aria-hidden="true"><text x="50" y="50" text-anchor="middle" fill="currentColor">${target.coverage[0]}</text></svg>${showProbabilities ? `<span class="probability">${percent(probability)}</span>` : ""}${placed !== "0" ? chipPile(id, placed) : ""}`;
      } else {
        const name = target.kind === "color"
          ? target.label
          : target.coverage.join(" · ");
        button.innerHTML = `<span class="group-title"><span>${name}</span><b>×${target.multiplier}</b></span>${showProbabilities ? `<span class="group-odds">${percent(probability)}</span>` : ""}${placed !== "0" ? chipPile(id, placed) : ""}`;
      }
    });
  for (const id of ["increase", "decrease"])
    $<HTMLButtonElement>(id).disabled = busy || !!pending || runEnded();
  $<HTMLButtonElement>("shake").disabled = busy || !!pending || runEnded() || !state.canShake;
  $("shake-hint").textContent = busy && pending?.action.kind === "shake"
    ? "Replacing the die and drawing fresh odds…"
    : runEnded()
    ? "Start a new run to play again."
    : state.canShake
    ? "Shake is ready. Fresh odds, same bankroll."
    : "Shake unlocks after a roll changes your bankroll.";
  $<HTMLInputElement>("bet-amount").disabled = busy || !!pending || runEnded();
  $<HTMLButtonElement>("roll").disabled =
    busy || !!pending || runEnded() || totalDraft() === 0n;
  $<HTMLButtonElement>("save-nickname").disabled = busy || !!pending;
  $("roll").querySelector("span")!.textContent = busy ? actionPhase || "Saving…" : "Roll dice";
  $("restart").hidden = !runEnded();
  for (const id of ["restart", "settings-restart", "restart-confirm"])
    $<HTMLButtonElement>(id).disabled = busy || !!pending;
  $("retry").hidden = !pending || busy;
  centerBoardNumbers();
  updateHighlight();
}
function readAmount(): bigint | null {
  const value = $<HTMLInputElement>("bet-amount").value.trim();
  if (!/^\d+$/.test(value) || BigInt(value) < BigInt(CONFIG.minimumWager)) {
    announce("Enter a whole bet amount of at least 1 G.", true);
    $<HTMLInputElement>("bet-amount").setAttribute("aria-invalid", "true");
    $("bet-amount").removeAttribute("aria-valuenow");
    $("bet-amount").removeAttribute("aria-valuetext");
    return null;
  }
  amount = BigInt(value).toString();
  $<HTMLInputElement>("bet-amount").removeAttribute("aria-invalid");
  $("bet-amount").setAttribute("aria-valuenow", amount);
  $("bet-amount").setAttribute("aria-valuetext", `${formatGold(amount)} Gold`);
  return BigInt(amount);
}
function addBet(id: string) {
  if (!state || busy || pending || runEnded()) return;
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
  tossChip(id);
  announce("");
  playTone("chip");
  render();
  const chip = targetElement(id).querySelector<HTMLElement>(".table-chip:last-child")!;
  void motion(chip, [{translate: "-8px -24px", scale: "1.12", opacity: .2}, {translate: "2px 2px", scale: ".98", opacity: 1, offset: .7}, {translate: "0 0", scale: "1"}], {duration: 330, easing: "ease-out"});
}

function cancelBet(id: string) {
  if (!state || busy || pending || !draft[id]) return;
  delete draft[id];
  announce("");
  render();
}

function stopSound() {
  audioSources.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } });
  audioSources.clear();
}
function playTone(kind: "chip" | "roll" | "win" | "jackpot") {
  if (!sound) return;
  try {
    audioContext ||= new AudioContext();
    void audioContext.resume();
    const context = audioContext;
    const track = (source: AudioScheduledSourceNode, gain: GainNode) => {
      audioSources.add(source);
      source.onended = () => { audioSources.delete(source); source.disconnect(); gain.disconnect(); };
    };
    const note = (frequency: number, delay: number, duration: number, volume: number, type: OscillatorType = "sine") => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .012);
      gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      osc.connect(gain); gain.connect(context.destination);
      track(osc, gain);
      osc.start(start); osc.stop(start + duration + .02);
    };
    if (kind === "chip" || kind === "roll") {
      note(kind === "chip" ? 920 : 140, 0, .16, .055, "triangle");
      if (kind === "chip") note(1380, .025, .1, .035);
      return;
    }
    const jackpot = kind === "jackpot";
    const melody = jackpot ? [523, 659, 784, 1047, 1319, 1568, 2093] : [523, 659, 784, 1047, 1319];
    melody.forEach((frequency, i) => {
      note(frequency, i * .085, .4, .085, "triangle");
      note(frequency * 2, i * .085, .28, .025);
    });
    // A low impact, bright final chord, and scattered metallic coin notes.
    note(98, 0, .45, .13, "triangle");
    [523, 659, 784, 1047].forEach(frequency => note(frequency, .5, jackpot ? 1.3 : .85, .045, "triangle"));
    for (let i = 0; i < (jackpot ? 16 : 10); i++)
      note(1500 + (i % 5) * 260, .22 + i * .07, .12, .035);
    const noise = context.createBuffer(1, Math.floor(context.sampleRate * .35), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noise; filter.type = "highpass"; filter.frequency.value = 4200;
    gain.gain.setValueAtTime(.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .35);
    source.connect(filter); filter.connect(gain); gain.connect(context.destination);
    track(source, gain);
    source.addEventListener("ended", () => filter.disconnect());
    source.start();
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
    const ownRank = leaders.find(leader => leader.id === state?.id)?.rank;
    $("leaders").innerHTML = leaders
      .map(
        (leader) =>
          `<li class="${leader.id === state?.id ? "you" : ""}" ${leader.id === state?.id ? 'aria-current="true"' : ""}><span class="rank">${String(leader.rank).padStart(2, "0")}</span><span class="leader-name">${escape(leader.nickname)}</span><strong>${formatGold(leader.bestGold)}<small> G</small></strong></li>`,
      )
      .join("");
    if (!leaders.length) $("leaders").innerHTML = '<li class="empty-floor">No scores yet.</li>';
    const ownFloor = $("leaders").querySelector<HTMLElement>(".you");
    if (ownFloor && ownRank && previousRank && ownRank < previousRank) {
      void motion(ownFloor, [{transform: "translateY(28px) scale(.94)", filter: "brightness(1.8)"}, {transform: "translateY(0) scale(1)", filter: "brightness(1)"}], {duration: 900, easing: "cubic-bezier(.2,.8,.2,1)"});
    }
    previousRank = ownRank;
  } catch {
    $("leaders").innerHTML =
      "<li>Leaderboard unavailable. Retrying shortly.</li>";
  }
}
function savePending(value: ActionRequest | null) {
  pending = value;
  if (value)
    sessionStorage.setItem("sixfold-100-rolls-pending", JSON.stringify(value));
  else sessionStorage.removeItem("sixfold-100-rolls-pending");
}
async function perform(action?: Action) {
  if (!state || busy) return;
  if (action && pending) return;
  if (action?.kind === "shake" && !state.canShake) return;
  if (action)
    savePending({
      // getRandomValues also works over plain HTTP on a local Wi-Fi network.
      requestId: Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
      revision: state.revision,
      action,
    });
  if (!pending) return;
  const request = pending;
  busy = true;
  actionPhase = request.action.kind === "roll" ? "Rolling…" : request.action.kind === "shake" ? "New die…" : request.action.kind === "restart" ? "New run…" : "Saving…";
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
      if (data.result.jackpot) {
        $("table-status").textContent = "A fresh die";
        await replaceDie();
        $("table-status").textContent = "Fresh odds. Your call.";
        announce("Jackpot! A fresh die and new odds are on the table.");
      }
    } else if (request.action.kind === "shake") {
      $("table-status").textContent = "Replacing the die";
      await replaceDie();
      $("table-status").textContent = "Fresh odds. Your call.";
      announce("A fresh die. New odds are on the table.");
    } else if (request.action.kind === "restart") {
      setAmount(CONFIG.selectedWager);
      await presentNewRun(data.state);
      announce("New run. 100 Gold and 100 rolls remaining.");
    } else {
      $("nickname-status").textContent = "Name saved.";
    }
    state = data.state;
    if (request.action.kind === "restart") $("table-status").textContent = "Place your bets";
    if (request.action.kind !== "nickname") draft = {};
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
  if (target) {
    if (element.closest(".table-chip")) cancelBet(target.dataset.target!);
    else addBet(target.dataset.target!);
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
function setAmount(value: string) {
  amount = value;
  $<HTMLInputElement>("bet-amount").value = amount;
  readAmount();
}
function adjustAmount(step: bigint) {
  if (busy || pending) return;
  const value = readAmount();
  if (value === null) return;
  const next = value + step < 1n ? 1n : value + step;
  setAmount(next.toString());
  announce("");
}
for (const [id, step] of [
  ["increase", 5n],
  ["decrease", -5n],
] as const)
  $(id).addEventListener("click", () => adjustAmount(step));
document.querySelector(".amount-selector")!.addEventListener("keydown", event => {
  const key = event as KeyboardEvent;
  if (key.ctrlKey || key.metaKey || key.altKey || !["ArrowUp", "ArrowDown"].includes(key.key)) return;
  key.preventDefault();
  adjustAmount(key.key === "ArrowUp" ? 5n : -5n);
});
$("bet-amount").addEventListener("change", () => {
  readAmount();
});
function openLeaderboard() {
  $<HTMLDialogElement>("leaderboard-dialog").showModal();
  $("leaderboard-open").setAttribute("aria-expanded", "true");
  void refreshLeaderboard();
}
const wideLeaderboard = matchMedia("(min-width: 1101px)");
function placeLeaderboard() {
  const dialog = $<HTMLDialogElement>("leaderboard-dialog");
  if (wideLeaderboard.matches) {
    if (dialog.open) dialog.close();
    $("leaderboard-rail").append($("leaderboard-content"));
  } else {
    dialog.append($("leaderboard-content"));
  }
}
wideLeaderboard.addEventListener("change", placeLeaderboard);
placeLeaderboard();
$("leaderboard-open").addEventListener("click", openLeaderboard);
$("leaderboard-dialog").addEventListener("close", () =>
  $("leaderboard-open").setAttribute("aria-expanded", "false"),
);
$("settings-open").addEventListener("click", () => {
  $<HTMLInputElement>("nickname").value = state?.nickname || "";
  $("nickname-status").textContent = "";
  $<HTMLDialogElement>("settings-dialog").showModal();
});
$("settings-restart").addEventListener("click", () => {
  if (!state || busy || pending) return;
  $<HTMLDialogElement>("restart-dialog").showModal();
});
$("restart-confirm").addEventListener("click", () => {
  if (!state || busy || pending) return;
  $<HTMLDialogElement>("restart-dialog").close();
  $<HTMLDialogElement>("settings-dialog").close();
  void perform({ kind: "restart" });
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
  if (sound) playTone("chip");
  else stopSound();
});
$("show-probabilities").addEventListener("change", () => {
  showProbabilities = $<HTMLInputElement>("show-probabilities").checked;
  localStorage.setItem("sixfold-show-probabilities", showProbabilities ? "on" : "off");
  render();
});
$("welcome-start").addEventListener("click", () => $<HTMLDialogElement>("welcome-dialog").close());
let guideReturnFocus = $("bet-amount");
function openGuide(trigger: HTMLElement, showTilt = false) {
  guideReturnFocus = trigger;
  $("welcome-intro").textContent = `You have ${formatGold(state?.gold || CONFIG.startingGold)} G to play with. Make a call and see where the die lands.`;
  const guide = $<HTMLDialogElement>("welcome-dialog");
  guide.showModal();
  if (showTilt) {
    const heading = guide.querySelector<HTMLElement>(".tilt-guide")!;
    heading.scrollIntoView({ block: "start" });
    heading.focus({ preventScroll: true });
  } else guide.scrollTop = 0;
}
$("guide-open").addEventListener("click", () => openGuide($("guide-open")));
$("settings-guide").addEventListener("click", () => {
  $<HTMLDialogElement>("settings-dialog").close();
  openGuide($("settings-open"));
});
$("tilt-info").addEventListener("click", () => openGuide($("tilt-info"), true));
$("welcome-dialog").addEventListener("close", () => {
  if (state) localStorage.setItem(`sixfold-guide-seen:${state.id}`, "yes");
  guideReturnFocus.focus({ preventScroll: true });
});
function showFirstGameGuide() {
  if (!state || pending) return;
  const key = `sixfold-guide-seen:${state.id}`;
  if (state.lastRoll) localStorage.setItem(key, "yes");
  if (!state.lastRoll && localStorage.getItem(key) !== "yes") {
    $("welcome-intro").textContent = `You have ${formatGold(state.gold)} G to play with. Make a call and see where the die lands.`;
    $<HTMLDialogElement>("welcome-dialog").showModal();
  }
}
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
  const target = event.target;
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    document.querySelector("dialog[open]") ||
    (target instanceof HTMLElement &&
      (target.closest("input,textarea,select") || target.isContentEditable))
  )
    return;
  if (event.key === "Delete" || event.key === "Backspace") {
    const bet = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-target]") : null;
    if (bet) {
      event.preventDefault();
      cancelBet(bet.dataset.target!);
    }
    return;
  }
  const action = { r: "roll", s: "shake" }[event.key.toLowerCase()];
  if (!action) return;
  const button = $<HTMLButtonElement>(action);
  if (button.disabled) return;
  event.preventDefault();
  button.click();
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
    showFirstGameGuide();
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
