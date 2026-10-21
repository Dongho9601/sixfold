import { guideLanguages, guides, type GuideLanguage } from "./guide";
import type { Tutorial } from "./game/tutorial";
import { tutorialCopy } from "./tutorial-copy";

interface TutorialOptions {
  language: () => GuideLanguage;
  setLanguage: (language: GuideLanguage) => void;
  leave: () => void;
}

/** Visible coaching on the existing table; all play stays on the real controls. */
export function setupTutorial(options: TutorialOptions) {
  const coach = document.createElement("section");
  coach.id = "tutorial-coach";
  coach.className = "onboard-coach";
  coach.hidden = true;
  coach.setAttribute("aria-labelledby", "tutorial-title");
  coach.innerHTML = `
    <div class="onboard-heading"><span id="tutorial-label"></span><span id="tutorial-progress"></span>
      <label class="onboard-language"><span id="tutorial-language-label" class="sr-only"></span><select id="tutorial-language">${guideLanguages.map(([code, name]) => `<option value="${code}" lang="${code}">${name}</option>`).join("")}</select></label>
      <button id="tutorial-finish" type="button" hidden></button>
      <button id="tutorial-skip" type="button">×</button>
    </div>
    <h2 id="tutorial-title"></h2>
    <p id="tutorial-instruction" role="status" aria-live="polite" aria-atomic="true" tabindex="0"></p>
    <div id="tutorial-progress-track" aria-hidden="true">${"<span></span>".repeat(5)}</div>`;
  const compactLandscape = matchMedia("(orientation: landscape) and (max-height: 500px) and (max-width: 1000px)");
  function placeCoach() {
    const parent = document.querySelector(compactLandscape.matches ? ".betting-controls" : ".felt")!;
    if (coach.parentElement !== parent) parent.prepend(coach);
  }
  placeCoach();
  compactLandscape.addEventListener("change", placeCoach);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => coach.querySelector<T>(`#${id}`)!;
  $("tutorial-skip").addEventListener("click", options.leave);
  $("tutorial-finish").addEventListener("click", options.leave);
  $("tutorial-language").addEventListener("change", () => options.setLanguage($<HTMLSelectElement>("tutorial-language").value as GuideLanguage));

  return {
    render(session: Tutorial | undefined, busy: boolean, replay: boolean) {
      placeCoach();
      coach.hidden = !session;
      document.getElementById("game")!.classList.toggle("is-tutorial", !!session);
      document.querySelectorAll(".tutorial-focus, .tutorial-context").forEach(element => element.classList.remove("tutorial-focus", "tutorial-context"));
      document.querySelectorAll(".tutorial-pointer").forEach(element => element.remove());
      document.querySelectorAll<HTMLElement>("[data-tutorial-anchor]").forEach(element => {
        delete element.dataset.tutorialAnchor;
        const description = element.getAttribute("aria-describedby")?.split(" ").filter(id => id !== "tutorial-instruction").join(" ");
        if (description) element.setAttribute("aria-describedby", description);
        else element.removeAttribute("aria-describedby");
      });
      if (!session) { delete coach.dataset.phase; return; }
      const language = options.language();
      const copy = tutorialCopy[language];
      const phase = session.phase === "result" ? "shake" : session.phase;
      const step = { number: 1, coverage: 2, shake: 3, jackpot: 4, complete: 5 }[phase];
      coach.lang = language;
      coach.dataset.phase = phase;
      coach.dataset.busy = String(busy);
      $("tutorial-label").textContent = copy.label;
      $("tutorial-progress").textContent = `${step}/5`;
      $("tutorial-progress-track").querySelectorAll("span").forEach((segment, index) => {
        segment.classList.toggle("current", index === step - 1);
        segment.classList.toggle("passed", index < step - 1);
      });
      const ready = session.canRoll && (phase === "coverage" || phase === "jackpot");
      $("tutorial-title").textContent = ready ? copy.rollTitle : copy.lessons[phase][0];
      $("tutorial-language-label").textContent = guides[language].language;
      $<HTMLSelectElement>("tutorial-language").value = language;
      $("tutorial-skip").setAttribute("aria-label", copy.skip);
      $("tutorial-skip").title = copy.skip;
      $("tutorial-finish").textContent = replay ? copy.return : copy.start;
      $("tutorial-finish").hidden = phase !== "complete";
      coach.querySelector<HTMLElement>(".onboard-language")!.hidden = phase === "complete";
      const result = session.result;
      const text = busy ? copy.working : ready ? copy.ready : copy.lessons[phase][1];
      const stake = ready ? Object.values(session.wagers).reduce((sum, value) => sum + BigInt(value), 0n).toLocaleString(language) : result?.stake ?? "0";
      const instruction = text
        .replace("{n}", String(session.state.jackpotNumber))
        .replace("{stake}", stake)
        .replace("{return}", result?.totalReturn ?? "0")
        .replace("{gold}", BigInt(session.state.gold).toLocaleString(language));
      if ($("tutorial-instruction").textContent !== instruction) {
        $("tutorial-instruction").textContent = instruction;
        $("tutorial-instruction").scrollTop = 0;
      }
      if (busy) return;
      const selectors = phase === "number" ? ['[data-target="n3"]']
        : phase === "coverage" ? session.canRoll ? ["#roll"] : ['[data-target="row0"]']
        : phase === "shake" ? ["#shake"]
        : phase === "jackpot" ? session.canRoll ? ["#roll"] : [`[data-target="n${session.state.jackpotNumber}"]`]
        : ["#tutorial-finish"];
      const primary = document.querySelector<HTMLElement>(selectors[0]);
      if (primary) {
        primary.classList.add("tutorial-focus");
        primary.dataset.tutorialAnchor = "true";
        primary.setAttribute("aria-describedby", [...new Set([...(primary.getAttribute("aria-describedby")?.split(" ") ?? []), "tutorial-instruction"])].join(" "));
        if (phase !== "complete") {
          const pointer = document.createElement("span");
          pointer.className = "tutorial-pointer";
          pointer.setAttribute("aria-hidden", "true");
          pointer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V5a2 2 0 0 1 4 0v6m0-2a2 2 0 0 1 4 0v3m0-1a2 2 0 0 1 4 0v5c0 4-2 6-6 6h-1c-2 0-3-1-4-2l-5-6a2 2 0 0 1 3-2l1 1"/></svg>';
          primary.append(pointer);
        }
      }
      if (phase === "number") document.querySelector(".amount-selector")?.classList.add("tutorial-context");
      if (phase === "shake") document.querySelector("#tilt-info")?.classList.add("tutorial-context");
    },
  };
}
