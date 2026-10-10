import "./style.css";
import { BOARD, CONFIG, TARGETS, TARGET_BY_ID } from "./config";
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
let pending: ActionRequest | null = null;
let hoverTarget: string | null = null;
let lastDeltas: number[] | null = null;
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
  <aside class="rail" aria-label="Leaderboard rail">
    <span class="rail-symbol">${icon("dice")}</span>
    <button id="leaderboard-open" class="rail-button" aria-label="Open leaderboard" aria-expanded="false">${icon("trophy")}<span>Leaderboard</span>${icon("chevron")}</button>
    <span class="rail-foot">PLAY THE ODDS</span>
  </aside>
  <div class="workspace">
    <header class="header">
      <a class="wordmark" href="/" aria-label="${CONFIG.title} home">${CONFIG.title}<span>A LITTLE LUCK. A LITTLE STRATEGY.</span></a>
      <div class="header-actions"><button id="mobile-leaderboard" class="icon-button" aria-label="Open leaderboard">${icon("trophy")}</button><button id="settings-open" class="settings-button" aria-label="Settings">${icon("settings")}<span>Settings</span></button></div>
    </header>
    <main id="game" aria-label="${CONFIG.title} game">
      <section class="stage" aria-label="Gold and die">
        <div class="balance"><span class="eyebrow">YOUR GOLD</span><div class="balance-value"><span id="gold">—</span><span class="gold-unit">G</span></div></div>
        <div class="stage-detail stage-left"><span class="eyebrow">YOUR PERSONAL BEST</span><span id="best-gold" class="best-value">— G</span><span class="subtle">Every high is yours to keep.</span></div>
        <div class="die-area"><div class="die-shadow"></div><div id="die" class="die" role="img" aria-label="Die, ready to roll">${Array.from({ length: 9 }, (_, i) => `<span class="pip" data-pip="${i}"></span>`).join("")}</div></div>
        <div class="stage-detail stage-right"><span class="eyebrow">ONE DIE. ENDLESS POSSIBILITIES.</span><span class="subtle">The odds move when you win.<br>Make your next move count.</span></div>
      </section>
      <section class="table-area" aria-label="Betting table">
        <div class="table-heading"><span>PLACE YOUR BETS</span><span>Returns include your stake</span></div>
        <div id="board" class="board"></div>
        <div class="color-bets" id="color-bets"></div>
        <div class="jackpot-line" id="jackpot-line"><span class="jackpot-star">✧</span><span id="jackpot-text">Loading your board…</span></div>
      </section>
      <section class="betting-controls" aria-label="Wager controls">
        <div class="accounting"><span>Draft <strong id="draft-total">0 G</strong></span><span class="accounting-dot">·</span><span>Available <strong id="available">— G</strong></span><button id="edit-draft" aria-expanded="false" aria-controls="draft-tray">Edit bets <span id="draft-count">0</span></button><button id="clear-draft">Clear</button></div>
        <div id="draft-tray" class="draft-tray" hidden></div>
        <div class="actions"><div class="amount-selector"><button id="decrease" aria-label="Decrease bet by 5 Gold">‹</button><label for="bet-amount">Bet:</label><input id="bet-amount" type="text" inputmode="numeric" pattern="[0-9]*" value="10" aria-label="Bet amount in Gold" autocomplete="off" /><span>G</span><button id="increase" aria-label="Increase bet by 5 Gold">›</button></div><button id="roll" class="roll-button">${icon("dice")}<span>Roll</span><kbd>R</kbd></button><button id="shake" class="shake-button">${icon("shake")}<span>Shake<small>Free · unlimited</small></span></button></div>
        <p id="hint" class="hint">Tap a target to add your bet. Combine any targets.</p>
        <div id="result" class="result" aria-live="polite" aria-atomic="true"><span class="result-idle">Six numbers. Find your opening.</span></div>
        <p id="notice" class="notice" role="status" aria-live="polite"></p>
        <button id="retry" class="text-button" hidden>Retry saved action</button>
        <button id="restart" class="restart-button" hidden>Start again with 100 G</button>
      </section>
    </main>
    <footer><span>${CONFIG.title} <span class="footer-dot">·</span> THE WEIGHTED DICE GAME</span><span>Just play Gold. No real money.</span></footer>
  </div>
  <dialog id="leaderboard-dialog" class="leaderboard-dialog" aria-labelledby="leaderboard-title"><div class="dialog-top"><div><span class="eyebrow">THE HIGH ROLLERS</span><h2 id="leaderboard-title">Leaderboard</h2></div><button class="icon-button" data-close="leaderboard-dialog" aria-label="Close leaderboard">${icon("close")}</button></div><p class="dialog-intro">Your highest settled Gold, across every game.</p><div class="ranking-labels"><span>PLAYER</span><span>BEST GOLD</span></div><ol id="leaders"></ol><p class="leaderboard-note">Shared with everyone on this server.<br>Records refresh every 5 seconds.</p><div class="your-record"><span id="your-nickname"></span><strong id="your-best"></strong></div></dialog>
  <dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="dialog-top"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="settings-title">Settings & how to play</h2></div><button class="icon-button" data-close="settings-dialog" aria-label="Close settings">${icon("close")}</button></div>
    <form id="nickname-form"><label for="nickname">Your leaderboard name</label><div class="nickname-row"><input id="nickname" maxlength="48" required autocomplete="nickname"/><button type="submit" id="save-nickname">Save</button></div><p id="nickname-status" role="status"></p></form>
    <label class="sound-control"><span>Sound effects<small>Soft, procedural dice and win tones</small></span><input id="sound" type="checkbox" role="switch" ${sound ? "checked" : ""}/></label>
    <label class="sound-control"><span>Reduce motion<small>Skip dice movement and celebration effects</small></span><input id="motion" type="checkbox" role="switch" ${shouldReduceMotion() ? "checked" : ""}/></label>
    <div class="instructions"><h3>A board that moves with you.</h3><p>Select an amount, then tap any number or group to add a wager. Open <b>Edit bets</b> to reduce or remove individual wagers. Overlapping bets are welcome.</p><p><b>Roll</b> samples one outcome using the displayed odds. Each winning wager pays its total return: number ×6, row ×2, column ×3, color ×2.</p><p>When any wager pays, the rolled number gives 25% of its probability to the other five equally—even on a break-even or net-loss Roll. A complete miss leaves the odds unchanged.</p><p><b>Jackpot ×24:</b> wager only on the marked number. A hit pays ×24 instead of ×6, then automatically Shakes to a fresh board. The lowest probability is marked; the lowest number breaks ties.</p><p><b>Shake</b> is free and unlimited. It refreshes the probabilities and clears your draft. Gold stays yours. Rolls also clear your draft. At zero Gold, start again; your best record stays.</p><p>Gold and odds save automatically. A refresh resumes your board. Uncommitted drafts are local to this tab and clear on refresh. On desktop, <kbd>R</kbd> rolls and <kbd>S</kbd> shakes. All controls also work with Tab and Enter. Reduced-motion preferences are respected.</p></div>
  </dialog>
`;

function targetButton(id: string, classes: string, style = "") {
  return `<button class="target ${classes}" data-target="${id}" ${style ? `style="${style}"` : ""}></button>`;
}
$("board").innerHTML = [
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

function setDie(number: number) {
  const pips: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  $("die")
    .querySelectorAll<HTMLElement>(".pip")
    .forEach((pip, i) =>
      pip.classList.toggle("visible", pips[number].includes(i)),
    );
  $("die").setAttribute("aria-label", `Die showing ${number}`);
}
setDie(1);

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
    state.gold.length > 30 || state.bestGold.length > 30,
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
      const delta =
        isNumber && lastDeltas ? lastDeltas[target.coverage[0] - 1] : 0;
      button.disabled = busy || !!pending || state!.gold === "0";
      button.classList.toggle("wagered", placed !== "0");
      button.classList.toggle("large-wager", placed.length > 12);
      button.classList.toggle("marked", marked);
      button.classList.toggle(
        "last-outcome",
        !!state!.lastRoll &&
          state!.lastRoll.outcome === target.coverage[0] &&
          isNumber,
      );
      button.setAttribute("aria-pressed", String(placed !== "0"));
      button.setAttribute(
        "aria-label",
        `${target.label}, covers ${target.coverage.join(", ")}, ${percent(probability)} probability, return ${target.multiplier} times${marked ? ", Jackpot 24 times when wagered alone" : ""}, wager ${placed} Gold`,
      );
      if (isNumber) {
        button.innerHTML = `<span class="cell-top"><span class="cell-color">${BOARD.flat().find((c) => c.number === target.coverage[0])!.color}</span>${marked ? '<span class="jackpot-marker">✧ JACKPOT</span>' : '<span class="cell-multiplier">×6</span>'}</span><span class="number">${target.coverage[0]}</span><span class="cell-bottom"><span class="probability ${delta > 1e-12 ? "up" : delta < -1e-12 ? "down" : ""}" title="${(probability * 100).toPrecision(12)}% internal probability">${delta > 1e-12 ? "↑ " : delta < -1e-12 ? "↓ " : ""}${percent(probability)}</span><span class="wager-chip">${formatGold(placed)} G</span></span><span class="probability-track"><span style="width:${probability * 100}%"></span></span>`;
      } else {
        const name =
          target.kind === "column"
            ? ["LEFT", "MIDDLE", "RIGHT"][Number(id.slice(3))]
            : target.kind === "row"
              ? id === "row0"
                ? "TOP"
                : "BOTTOM"
              : target.label.toUpperCase();
        button.innerHTML = `<span class="group-title">${target.kind === "color" ? `<i class="color-dot ${id}"></i>` : ""}${name}<b>×${target.multiplier}</b></span><span class="coverage">${target.coverage.join(" · ")}<span class="group-odds">${percent(probability)}</span>${target.kind !== "row" && placed !== "0" ? `<span class="group-wager-inline">${formatGold(placed)} G</span>` : ""}</span>${target.kind === "row" ? `<span class="group-wager">${formatGold(placed)} G</span>` : ""}`;
      }
    });
  $("jackpot-line").classList.toggle("eligible", eligible);
  $("jackpot-text").innerHTML = eligible
    ? `<b>Jackpot ready · ${state.jackpotNumber}</b><span>Only this number. A hit returns ×24.</span>`
    : `<b>Jackpot ×24 on ${state.jackpotNumber}</b><span>Bet on this number alone to qualify.</span>`;
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
  $("roll").querySelector("span")!.textContent = busy ? "Rolling…" : "Roll";
  $("hint").textContent = busy
    ? "Resolving your saved wager…"
    : pending
      ? "An action is waiting for confirmation. Retry safely below."
      : state.gold === "0"
        ? "Out of Gold. Your personal best is safe."
        : totalDraft() === 0n
          ? "Tap a target to add your bet. Combine any targets."
          : `Ready to roll ${formatGold(totalDraft())} G. Use Edit bets to reduce or remove wagers.`;
  $("restart").hidden = state.gold !== "0";
  $<HTMLButtonElement>("restart").disabled = busy || !!pending;
  $("retry").hidden = !pending || busy;
  $("your-nickname").textContent = `${state.nickname} · you`;
  $("your-best").textContent = `${formatGold(state.bestGold)} G`;
  renderDraft();
  updateHighlight();
}
function renderDraft() {
  $("draft-tray").innerHTML =
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
  draft[id] = ((draft[id] ? BigInt(draft[id]) : 0n) + value).toString();
  if (draft[id].length > 12) {
    $("draft-tray").hidden = false;
    $("edit-draft").setAttribute("aria-expanded", "true");
  }
  announce("");
  playTone("chip");
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

function showResult(result: Settlement | null) {
  if (!result) {
    $("result").innerHTML =
      '<span class="result-idle">Six numbers. Find your opening.</span>';
    $("result").classList.remove("is-jackpot");
    setDie(1);
    return;
  }
  const net = BigInt(result.net);
  $("result").classList.toggle("is-jackpot", result.jackpot);
  $("result").innerHTML =
    `<span class="result-face">${result.outcome}</span><div class="result-copy"><strong>${result.jackpot ? "Jackpot!" : result.totalReturn === "0" ? "A miss. Another possibility awaits." : net > 0n ? "A good roll." : net === 0n ? "Even Gold. New odds." : "A paying wager. A net loss."}</strong><span>Return ${formatGold(result.totalReturn)} G <span class="result-separator">·</span> <b class="${net >= 0n ? "positive" : "negative"}">${signed(result.net)} G net</b></span></div>`;
  setDie(result.outcome);
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
          lastDeltas = null;
          showResult(state!.lastRoll);
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
      $("die").classList.add("rolling");
      if (!shouldReduceMotion())
        await new Promise((resolve) => setTimeout(resolve, CONFIG.animationMs));
      $("die").classList.remove("rolling");
      setDie(data.result.outcome);
      showResult(data.result);
      if (data.result.jackpot) {
        $("game").classList.add("celebrating");
        announce(
          `Jackpot! ${formatGold(data.result.totalReturn)} G returned. An automatic Shake follows…`,
        );
        playTone("jackpot");
        if (!shouldReduceMotion())
          await new Promise((resolve) =>
            setTimeout(resolve, CONFIG.jackpotRevealMs),
          );
        announce(
          `Jackpot! ${formatGold(data.result.totalReturn)} G returned. Automatic Shake complete — a fresh board is ready.`,
        );
        setTimeout(() => $("game").classList.remove("celebrating"), 1800);
      } else if (data.result.transferred) {
        lastDeltas = data.result.probabilitiesAfter.map(
          (p, i) => p - data.result!.probabilitiesBefore[i],
        );
        announce(
          `Odds moved: ${data.result.outcome} gave 25% of its probability to the other five.`,
        );
        playTone("win");
      } else {
        lastDeltas = null;
        announce("No paying wager. The odds stay the same.");
      }
    } else if (request.action.kind === "shake") {
      lastDeltas = null;
      announce("Fresh odds. Draft cleared. Your Gold stays yours.");
      $("die").classList.remove("shaking");
      void $("die").offsetWidth;
      $("die").classList.add("shaking");
    } else if (request.action.kind === "restart") {
      lastDeltas = null;
      amount = CONFIG.selectedWager;
      $<HTMLInputElement>("bet-amount").value = amount;
      announce("A fresh start. Your best record is safe.");
      showResult(null);
    } else {
      $("nickname-status").textContent = "Name saved.";
    }
    if (data.result?.jackpot) lastDeltas = null;
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
      lastDeltas = null;
      showResult(current.lastRoll);
      announce(
        "Another tab has updated the game. The latest saved board is shown.",
      );
    }
    void refreshLeaderboard();
  } catch (error) {
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
    $("die").classList.remove("rolling");
    render();
  }
}

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
    announce("Draft cleared. No Gold spent.");
    render();
  }
});
$("edit-draft").addEventListener("click", () => {
  $("draft-tray").hidden = !$("draft-tray").hidden;
  $("edit-draft").setAttribute(
    "aria-expanded",
    String(!$("draft-tray").hidden),
  );
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
      renderDraft();
    }
  });
$("bet-amount").addEventListener("change", () => {
  readAmount();
  renderDraft();
});
function openLeaderboard() {
  $<HTMLDialogElement>("leaderboard-dialog").showModal();
  $("leaderboard-open").setAttribute("aria-expanded", "true");
  void refreshLeaderboard();
}
$("leaderboard-open").addEventListener("click", openLeaderboard);
$("mobile-leaderboard").addEventListener("click", openLeaderboard);
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
  $<HTMLInputElement>("motion").checked = shouldReduceMotion();
});
reducedMotion.addEventListener("change", () => {
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
      lastDeltas = null;
      showResult(latest.lastRoll);
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
    showResult(state.lastRoll);
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
