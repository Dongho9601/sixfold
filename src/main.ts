import "./style.css";
import { BOARD, CONFIG, TARGET_BY_ID, TILT_LABELS, TUTORIAL_VERSION } from "./config";
import { guideBody, guideLanguages, guides, resolveGuideLanguage, type GuideLanguage } from "./guide";
import { guideExample, guideSlides, slideGuides } from "./guide-slides";
import type { Action, PlayerState, Settlement, Wagers } from "./types";
import { LocalGame, SAVE_KEY, StaleRunError } from "./save";
import { setupBetKeypad } from "./bet-keypad";
import { probabilityEntropy, tiltLevel } from "./game/rules";
import { distributionHint } from "./distribution-hint";
import { setupTutorial } from "./tutorial";
import { tutorialCopy } from "./tutorial-copy";
import { Tutorial } from "./game/tutorial";

const game = new LocalGame();

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
let recentAmounts = game.data.settings.recentAmounts;
let busy = false;
let actionPhase = "";
let activeAction: Action | undefined;
let hoverTarget: string | null = null;
let sound = game.data.settings.sound;
type ChipPose = { x: number; y: number; rotation: number; tone: number };
const chipPoses = new Map<string, ChipPose[]>();
let audioContext: AudioContext | undefined;
const audioSources = new Set<AudioScheduledSourceNode>();
let previousRank: number | undefined;
let announcement = "";
let tutorialSession: Tutorial | undefined;
let tutorialExit = false;
let tutorialReplay = false;
let tutorialSnapshot: { id: string; revision: string; draft: Wagers; amount: string; poses: Map<string, ChipPose[]>; status: string } | undefined;
let tutorialReturnFocus: HTMLElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mobileLayout = matchMedia("(max-width: 650px), (orientation: landscape) and (max-height: 500px) and (max-width: 1000px)");
let swapMobileActions = game.data.settings.swapMobileActions;
let manualReducedMotion = game.data.settings.reducedMotion;
const prefersReducedMotion = () => reducedMotion.matches || manualReducedMotion;
const shouldReduceMotion = () => document.hidden || prefersReducedMotion() || tutorialExit;
document.documentElement.classList.toggle("reduce-motion", manualReducedMotion);
let guideLanguage = (game.data.settings.guideLanguage as GuideLanguage | null) ?? resolveGuideLanguage(navigator.languages);

let settingsWrites = 0;
function saveSettings(patch: Parameters<LocalGame["updateSettings"]>[0]) {
  settingsWrites++;
  void game.updateSettings(patch).then(() => {
    settingsWrites--;
    if (!busy && !settingsWrites) syncSavedGame();
    showSaveWarning();
  });
}
function showSaveWarning() {
  $("save-notice").textContent = game.warning;
  $("save-notice").hidden = !game.warning;
}

app.innerHTML = `
  <div class="workspace">
    <main id="game" aria-label="${CONFIG.title} game">
      <aside class="sidebar" aria-label="Your game">
        <header class="header"><a class="wordmark" href="${import.meta.env.BASE_URL}" aria-label="${CONFIG.title} home">${icon("dice")}${CONFIG.title}</a></header>
        <section class="stat-card bankroll" aria-label="Your Gold">
          <span class="eyebrow">Bankroll</span><strong class="stat-value"><span id="gold" class="stat-number">—</span> <span class="gold-unit">G</span></strong>
        </section>
        <section class="stat-card remaining-rolls" aria-labelledby="rolls-label"><span id="rolls-label" class="eyebrow">Rolls remaining</span><strong class="stat-value"><span id="rolls-remaining" class="stat-number" aria-live="polite">${CONFIG.rollsPerRun}</span></strong></section>
        <section class="stat-card table-wager" aria-label="On the table"><span class="eyebrow">On the table</span><strong id="draft-total" class="stat-value"><span id="draft-gold" class="stat-number">0</span> <span class="gold-unit">G</span></strong></section>
        <div class="sidebar-bottom"><div class="header-actions"><button id="leaderboard-open" class="utility-button" aria-label="Open leaderboard" aria-expanded="false">${icon("trophy")}<span>Leaderboard</span></button><button id="guide-open" class="utility-button" aria-label="Help: how to play and tutorial" aria-haspopup="dialog" aria-controls="welcome-dialog">${icon("help")}<span>Help</span></button><button id="settings-open" class="utility-button" aria-label="Settings">${icon("settings")}<span>Settings</span></button></div><a class="site-information" href="${import.meta.env.BASE_URL}about.html">Rules, privacy &amp; credits</a></div>
      </aside>
      <div class="playfield">
        <section class="table-area" aria-label="Betting table">
          <div class="felt">
            <section class="stage" aria-label="Die and result">
              <div class="table-heading"><button id="tilt-info" class="board-tilt" aria-label="About board Tilt" aria-describedby="distribution-hint" aria-haspopup="dialog" aria-controls="welcome-dialog"><span class="tilt-title"><span id="tilt-number" class="tilt-number">Tilt —</span><span id="distribution-hint" class="distribution-hint" role="img"></span></span><span class="tilt-description"><strong id="tilt-level">—</strong><span id="tilt-change" aria-hidden="true">-</span></span></button><span id="table-status">Place your bets</span></div>
              <div class="die-area"><div id="die-shadow" class="die-shadow"></div><div id="die-mover" class="die-mover"><div id="die" class="die" role="img" aria-label="Die, ready to roll"></div></div><div id="landing-ring" class="landing-ring"></div></div>
              <div id="result-display" class="result-display"><span class="result-label">BOARD NET</span><strong id="board-net" class="result-value">0 G</strong><span class="result-detail">Winnings minus bets</span></div>
            </section>
            <div id="board" class="board"></div>
            <div class="color-bets" id="color-bets"></div>
            <div class="table-footer"><span>NUMBER ×6 <i>·</i> COLUMN ×3 <i>·</i> ROW & COLOR ×2</span></div>
          </div>
        </section>
        <section class="betting-controls" aria-label="Wager controls">
          <div class="chip-controls"><label class="control-label" for="bet-amount">Bet amount</label><div class="amount-row"><div class="amount-selector"><button id="decrease" aria-label="Decrease bet by 5 Gold" aria-keyshortcuts="w" title="Decrease bet by 5 Gold (W)">−</button><input id="bet-amount" type="text" role="spinbutton" inputmode="numeric" pattern="[0-9]*" value="${CONFIG.selectedWager}" aria-valuemin="1" aria-valuenow="${CONFIG.selectedWager}" aria-label="Bet amount in Gold" autocomplete="off" /><span>G</span><button id="increase" aria-label="Increase bet by 5 Gold" aria-keyshortcuts="e" title="Increase bet by 5 Gold (E)">+</button></div><div id="recent-amounts" class="recent-amounts" role="group" aria-label="Recently used bet amounts"></div></div></div>
          <div class="actions"><button id="roll" class="roll-button" aria-keyshortcuts="r">${icon("dice")}<span>Roll dice</span><kbd>R</kbd></button><button id="shake" class="shake-button" aria-keyshortcuts="Space" aria-describedby="shake-hint" disabled>${icon("shake")}<span>Shake</span><kbd>Space</kbd></button></div>
          <p id="shake-hint" class="shake-hint">Shake unlocks after a roll changes your bankroll.</p>
          <div class="messages"><p id="run-status" class="notice" role="status" hidden></p><p id="roll-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p><p id="notice" class="notice" role="status" aria-live="polite"></p><p id="save-notice" class="notice" role="status" hidden></p></div>
        </section>
      </div>
      <aside id="leaderboard-rail" class="leaderboard-rail" aria-label="Leaderboard tower"></aside>
    </main>
  </div>
  <div id="effects" class="effects" aria-hidden="true"></div>
  <dialog id="leaderboard-dialog" class="leaderboard-dialog" aria-labelledby="leaderboard-title"><div id="leaderboard-content"><div class="tower-heading"><h2 id="leaderboard-title">Personal records</h2><button class="icon-button" data-close="leaderboard-dialog" aria-label="Close leaderboard">${icon("close")}</button></div><p class="personal-records-note">Best 10 runs · stored in this browser</p><div class="tower-floors"><ol id="leaders" aria-label="Your best 10 completed runs stored in this browser"></ol><div id="leaderboard-unranked" class="leaderboard-unranked" hidden>Complete 100 rolls to set your first record.</div></div></div></dialog>
  <dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="dialog-top"><div><h2 id="settings-title">Settings</h2><p class="creator-credit"><a href="https://dongho9601.github.io/" target="_blank" rel="noopener noreferrer">dongho9601.github.io</a></p></div><button class="icon-button" data-close="settings-dialog" aria-label="Close settings">${icon("close")}</button></div>
    <form id="nickname-form"><label for="nickname">Your record name</label><div class="nickname-row"><input id="nickname" maxlength="48" required autocomplete="nickname"/><button type="submit" id="save-nickname">Save</button></div><p id="nickname-status" role="status"></p></form>
    <label class="sound-control"><span>Sound effects</span><input id="sound" type="checkbox" role="switch" ${sound ? "checked" : ""}/></label>
    <label class="sound-control"><span>Reduce motion</span><input id="motion" type="checkbox" role="switch" ${prefersReducedMotion() ? "checked" : ""}/></label>
    <label class="sound-control"><span>Swap Roll and Shake on mobile</span><input id="swap-mobile-actions" type="checkbox" role="switch" ${swapMobileActions ? "checked" : ""}/></label>
    <label class="sound-control"><span>Show probabilities</span><input id="show-probabilities" type="checkbox" role="switch" aria-describedby="probabilities-status" disabled/></label>
    <p id="probabilities-status" class="settings-note"></p>
    <div class="settings-restart"><button id="settings-restart" class="danger-button" aria-haspopup="dialog" aria-controls="restart-dialog" disabled>Restart run</button></div>
  </dialog>
  <dialog id="restart-dialog" class="restart-dialog" aria-labelledby="restart-title" aria-describedby="restart-description">
    <div class="dialog-top"><h2 id="restart-title">Restart this run?</h2></div>
    <p id="restart-description" class="dialog-intro">Your current progress and bets will be discarded. Start fresh with ${formatGold(CONFIG.startingGold)} G and ${CONFIG.rollsPerRun} rolls. Your personal records and settings stay.</p>
    <div class="confirm-actions"><button id="restart-cancel" class="cancel-button" data-close="restart-dialog" autofocus>Cancel</button><button id="restart-confirm" class="danger-button" disabled>Restart run</button></div>
  </dialog>
  <dialog id="probabilities-dialog" class="probabilities-dialog" aria-labelledby="probabilities-title" aria-describedby="probabilities-description">
    <div class="dialog-top"><h2 id="probabilities-title">Show probabilities?</h2></div>
    <p id="probabilities-description" class="dialog-intro">This reveals the odds for every bet. This run’s score will not enter personal records, even if you turn probabilities off later. Your existing personal records stay. Each new run starts with probabilities off.</p>
    <div class="confirm-actions"><button id="probabilities-cancel" class="cancel-button" data-close="probabilities-dialog" autofocus>Cancel</button><button id="probabilities-confirm" class="danger-button" disabled>Show probabilities</button></div>
  </dialog>
  <dialog id="run-dialog" class="run-dialog" aria-labelledby="run-title" aria-describedby="run-comparison">
    <span id="run-eyebrow" class="eyebrow">100 rolls complete</span>
    <div class="dialog-top"><h2 id="run-title">Run complete</h2></div>
    <div class="run-score"><span id="run-score-label" class="control-label">Final score</span><strong id="run-score"></strong></div>
    <p id="run-comparison" class="run-comparison"></p>
    <div id="run-best-row" class="run-best"><span>Personal best</span><strong id="run-best"></strong></div>
    <form id="run-form">
      <label for="run-nickname">Your record name</label>
      <input id="run-nickname" maxlength="48" required autocomplete="nickname" aria-describedby="run-error" autofocus />
      <p id="run-error" class="notice error" role="alert"></p>
      <button id="run-confirm" class="roll-button" type="submit">Confirm &amp; play again</button>
      <p class="run-next">100 G · 100 rolls</p>
    </form>
  </dialog>
  <dialog id="welcome-dialog" class="welcome-dialog" aria-labelledby="welcome-title">
    <div class="dialog-top"><h2 id="welcome-title"></h2><div class="guide-language"><label id="guide-language-label" class="sr-only" for="guide-language"></label><select id="guide-language">${guideLanguages.map(([code, name]) => `<option value="${code}" lang="${code}">${name}</option>`).join("")}</select></div><button class="icon-button" data-close="welcome-dialog">${icon("close")}</button></div>
    <span id="guide-step-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>
    <div id="guide-content"></div>
    <div id="guide-reference" hidden></div>
    <footer class="guide-footer"><nav class="guide-navigation"><button id="guide-previous" aria-controls="guide-content"></button><span id="guide-progress" aria-hidden="true"></span><button id="guide-next" aria-controls="guide-content"></button></nav><div class="guide-footer-actions"><button id="guide-rules" aria-controls="guide-reference" aria-expanded="false"></button><button id="tutorial-replay" aria-controls="tutorial-coach"></button><button id="welcome-start"></button></div></footer>
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

// All motion is decorative. The browser saves settlement before presentation begins.
const activeAnimations = new Set<Animation>();
const activeCounts = new Set<() => void>();
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
  activeCounts.forEach(finish => finish());
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
  // Decorative randomness is separate from Web Crypto game outcomes.
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
  $("table-status").textContent = "Place your bets";
}
function showBoardNet(gold = state!.gold, startingGold = state!.boardStartingGold) {
  const net = BigInt(gold) - BigInt(startingGold);
  const magnitude = net < 0n ? -net : net;
  const value = `${net === 0n ? "" : net > 0n ? "+" : "−"}${compactGold(magnitude.toString())} G`;
  $("board-net").textContent = value;
  $("board-net").title = `${signed(net.toString())} Gold`;
  $("board-net").setAttribute("aria-label", `Net income on this board: ${signed(net.toString())} Gold`);
  $("result-display").classList.toggle("won", net > 0n);
  $("result-display").classList.toggle("lost", net < 0n);
}
let displayedTilt: number | undefined;
let displayedTiltState: PlayerState | undefined;
let tiltChangeDescription = "";
function showDistributionHint(probabilities: readonly number[]) {
  const hint = $("distribution-hint");
  const { opacities, description } = distributionHint(probabilities);
  if (hint.getAttribute("aria-label") === description) return;
  const squares = opacities.map(opacity => {
    const square = document.createElement("span");
    square.className = "distribution-square";
    square.style.opacity = String(opacity);
    square.setAttribute("aria-hidden", "true");
    return square;
  });
  hint.replaceChildren(...squares);
  hint.setAttribute("aria-label", description);
}
function showTilt(level: number) {
  const label = TILT_LABELS[level - 1];
  const indicator = $("tilt-change");
  const current = state!;
  // Use Tilt's presentation state, which stays on the old die until reveal finishes.
  showDistributionHint(current.probabilities);
  const previous = displayedTiltState;
  const newRun = previous?.id !== current.id;
  const rolled = previous && !newRun && current.rollsUsed > previous.rollsUsed;
  const replacedDie = previous && !newRun && current.rollsUsed === previous.rollsUsed &&
    ((previous.canShake && !current.canShake) ||
      current.probabilities.some((probability, i) => probability !== previous.probabilities[i]));
  if (newRun) {
    displayedTilt = undefined;
  }
  if (newRun || rolled || replacedDie) {
    const result = rolled ? current.lastRoll : null;
    // A fresh die from Shake or Jackpot has no roll-driven bias change.
    const rollChangedThisDie = result && !result.jackpot &&
      current.probabilities.every((probability, i) => probability === result.probabilitiesAfter[i]);
    const beforeProbabilities = rollChangedThisDie ? result.probabilitiesBefore : current.probabilities;
    const beforeLevel = tiltLevel(beforeProbabilities);
    const entropyChange = probabilityEntropy(current.probabilities) - probabilityEntropy(beforeProbabilities);
    // Ignore floating-point noise, but retain changes within a single Tilt band.
    const tolerance = 8 * Number.EPSILON;
    const direction = entropyChange < -tolerance ? "increased" : entropyChange > tolerance ? "decreased" : null;
    indicator.textContent = direction === "increased" ? "▲" : direction === "decreased" ? "▼" : "-";
    tiltChangeDescription = direction
      ? ` Bias ${direction} (entropy ${direction === "increased" ? "decreased" : "increased"}) after the last roll.`
      : " Bias change: none.";
    if (direction) {
      tiltChangeDescription += level === beforeLevel
        ? ` Tilt remains at level ${level}.`
        : ` Tilt ${level > beforeLevel ? "increased" : "decreased"} from level ${beforeLevel} to ${level}.`;
    }
    indicator.title = tiltChangeDescription.trim();
  }
  displayedTiltState = current;
  $("tilt-info").setAttribute("aria-label", `Board Tilt: ${label}, level ${level} of 6.${tiltChangeDescription} Open Tilt explanation.`);
  if (displayedTilt === level) return;
  $("tilt-number").textContent = `Tilt ${level}`;
  $("tilt-level").textContent = label;
  if (displayedTilt !== undefined) {
    void motion($("tilt-level"), [
      { opacity: .25, transform: "translateY(4px)", color: "#fff7d6" },
      { opacity: 1, transform: "translateY(0)", color: "#f3d38e" },
    ], { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  displayedTilt = level;
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
  if (shouldReduceMotion()) { showGold(to); return Promise.resolve(); }
  return new Promise<void>(resolve => {
    const start = performance.now();
    let completed = false;
    let frameId: number;
    const finish = () => {
      if (completed) return;
      completed = true;
      cancelAnimationFrame(frameId);
      activeCounts.delete(finish);
      showGold(to);
      resolve();
    };
    activeCounts.add(finish);
    function frame(now: number) {
      if (completed) return;
      const progress = shouldReduceMotion() ? 1 : Math.min(1, (now - start) / 720);
      const eased = BigInt(Math.round((1 - (1 - progress) ** 3) * 1000));
      showGold(from + (to - from) * eased / 1000n);
      if (progress < 1) frameId = requestAnimationFrame(frame); else finish();
    }
    frameId = requestAnimationFrame(frame);
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
  showBoardNet(nextGold);
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
function fitStatValue(number: HTMLElement) {
  const row = number.parentElement!;
  number.style.fontSize = "";
  const unit = row.querySelector<HTMLElement>(".gold-unit");
  const available = row.clientWidth - (unit ? unit.offsetWidth + parseFloat(getComputedStyle(row).gap) : 0);
  const width = number.getBoundingClientRect().width;
  if (width > available && available > 0) {
    const size = parseFloat(getComputedStyle(number).fontSize);
    number.style.fontSize = `${Math.floor(size * available / width * 10) / 10}px`;
  }
}
function showGold(value: string | bigint) {
  $("gold").textContent = formatGold(value);
  fitStatValue($("gold"));
}
const fitStats = () => document.querySelectorAll<HTMLElement>(".stat-number").forEach(fitStatValue);
const statObserver = new ResizeObserver(fitStats);
document.querySelectorAll(".stat-value").forEach(row => statObserver.observe(row));
void document.fonts.ready.then(fitStats);
function renderRecentAmounts() {
  const holder = $("recent-amounts");
  const signature = recentAmounts.join(",");
  if (holder.dataset.amounts !== signature) {
    holder.dataset.amounts = signature;
    holder.innerHTML = Array.from({ length: 3 }, (_, index) => {
      const value = recentAmounts[index];
      return value
        ? `<button type="button" class="recent-chip chip-tone-${index}" data-amount="${value}" aria-keyshortcuts="${index + 1}" title="${formatGold(value)} G (${index + 1})" aria-label="Set bet amount to ${formatGold(value)} Gold"><span class="chip-face ${compactGold(value).length > 5 ? "compact-chip" : ""}">${compactGold(value)}</span></button>`
        : '<button type="button" class="recent-chip empty-chip" aria-label="No recent bet amount yet" disabled><span class="chip-face">—</span></button>';
    }).join("");
  }
  holder.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
    button.disabled = !state || busy || runEnded() || !button.dataset.amount;
    button.setAttribute("aria-pressed", String(button.dataset.amount === amount));
  });
}
const runEnded = () => !!state && (state.rollsUsed >= CONFIG.rollsPerRun || state.gold === "0");
function renderRunDialog() {
  const dialog = $<HTMLDialogElement>("run-dialog");
  if (!state || !runEnded()) {
    if (dialog.open) dialog.close();
    return;
  }
  if (busy) return;
  const completed = state.rollsUsed === CONFIG.rollsPerRun;
  const previous = state.previousBestGold;
  $("run-title").textContent = completed ? "Run complete" : "Out of Gold";
  $("run-eyebrow").textContent = `${state.rollsUsed} ${state.rollsUsed === 1 ? "roll" : "rolls"} ${completed ? "complete" : "played"}`;
  $("run-score-label").textContent = completed ? "Final score" : "Final bankroll";
  $("run-score").textContent = `${formatGold(state.gold)} G`;
  $("run-best-row").hidden = !state.hasCompletedRun;
  $("run-best").textContent = `${formatGold(state.bestGold)} G`;
  $("run-comparison").textContent = !completed
    ? "This run ended before 100 rolls. No score was posted."
    : state.leaderboardEligible === false
    ? "Probabilities were enabled in this run. This score is excluded from personal records. Your existing records stay."
    : previous === null
    ? "Your first completed run. Personal best set!"
    : BigInt(state.gold) > BigInt(previous ?? state.bestGold)
    ? `New personal best! ${formatGold(BigInt(state.gold) - BigInt(previous!))} G above your previous ${formatGold(previous!)} G.`
    : state.gold === state.bestGold
    ? "You matched your personal best."
    : `${formatGold(BigInt(state.bestGold) - BigInt(state.gold))} G below your personal best.`;
  if (!dialog.open) {
    $<HTMLInputElement>("run-nickname").value = state.nickname;
    $("run-error").textContent = "";
    document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach(open => open.close());
    dialog.showModal();
  }
}
function render() {
  if (!state) return;
  if (busy) $("game").setAttribute("aria-busy", "true");
  else $("game").removeAttribute("aria-busy");
  const showProbabilities = state.showProbabilities === true;
  showGold(state.gold);
  $("rolls-remaining").textContent = String(CONFIG.rollsPerRun - state.rollsUsed);
  $("run-status").hidden = !runEnded() && state.leaderboardEligible !== false;
  $("run-status").textContent = state.leaderboardEligible === false
    ? runEnded()
      ? "Probabilities were enabled. No personal record was saved."
      : "Probabilities were enabled. This run’s score will not enter personal records."
    : state.rollsUsed === CONFIG.rollsPerRun
    ? `Final score: ${formatGold(state.gold)} G.`
    : "Out of Gold. This run ended before 100 rolls; no score was posted.";
  if (runEnded() && !busy) {
    $("table-status").textContent = "Run complete";
  }
  showBoardNet();
  showTilt(state.tiltLevel);
  $("draft-gold").textContent = formatGold(totalDraft());
  fitStatValue($("draft-gold"));
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
      button.disabled = busy || runEnded() || (!!tutorialSession && !tutorialSession.canBet(id));
      button.classList.toggle("wagered", placed !== "0");
      if (placed !== "0") button.title = `${target.label} · ${formatGold(placed)} Gold wagered · Hold or right-click to remove`;
      else button.removeAttribute("title");
      button.setAttribute("aria-pressed", String(placed !== "0"));
      button.setAttribute("aria-keyshortcuts", "Delete Backspace");
      button.setAttribute(
        "aria-label",
        `${target.label}, covers ${target.coverage.join(", ")}${showProbabilities ? `, ${percent(probability)} probability` : ""}, return ${target.multiplier} times, wager ${placed} Gold${placed !== "0" ? ". Hold, right-click, or press Delete to remove wager" : ""}`,
      );
      if (isNumber) {
        button.innerHTML = `<svg class="number" viewBox="0 0 100 100" aria-hidden="true"><text x="50" y="50" text-anchor="middle" fill="currentColor">${target.coverage[0]}</text></svg>${showProbabilities ? `<span class="probability">${percent(probability)}</span>` : ""}${placed !== "0" ? chipPile(id, placed) : ""}`;
      } else {
        const name = target.label;
        button.innerHTML = `<span class="group-title"><span>${name}</span><b>×${target.multiplier}</b></span>${showProbabilities ? `<span class="group-odds">${percent(probability)}</span>` : ""}${placed !== "0" ? chipPile(id, placed) : ""}`;
      }
    });
  for (const id of ["increase", "decrease"])
    $<HTMLButtonElement>(id).disabled = busy || runEnded();
  $<HTMLButtonElement>("shake").disabled = busy || runEnded() || !state.canShake || (!!tutorialSession && tutorialSession.phase !== "shake");
  $("shake-hint").textContent = busy && activeAction?.kind === "shake"
    ? "Replacing the die and drawing fresh odds…"
    : runEnded()
    ? "Start a new run to play again."
    : state.canShake
    ? "Shake is ready. Fresh odds, same bankroll."
    : "Shake unlocks after a roll changes your bankroll.";
  $<HTMLInputElement>("bet-amount").disabled = busy || runEnded();
  $<HTMLButtonElement>("roll").disabled =
    busy || runEnded() || totalDraft() === 0n || (!!tutorialSession && !tutorialSession.canRoll);
  $<HTMLButtonElement>("save-nickname").disabled = busy || !!tutorialSession;
  $<HTMLInputElement>("show-probabilities").checked = showProbabilities;
  $<HTMLInputElement>("show-probabilities").disabled = busy || runEnded() || !!tutorialSession;
  $<HTMLButtonElement>("probabilities-confirm").disabled = busy || runEnded() || !!tutorialSession;
  $("probabilities-status").textContent = state.leaderboardEligible === false
    ? "This run is excluded from personal records. Start a new run to enter a score."
    : "Off at the start of each run. Turning this on excludes this run’s score from personal records.";
  $("roll").querySelector("span")!.textContent = busy ? actionPhase || "Saving…" : "Roll dice";
  for (const id of ["settings-restart", "restart-confirm"])
    $<HTMLButtonElement>(id).disabled = busy || !!tutorialSession;
  $<HTMLButtonElement>("tutorial-replay").disabled = busy;
  $<HTMLButtonElement>("run-confirm").disabled = busy;
  $<HTMLInputElement>("run-nickname").disabled = busy;
  $("run-confirm").textContent = busy ? "Starting new run…" : "Confirm & play again";
  showSaveWarning();
  centerBoardNumbers();
  updateHighlight();
  renderRecentAmounts();
  renderRunDialog();
  if (tutorialSession && !busy) $("table-status").textContent = tutorialCopy[guideLanguage].practice;
  tutorialUI.render(tutorialSession, busy, tutorialReplay);
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
  if (!state || busy || runEnded()) return;
  if (tutorialSession && !tutorialSession.canBet(id)) return;
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
  if (tutorialSession) {
    tutorialSession.bet(id, value.toString());
    draft = tutorialSession.wagers;
  } else draft[id] = ((draft[id] ? BigInt(draft[id]) : 0n) + value).toString();
  recentAmounts = [amount, ...recentAmounts.filter(recent => recent !== amount)].slice(0, 3);
  if (!tutorialSession) saveSettings({ recentAmounts });
  tossChip(id);
  announce("");
  playTone("chip");
  render();
  const chip = targetElement(id).querySelector<HTMLElement>(".table-chip:last-child")!;
  void motion(chip, [{translate: "-8px -24px", scale: "1.12", opacity: .2}, {translate: "2px 2px", scale: ".98", opacity: 1, offset: .7}, {translate: "0 0", scale: "1"}], {duration: 330, easing: "ease-out"});
}

function cancelBet(id: string) {
  if (!state || busy || !draft[id]) return;
  if (tutorialSession) {
    tutorialSession.remove(id);
    draft = tutorialSession.wagers;
  } else delete draft[id];
  announce("");
  render();
}

function stopSound() {
  audioSources.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } });
  audioSources.clear();
}
function playTone(kind: "chip" | "roll" | "win" | "jackpot") {
  if (!sound || document.hidden || tutorialExit) return;
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
function refreshLeaderboard() {
  const leaders = game.data.records;
  const best = leaders[0];
  const ownRank = leaders.findIndex(record => record.id === state?.id) + 1;
  $("leaders").innerHTML = leaders.map((record, index) => {
    const own = record.id === state?.id;
    const score = formatGold(record.score);
    return `<li value="${index + 1}" class="${own ? "you" : ""}" ${own ? 'aria-current="true"' : ""}><span class="rank">${String(index + 1).padStart(2, "0")}</span><span class="leader-name" title="${escape(record.nickname)}">${escape(record.nickname)}${index === 0 ? '<small class="leader-you">Personal best</small>' : own ? '<small class="leader-you">This run</small>' : ""}</span><strong title="${score} G" aria-label="${score} Gold">${compactGold(record.score)}<small> G</small></strong></li>`;
  }).join("");
  if (!leaders.length) $("leaders").innerHTML = '<li class="empty-floor">No personal records yet.</li>';
  $("leaderboard-unranked").hidden = !!best;
  const ownFloor = $("leaders").querySelector<HTMLElement>(".you");
  if (ownFloor && ownRank && previousRank && ownRank < previousRank)
    void motion(ownFloor, [{transform: "translateY(28px) scale(.94)", filter: "brightness(1.8)"}, {transform: "translateY(0) scale(1)", filter: "brightness(1)"}], {duration: 900, easing: "cubic-bezier(.2,.8,.2,1)"});
  previousRank = ownRank || undefined;
}

async function perform(action: Action) {
  if (!state || busy) return;
  const session = tutorialSession;
  if (session && !session.canAct(action)) return;
  if (action.kind === "shake" && !state.canShake) return;
  const before = state;
  let committed = false;
  busy = true;
  activeAction = action;
  actionPhase = action.kind === "roll" ? "Rolling…" : action.kind === "shake" ? "New die…" : action.kind === "restart" ? "New run…" : "Saving…";
  const changesBoard = ["roll", "shake", "restart"].includes(action.kind);
  if (changesBoard) clearResult();
  if (action.kind === "roll" || action.kind === "shake")
    $("table-status").textContent = action.kind === "roll" ? "No more bets" : "Fresh odds coming";
  announce("");
  $("run-error").textContent = "";
  render();
  try {
    const data = session ? session.act(action) : await game.act(before, action);
    committed = true;
    showSaveWarning();
    // The durable save is settled already; state remains the pre-roll presentation.
    if (data.result) {
      playTone("roll");
      await rollDie(data.result.outcome);
      actionPhase = "Settling…";
      $("roll").querySelector("span")!.textContent = actionPhase;
      await revealResult(data.result, action.kind === "roll" ? action.wagers : {}, data.state.gold);
      if (data.result.jackpot) {
        $("table-status").textContent = "A fresh die";
        await replaceDie();
        $("table-status").textContent = "Fresh odds. Your call.";
        announce("Jackpot! A fresh die and new odds are on the table.");
      }
    } else if (action.kind === "shake") {
      $("table-status").textContent = "Replacing the die";
      await replaceDie();
      $("table-status").textContent = "Fresh odds. Your call.";
      announce("A fresh die. New odds are on the table.");
    } else if (action.kind === "restart") {
      $<HTMLDialogElement>("run-dialog").close();
      setAmount(CONFIG.selectedWager);
      await presentNewRun(data.state);
      $("table-status").textContent = "Place your bets";
      announce("New run. 100 Gold and 100 rolls remaining.");
    } else if (action.kind === "nickname") {
      $("nickname-status").textContent = "Name saved.";
    } else if (action.kind === "probabilities") {
      announce(action.enabled
        ? "Probabilities shown. This run’s score will not enter personal records."
        : "Probabilities hidden. This run’s score remains excluded from personal records.");
    }
  } catch (error) {
    if (error instanceof StaleRunError) {
      draft = {};
      clearResult();
      setDie(1);
    }
    const message = error instanceof Error ? error.message : "Could not complete this action.";
    announce(message, true);
    if (action.kind === "nickname") $("nickname-status").textContent = message;
    if ($<HTMLDialogElement>("run-dialog").open) $("run-error").textContent = message;
  } finally {
    // Presentation failure, hidden tabs and other-tab updates cannot roll back a save.
    if (committed && changesBoard) draft = {};
    busy = false;
    activeAction = undefined;
    actionPhase = "";
    game.refresh();
    if (session?.phase === "result") session.continue();
    state = session?.state ?? game.data.state;
    applySavedSettings();
    refreshLeaderboard();
    render();
    if (session && tutorialExit) finishTutorial();
    if (action.kind === "restart" && committed && !runEnded())
      $("bet-amount").focus({ preventScroll: true });
  }
}

type BetPress = {
  pointerId: number;
  target: HTMLButtonElement;
  x: number;
  y: number;
  timer?: ReturnType<typeof setTimeout>;
};
let betPress: BetPress | undefined;
let suppressedBetClick: HTMLButtonElement | undefined;

function stopBetPress(suppressClick = false) {
  if (!betPress) return;
  clearTimeout(betPress.timer);
  if (suppressClick) suppressedBetClick = betPress.target;
  betPress = undefined;
}

app.addEventListener("pointerdown", event => {
  if (!event.isPrimary) {
    stopBetPress(true);
    return;
  }
  stopBetPress();
  suppressedBetClick = undefined;
  const target = (event.target as Element).closest<HTMLButtonElement>("[data-target]");
  if (event.button !== 0 || !target || target.disabled) return;
  const press: BetPress = { pointerId: event.pointerId, target, x: event.clientX, y: event.clientY };
  betPress = press;
  press.timer = setTimeout(() => {
    if (betPress !== press) return;
    suppressedBetClick = target;
    cancelBet(target.dataset.target!);
  }, 500);
});
document.addEventListener("pointermove", event => {
  if (!betPress || event.pointerId !== betPress.pointerId) return;
  const bounds = betPress.target.getBoundingClientRect();
  if (Math.hypot(event.clientX - betPress.x, event.clientY - betPress.y) > 10 ||
      event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom)
    stopBetPress(true);
});
document.addEventListener("pointerup", event => {
  if (event.pointerId === betPress?.pointerId) stopBetPress();
});
document.addEventListener("pointercancel", event => {
  if (event.pointerId === betPress?.pointerId) stopBetPress(true);
});
window.addEventListener("blur", () => stopBetPress(true));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopBetPress(true);
});

app.addEventListener("contextmenu", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-target]");
  if (!target) return;
  event.preventDefault();
  stopBetPress(true);
  cancelBet(target.dataset.target!);
});

app.addEventListener("click", (event) => {
  const element = event.target as HTMLElement;
  const target = element.closest<HTMLElement>("[data-target]");
  if (target) {
    // A hold removes the wager before release. Consume its generated click so
    // release cannot immediately put it back; keyboard activation still works.
    if (target === suppressedBetClick && event.detail !== 0) {
      suppressedBetClick = undefined;
      event.preventDefault();
      return;
    }
    addBet(target.dataset.target!);
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
function setAmount(value: string) {
  amount = value;
  $<HTMLInputElement>("bet-amount").value = amount;
  readAmount();
  renderRecentAmounts();
}
$("recent-amounts").addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-amount]");
  if (!button || button.disabled || busy || runEnded()) return;
  setAmount(button.dataset.amount!);
  announce("");
});
function adjustAmount(step: bigint) {
  if (!state || busy || runEnded()) return;
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
  renderRecentAmounts();
});
setupBetKeypad($<HTMLInputElement>("bet-amount"), mobileLayout, value => {
  setAmount(value);
  announce("");
}, () => state!.gold);
function placeMobileActions() {
  app.classList.toggle("swap-mobile-actions", swapMobileActions);
  const actions = document.querySelector<HTMLElement>(".actions")!;
  const first = $(swapMobileActions && mobileLayout.matches ? "shake" : "roll");
  if (actions.firstElementChild !== first) actions.prepend(first);
}
mobileLayout.addEventListener("change", placeMobileActions);
$("swap-mobile-actions").addEventListener("change", () => {
  swapMobileActions = $<HTMLInputElement>("swap-mobile-actions").checked;
  placeMobileActions();
  saveSettings({ swapMobileActions });
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
  if (state) void refreshLeaderboard();
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
  if (!state || busy) return;
  $<HTMLDialogElement>("restart-dialog").showModal();
});
$("restart-confirm").addEventListener("click", () => {
  if (!state || busy) return;
  $<HTMLDialogElement>("restart-dialog").close();
  $<HTMLDialogElement>("settings-dialog").close();
  void perform({ kind: "restart" });
});
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (e) => {
    if (dialog.id === "run-dialog") return;
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
$("run-dialog").addEventListener("cancel", event => event.preventDefault());
$("run-form").addEventListener("submit", event => {
  event.preventDefault();
  if (busy || !runEnded()) return;
  void perform({ kind: "restart", nickname: $<HTMLInputElement>("run-nickname").value });
});
$("nickname-form").addEventListener("submit", (e) => {
  e.preventDefault();
  void perform({
    kind: "nickname",
    nickname: $<HTMLInputElement>("nickname").value,
  });
});
$("sound").addEventListener("change", () => {
  sound = $<HTMLInputElement>("sound").checked;
  saveSettings({ sound });
  if (sound) playTone("chip");
  else stopSound();
});
$("show-probabilities").addEventListener("change", () => {
  const enabled = $<HTMLInputElement>("show-probabilities").checked;
  $<HTMLInputElement>("show-probabilities").checked = state?.showProbabilities === true;
  if (!state || busy || runEnded()) return;
  if (enabled) $<HTMLDialogElement>("probabilities-dialog").showModal();
  else void perform({ kind: "probabilities", enabled: false });
});
$("probabilities-confirm").addEventListener("click", () => {
  if (!state || busy || runEnded()) return;
  $<HTMLDialogElement>("probabilities-dialog").close();
  void perform({ kind: "probabilities", enabled: true });
});
let guideIndex = 0;
let guideReference = false;
function updateGuideSlide() {
  const copy = slideGuides[guideLanguage];
  const count = copy.items.length;
  const guide = $("welcome-dialog");
  guide.classList.toggle("guide-reference-mode", guideReference);
  $("guide-content").hidden = guideReference;
  $("guide-reference").hidden = !guideReference;
  guide.querySelectorAll<HTMLElement>("[data-guide-slide]").forEach(slide => {
    slide.hidden = Number(slide.dataset.guideSlide) !== guideIndex;
  });
  $("guide-step-status").textContent = guideReference ? copy.rules : `${guideIndex + 1} / ${count}: ${copy.items[guideIndex][0]}`;
  $("guide-progress").textContent = `${guideIndex + 1} / ${count}`;
  $<HTMLButtonElement>("guide-previous").disabled = guideIndex === 0;
  $<HTMLButtonElement>("guide-next").disabled = guideIndex === count - 1;
  $("guide-previous").textContent = copy.previous;
  $("guide-next").textContent = copy.next;
  $("guide-rules").textContent = guideReference ? copy.slides : copy.rules;
  $("guide-rules").setAttribute("aria-expanded", String(guideReference));
  guide.scrollTop = 0;
  $("guide-content").scrollTop = 0;
}
function renderGuide() {
  const copy = guides[guideLanguage];
  $("welcome-dialog").lang = guideLanguage;
  $("welcome-title").textContent = copy.title;
  $("welcome-dialog").querySelector("[data-close]")!.setAttribute("aria-label", copy.close);
  $("guide-language-label").textContent = copy.language;
  $<HTMLSelectElement>("guide-language").value = guideLanguage;
  $("guide-content").innerHTML = guideSlides(guideLanguage);
  // The reference is populated only on request, keeping the slide view concise.
  if (guideReference) $("guide-reference").innerHTML = guideBody(guideLanguage);
  $("welcome-start").textContent = copy.start;
  $("tutorial-replay").textContent = tutorialCopy[guideLanguage].replay;
  updateGuideSlide();
}
renderGuide();
$("guide-language").addEventListener("change", () => {
  guideLanguage = $<HTMLSelectElement>("guide-language").value as GuideLanguage;
  saveSettings({ guideLanguage });
  renderGuide();
  $("welcome-dialog").scrollTop = 0;
});
$("welcome-start").addEventListener("click", () => $<HTMLDialogElement>("welcome-dialog").close());
function moveGuideSlide(index: number) {
  const focusWasOnSlide = !!document.activeElement?.closest("#guide-content");
  guideIndex = Math.max(0, Math.min(slideGuides[guideLanguage].items.length - 1, index));
  updateGuideSlide();
  // Keep focus visible when a heading is hidden or an end button is disabled.
  if (focusWasOnSlide || (document.activeElement as HTMLButtonElement | null)?.disabled)
    $(`guide-heading-${guideIndex}`).focus({ preventScroll: true });
}
$("guide-previous").addEventListener("click", () => moveGuideSlide(guideIndex - 1));
$("guide-next").addEventListener("click", () => moveGuideSlide(guideIndex + 1));
$("guide-content").addEventListener("click", event => {
  const screenshot = (event.target as HTMLElement).closest<HTMLAnchorElement>(".guide-screenshot");
  if (screenshot?.querySelector("img")!.currentSrc)
    screenshot.href = screenshot.querySelector("img")!.currentSrc;
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-guide-example]");
  if (!button) return;
  const example = Number(button.dataset.guideExample);
  $("guide-coverage-image").innerHTML = guideExample(guideLanguage, example);
  $("guide-coverage-caption").textContent = slideGuides[guideLanguage].coverage[example][1];
  $("guide-content").querySelectorAll<HTMLButtonElement>("[data-guide-example]").forEach(item =>
    item.setAttribute("aria-pressed", String(item === button)));
});
$("guide-rules").addEventListener("click", () => {
  guideReference = !guideReference;
  if (guideReference) $("guide-reference").innerHTML = guideBody(guideLanguage);
  updateGuideSlide();
});
$("welcome-dialog").addEventListener("keydown", event => {
  if (guideReference || event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
    (event.target as HTMLElement).closest("select, input, textarea")) return;
  const destinations: Record<string, number> = { ArrowLeft: guideIndex - 1, ArrowRight: guideIndex + 1, Home: 0, End: slideGuides[guideLanguage].items.length - 1 };
  if (event.key in destinations) {
    event.preventDefault();
    moveGuideSlide(destinations[event.key]);
  }
});
let guideTouch: { x: number; y: number; id: number } | undefined;
$("guide-content").addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" && !(event.target as HTMLElement).closest("button, a"))
    guideTouch = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
$("guide-content").addEventListener("pointerup", event => {
  if (!guideTouch || event.pointerId !== guideTouch.id) return;
  const dx = event.clientX - guideTouch.x;
  const dy = event.clientY - guideTouch.y;
  guideTouch = undefined;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
    moveGuideSlide(guideIndex + (dx < 0 ? 1 : -1));
});
$("guide-content").addEventListener("pointercancel", () => { guideTouch = undefined; });
let guideReturnFocus = $("bet-amount");
function openGuide(trigger: HTMLElement, showTilt = false) {
  guideReturnFocus = trigger;
  guideReference = false;
  guideIndex = showTilt ? 1 : 0;
  updateGuideSlide();
  const guide = $<HTMLDialogElement>("welcome-dialog");
  guide.showModal();
  if (showTilt) {
    const heading = guide.querySelector<HTMLElement>(".tilt-guide")!;
    heading.focus({ preventScroll: true });
  } else guide.scrollTop = 0;
}
$("guide-open").addEventListener("click", () => openGuide($("guide-open")));
$("tilt-info").addEventListener("click", () => openGuide($("tilt-info"), true));
$("welcome-dialog").addEventListener("close", () => {
  saveSettings({ guideSeen: true });
  guideReturnFocus.focus({ preventScroll: true });
});
const tutorialUI = setupTutorial({
  language: () => guideLanguage,
  setLanguage: language => { guideLanguage = language; saveSettings({ guideLanguage }); renderGuide(); render(); },
  leave: finishTutorial,
});
$("tutorial-replay").addEventListener("click", () => {
  if (busy) return;
  $<HTMLDialogElement>("welcome-dialog").close();
  startTutorial($("guide-open"), true);
});
function startTutorial(trigger: HTMLElement, replay = false) {
  if (!state || busy) return;
  if (!tutorialSession) tutorialSnapshot = {
    id: state.id, revision: state.revision, draft: { ...draft }, amount,
    poses: new Map([...chipPoses].map(([id, poses]) => [id, poses.map(pose => ({ ...pose }))])),
    status: $("table-status").textContent ?? "Place your bets",
  };
  stopBetPress(true);
  stopMotion();
  tutorialSession = new Tutorial();
  tutorialReplay = replay;
  tutorialExit = false;
  tutorialReturnFocus = trigger;
  state = tutorialSession.state;
  draft = tutorialSession.wagers;
  recentAmounts = [];
  chipPoses.clear();
  hoverTarget = null;
  displayedTiltState = undefined;
  displayedTilt = undefined;
  tiltChangeDescription = "";
  clearResult();
  announce("");
  setDie(1);
  setAmount(CONFIG.selectedWager);
  render();
  targetElement("n3").focus({ preventScroll: true });
}
function finishTutorial() {
  if (!tutorialSession) return;
  if (busy) { tutorialExit = true; stopBetPress(true); stopMotion(); stopSound(); return; }
  stopBetPress(true);
  stopMotion();
  const previous = tutorialSnapshot;
  tutorialSession = undefined;
  tutorialSnapshot = undefined;
  tutorialExit = false;
  game.refresh();
  state = game.data.state;
  const sameRun = previous?.id === state.id && previous.revision === state.revision;
  draft = sameRun ? previous.draft : {};
  chipPoses.clear();
  if (sameRun) previous.poses.forEach((poses, id) => chipPoses.set(id, poses));
  clearResult();
  setDie(state.lastRoll?.outcome ?? 1);
  applySavedSettings();
  setAmount(previous?.amount ?? CONFIG.selectedWager);
  announce("");
  $("table-status").textContent = sameRun ? previous.status : "Place your bets";
  render();
  refreshLeaderboard();
  saveSettings({ tutorialVersion: TUTORIAL_VERSION });
  tutorialReturnFocus?.focus({ preventScroll: true });
}
function showFirstGameTutorial() {
  if (!state || runEnded() || game.data.settings.tutorialVersion >= TUTORIAL_VERSION) return;
  startTutorial($("bet-amount"), state.rollsUsed > 0);
}
$("motion").addEventListener("change", () => {
  manualReducedMotion = $<HTMLInputElement>("motion").checked;
  saveSettings({ reducedMotion: manualReducedMotion });
  document.documentElement.classList.toggle(
    "reduce-motion",
    manualReducedMotion,
  );
  if (shouldReduceMotion()) stopMotion();
  $<HTMLInputElement>("motion").checked = prefersReducedMotion();
});
reducedMotion.addEventListener("change", () => {
  if (shouldReduceMotion()) stopMotion();
  $<HTMLInputElement>("motion").checked = prefersReducedMotion();
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (event.key === "Escape" && tutorialSession && !document.querySelector("dialog[open]") &&
      !event.defaultPrevented && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    finishTutorial();
    return;
  }
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    document.querySelector("dialog[open]") ||
    (target instanceof HTMLElement &&
      (target.closest("input,textarea,select") || target.isContentEditable))
  )
    return;
  if (event.repeat) {
    if (event.key === " ") event.preventDefault();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    const bet = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-target]") : null;
    if (bet) {
      event.preventDefault();
      cancelBet(bet.dataset.target!);
    }
    return;
  }
  const key = event.key.toLowerCase();
  if (!["r", " ", "1", "2", "3", "w", "e", "q", "escape"].includes(key)) return;
  // Space must never also click a focused bet, scroll, or repeat a native action.
  event.preventDefault();
  if (!state || busy || runEnded()) return;
  if (key === "q" || key === "escape") {
    if (tutorialSession) {
      Object.keys(draft).forEach(id => tutorialSession!.remove(id));
      draft = tutorialSession.wagers;
    } else draft = {};
    chipPoses.clear();
    announce("");
    render();
  } else if (key === "w" || key === "e") {
    adjustAmount(key === "w" ? -5n : 5n);
  } else if (["1", "2", "3"].includes(key)) {
    const value = recentAmounts[Number(key) - 1];
    if (value) { setAmount(value); announce(""); }
  } else {
    const button = $<HTMLButtonElement>(key === "r" ? "roll" : "shake");
    if (!button.disabled) button.click();
  }
});

function applySavedSettings() {
  const settings = game.data.settings;
  sound = settings.sound;
  manualReducedMotion = settings.reducedMotion;
  swapMobileActions = settings.swapMobileActions;
  if (!tutorialSession) recentAmounts = settings.recentAmounts;
  guideLanguage = (settings.guideLanguage as GuideLanguage | null) ?? resolveGuideLanguage(navigator.languages);
  $<HTMLInputElement>("sound").checked = sound;
  $<HTMLInputElement>("motion").checked = prefersReducedMotion();
  $<HTMLInputElement>("swap-mobile-actions").checked = swapMobileActions;
  placeMobileActions();
  document.documentElement.classList.toggle("reduce-motion", manualReducedMotion);
  if (!sound) stopSound();
  if (shouldReduceMotion()) stopMotion();
  renderGuide();
}
function syncSavedGame() {
  if (busy || settingsWrites) return;
  game.refresh();
  if (tutorialSession) {
    applySavedSettings();
    render();
    refreshLeaderboard();
    return;
  }
  const latest = game.data.state;
  if (state && (latest.id !== state.id || latest.revision !== state.revision)) {
    draft = {};
    clearResult();
    setDie(latest.lastRoll?.outcome ?? 1);
    announce("This game changed in another tab. Draft cleared; review the saved board.");
  }
  state = latest;
  applySavedSettings();
  render();
  refreshLeaderboard();
}
window.addEventListener("storage", event => { if (event.key === SAVE_KEY) syncSavedGame(); });
window.addEventListener("pagehide", () => game.stageSettings());
window.addEventListener("focus", () => { if (!document.hidden) syncSavedGame(); });
document.addEventListener("visibilitychange", () => {
  document.documentElement.classList.toggle("page-hidden", document.hidden);
  if (document.hidden) {
    stopMotion(); stopSound();
    void audioContext?.suspend();
  } else syncSavedGame();
});
state = game.data.state;
setDie(state.lastRoll?.outcome ?? 1);
applySavedSettings();
render();
refreshLeaderboard();
showFirstGameTutorial();
