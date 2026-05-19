import { createAppShell, renderAppShell } from "./app-shell.js";
import { createBrowserPermissionFlow } from "./permissions.js";

const app = document.querySelector("#app");
const shell = createAppShell();
const permissionFlow = createBrowserPermissionFlow(globalThis);

if (app) {
  render();

  app.addEventListener("click", async (event) => {
    const control = event.target.closest("button");

    if (!control) {
      return;
    }

    if (control.dataset.screen) {
      shell.goToScreen(control.dataset.screen);
      render();
      return;
    }

    if (control.dataset.mountingMode) {
      shell.selectMountingMode(control.dataset.mountingMode);
      render();
      return;
    }

    if (control.dataset.action === "primary" && shell.currentScreen.id === "start") {
      control.disabled = true;
      await permissionFlow.requestFromUserAction();
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
    app.innerHTML = renderAppShell(shell, permissionFlow.snapshot());
    app.querySelector("[aria-pressed='true']")?.focus();
  }
}
