import { createAppShell, renderAppShell } from "./app-shell.js";

const app = document.querySelector("#app");
const shell = createAppShell();

if (app) {
  render();

  app.addEventListener("click", (event) => {
    const control = event.target.closest("button");

    if (!control) {
      return;
    }

    if (control.dataset.screen) {
      shell.goToScreen(control.dataset.screen);
      render();
      return;
    }

    if (control.dataset.action === "primary") {
      shell.activatePrimaryAction();
      render();
    }
  });
}

function render() {
  if (app) {
    app.innerHTML = renderAppShell(shell);
    app.querySelector("[aria-pressed='true']")?.focus();
  }
}
