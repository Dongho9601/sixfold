/** A phone keypad overlays the game without invoking browser keyboard panning. */
export function setupBetKeypad(
  input: HTMLInputElement,
  mobileLayout: MediaQueryList,
  commit: (value: string) => void,
) {
  const touch = matchMedia("(pointer: coarse)");
  const dialog = document.createElement("dialog");
  dialog.id = "bet-keypad";
  dialog.className = "bet-keypad";
  dialog.setAttribute("aria-labelledby", "keypad-title");
  dialog.innerHTML = `
    <div class="dialog-top"><h2 id="keypad-title">Bet amount</h2><button type="button" class="icon-button" id="keypad-cancel" aria-label="Cancel bet amount edit">×</button></div>
    <div class="keypad-value"><output id="keypad-amount" tabindex="0" aria-label="Bet amount in Gold" aria-live="polite" aria-atomic="true"></output><span>G</span></div>
    <p id="keypad-validation" class="keypad-validation" role="status"></p>
    <div class="keypad-keys" role="group" aria-label="Number keypad">
      ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"].map(key =>
        `<button type="button" data-key="${key}"${key === "backspace" ? ' aria-label="Delete last digit"' : ""}>${key === "clear" ? "Clear" : key === "backspace" ? "⌫" : key}</button>`,
      ).join("")}
    </div>
    <button type="button" id="keypad-done" class="roll-button">Done</button>
  `;
  document.body.append(dialog);
  const output = dialog.querySelector<HTMLOutputElement>("output")!;
  const done = dialog.querySelector<HTMLButtonElement>("#keypad-done")!;
  const validation = dialog.querySelector<HTMLElement>("#keypad-validation")!;
  let value = "";
  let replace = true;
  const enabled = () => mobileLayout.matches && touch.matches;
  function render() {
    output.textContent = value || "0";
    output.dataset.replace = String(replace);
    done.disabled = !/^\d+$/.test(value) || BigInt(value) < 1n;
    validation.textContent = done.disabled ? "Enter at least 1 G." : "";
  }
  function open() {
    if (!enabled() || input.disabled || dialog.open) return;
    value = /^\d+$/.test(input.value.trim()) ? input.value.trim() : "";
    replace = true;
    render();
    dialog.showModal();
    output.focus({ preventScroll: true });
  }
  function press(key: string) {
    if (key === "clear") value = "";
    else if (key === "backspace") value = value.slice(0, -1);
    else value = (replace ? "" : value) + key;
    replace = false;
    render();
  }
  function finish() {
    if (done.disabled || input.disabled) return;
    commit(BigInt(value).toString());
    dialog.close();
  }
  function applyMode() {
    input.readOnly = enabled();
    input.inputMode = enabled() ? "none" : "numeric";
    if (enabled()) {
      input.setAttribute("aria-haspopup", "dialog");
      input.setAttribute("aria-controls", dialog.id);
    } else {
      input.removeAttribute("aria-haspopup");
      input.removeAttribute("aria-controls");
      if (dialog.open) dialog.close();
    }
  }
  input.addEventListener("click", open);
  input.addEventListener("keydown", event => {
    if (!enabled() || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (["Enter", " "].includes(event.key) || /^\d$/.test(event.key)) {
      event.preventDefault();
      open();
      if (dialog.open && /^\d$/.test(event.key)) press(event.key);
    }
  });
  dialog.addEventListener("click", event => {
    const key = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-key]");
    if (key) press(key.dataset.key!);
    else if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
        dialog.close();
    }
  });
  dialog.addEventListener("keydown", event => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    // Preserve native Enter activation for the keypad's focused buttons.
    if (event.key === "Enter" && event.target instanceof HTMLButtonElement) return;
    if (/^\d$/.test(event.key) || ["Backspace", "Delete", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Enter") finish();
      else press(event.key === "Backspace" ? "backspace" : event.key === "Delete" ? "clear" : event.key);
    }
  });
  dialog.querySelector("#keypad-cancel")!.addEventListener("click", () => dialog.close());
  done.addEventListener("click", finish);
  dialog.addEventListener("close", () => {
    if (enabled() && !input.disabled) input.focus({ preventScroll: true });
  });
  mobileLayout.addEventListener("change", applyMode);
  touch.addEventListener("change", applyMode);
  applyMode();
}
