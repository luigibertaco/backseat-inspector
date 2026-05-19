const SCREENS = [
  {
    id: "start",
    title: "Start Trip",
    eyebrow: "Ready",
    body: "Prepare permissions, mounting mode, and calibration before recording a Trip.",
    action: "Set Up Trip",
  },
  {
    id: "recording",
    title: "Trip",
    eyebrow: "Recording",
    body: "Keep the Trip screen focused on operational status and a finish action.",
    action: "Finish Trip",
  },
  {
    id: "comfort-report",
    title: "Comfort Report",
    eyebrow: "Review",
    body: "Summarize Passenger Comfort, Confidence Markers, and Trip Review data.",
    action: "Review Report",
  },
];

export function createAppShell(initialScreenId = "start") {
  let currentScreen =
    findScreen(initialScreenId) ?? SCREENS[0];

  return {
    get currentScreen() {
      return currentScreen;
    },
    screens: SCREENS,
    goToScreen(screenId) {
      currentScreen = findScreen(screenId) ?? currentScreen;
      return currentScreen;
    },
    activatePrimaryAction() {
      const currentIndex = SCREENS.findIndex((screen) => screen.id === currentScreen.id);
      const nextScreen = SCREENS[Math.min(currentIndex + 1, SCREENS.length - 1)];
      currentScreen = nextScreen;
      return currentScreen;
    },
  };
}

function findScreen(screenId) {
  return SCREENS.find((screen) => screen.id === screenId);
}

export function renderAppShell(shell = createAppShell()) {
  const screenTabs = shell.screens
    .map((screen) => {
      const active = screen.id === shell.currentScreen.id ? "true" : "false";

      return `<button class="screen-tab" type="button" data-screen="${screen.id}" aria-pressed="${active}">${screen.title}</button>`;
    })
    .join("");

  return `
    <section class="app-panel" aria-labelledby="screen-title">
      <header class="app-header">
        <div class="brand-mark" aria-hidden="true">BI</div>
        <div>
          <p class="eyebrow">${shell.currentScreen.eyebrow}</p>
          <h1 id="screen-title">${shell.currentScreen.title}</h1>
        </div>
      </header>
      <p class="screen-copy">${shell.currentScreen.body}</p>
      <div class="screen-tabs" aria-label="Trip flow">${screenTabs}</div>
      <button class="primary-action" type="button" data-action="primary">${shell.currentScreen.action}</button>
    </section>
  `;
}
