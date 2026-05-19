const SCREENS = [
  {
    id: "start",
    title: "Start Trip",
    eyebrow: "Ready",
    body: "Prepare permissions, mounting mode, and calibration before recording a Trip.",
    action: "Check Permissions",
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

export function renderAppShell(shell = createAppShell(), permissionDiagnostics = null) {
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
      ${renderPermissionDiagnostics(shell, permissionDiagnostics)}
      <div class="screen-tabs" aria-label="Trip flow">${screenTabs}</div>
      <button class="primary-action" type="button" data-action="primary">${shell.currentScreen.action}</button>
    </section>
  `;
}

function renderPermissionDiagnostics(shell, diagnostics) {
  if (shell.currentScreen.id !== "start" || !diagnostics) {
    return "";
  }

  const items = [
    ["Motion", formatPermission(diagnostics.motion)],
    ["Orientation", formatPermission(diagnostics.orientation)],
    ["Gyroscope", formatPermission(diagnostics.gyroscope)],
    ["GPS", formatGps(diagnostics.gps)],
  ];

  return `
    <dl class="diagnostics" aria-label="Permission diagnostics">
      ${items
        .map(
          ([label, value]) => `
            <div class="diagnostic">
              <dt>${label}</dt>
              <dd>${value}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
  `;
}

function formatPermission(diagnostic) {
  return formatStatus(diagnostic?.permission ?? diagnostic?.availability ?? "unavailable");
}

function formatGps(gps) {
  if (gps?.active && Number.isFinite(gps.accuracyMeters)) {
    return `Active (${Math.round(gps.accuracyMeters)} m accuracy)`;
  }

  return formatStatus(gps?.permission ?? gps?.availability ?? "unavailable");
}

function formatStatus(status) {
  const label = status.split("-").join(" ");

  return `${label[0].toUpperCase()}${label.slice(1)}`;
}
