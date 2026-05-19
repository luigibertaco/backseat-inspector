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

const MOUNTING_MODES = [
  {
    id: "fixed-mount",
    label: "Fixed mount",
    description: "Phone is secured in a mount and should stay in one orientation.",
  },
  {
    id: "horizontal-console",
    label: "Horizontal console",
    description: "Phone is lying flat on the console and must be level and stable.",
  },
];

export function createAppShell(initialScreenId = "start") {
  let currentScreen =
    findScreen(initialScreenId) ?? SCREENS[0];
  let currentMountingMode = MOUNTING_MODES[0];

  return {
    get currentScreen() {
      return currentScreen;
    },
    get currentMountingMode() {
      return currentMountingMode;
    },
    screens: SCREENS,
    mountingModes: MOUNTING_MODES,
    goToScreen(screenId) {
      currentScreen = findScreen(screenId) ?? currentScreen;
      return currentScreen;
    },
    selectMountingMode(mountingModeId) {
      currentMountingMode = findMountingMode(mountingModeId) ?? currentMountingMode;
      return currentMountingMode;
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

function findMountingMode(mountingModeId) {
  return MOUNTING_MODES.find((mode) => mode.id === mountingModeId);
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
      ${renderMountingModes(shell)}
      ${renderPermissionDiagnostics(shell, permissionDiagnostics)}
      <div class="screen-tabs" aria-label="Trip flow">${screenTabs}</div>
      <button class="primary-action" type="button" data-action="primary">${shell.currentScreen.action}</button>
    </section>
  `;
}

function renderMountingModes(shell) {
  if (shell.currentScreen.id !== "start") {
    return "";
  }

  return `
    <div class="mounting-modes" aria-label="Mounting mode">
      ${shell.mountingModes
        .map((mode) => {
          const active = mode.id === shell.currentMountingMode.id ? "true" : "false";

          return `
            <button class="mounting-mode" type="button" data-mounting-mode="${mode.id}" aria-pressed="${active}">
              <span>${mode.label}</span>
              <small>${mode.description}</small>
            </button>
          `;
        })
        .join("")}
    </div>
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
