import { createComfortReport } from "./comfort-report.js";

const SCREENS = [
  {
    id: "start",
    title: "Start Trip",
    eyebrow: "Ready",
    body: "Prepare permissions, mounting mode, and calibration before recording a Trip.",
    action: "Start Trip",
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

export function renderAppShell(shell = createAppShell(), permissionDiagnostics = null, tripRecording = null) {
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
      ${renderTripRecovery(shell, tripRecording?.recovery)}
      ${renderTripRecordingStatus(shell, tripRecording?.activeTrip, tripRecording?.wakeLock)}
      ${renderComfortReport(shell, tripRecording?.activeTrip)}
      ${renderScreenTabs(shell)}
      <button class="primary-action" type="button" data-action="primary">${shell.currentScreen.action}</button>
    </section>
  `;
}

function renderScreenTabs(shell) {
  if (shell.currentScreen.id === "recording") {
    return "";
  }

  const screenTabs = shell.screens
    .map((screen) => {
      const active = screen.id === shell.currentScreen.id ? "true" : "false";

      return `<button class="screen-tab" type="button" data-screen="${screen.id}" aria-pressed="${active}">${screen.title}</button>`;
    })
    .join("");

  return `<div class="screen-tabs" aria-label="Trip flow">${screenTabs}</div>`;
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

function renderTripRecovery(shell, recovery) {
  if (shell.currentScreen.id !== "start" || !recovery?.hasInterruptedTrip) {
    return "";
  }

  return `
    <section class="trip-recovery" aria-label="Interrupted Trip">
      <h2>Interrupted Trip</h2>
      <p>Started ${recovery.trip.timestamps.startedAt}</p>
      <div class="recovery-actions">
        ${recovery.actions
          .map(
            (action) => `
              <button type="button" data-trip-recovery="${action}">${formatRecoveryAction(action)}</button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderTripRecordingStatus(shell, activeTrip, wakeLock) {
  if (shell.currentScreen.id !== "recording" || !activeTrip) {
    return "";
  }

  const wakeLockStatus = wakeLock?.label ?? "Unavailable";

  return `
    <dl class="diagnostics" aria-label="Trip recording status">
      <div class="diagnostic">
        <dt>Trip</dt>
        <dd>${activeTrip.status}</dd>
      </div>
      <div class="diagnostic">
        <dt>Motion Samples</dt>
        <dd>${activeTrip.streams.motion.length}</dd>
      </div>
      <div class="diagnostic">
        <dt>GPS Samples</dt>
        <dd>${activeTrip.streams.gps.length}</dd>
      </div>
      <div class="diagnostic">
        <dt>Wake Lock</dt>
        <dd>${wakeLockStatus}</dd>
      </div>
    </dl>
  `;
}

function renderComfortReport(shell, trip) {
  if (shell.currentScreen.id !== "comfort-report" || trip?.status !== "finished") {
    return "";
  }

  const report = createComfortReport(trip);

  return `
    <dl class="diagnostics" aria-label="Comfort Report GPS summary">
      <div class="diagnostic">
        <dt>Duration</dt>
        <dd>${formatDuration(report.durationSeconds)}</dd>
      </div>
      <div class="diagnostic">
        <dt>Approximate Distance</dt>
        <dd>${formatDistance(report.gps.approximateDistanceMeters)}</dd>
      </div>
      <div class="diagnostic">
        <dt>Average Speed</dt>
        <dd>${formatSpeed(report.gps.averageSpeedMetersPerSecond)}</dd>
      </div>
      <div class="diagnostic">
        <dt>Maximum Speed</dt>
        <dd>${formatSpeed(report.gps.maximumSpeedMetersPerSecond)}</dd>
      </div>
      <div class="diagnostic">
        <dt>GPS Points</dt>
        <dd>${report.gps.pointCount}</dd>
      </div>
      <div class="diagnostic">
        <dt>Low-accuracy Samples</dt>
        <dd>${report.gps.lowAccuracySamplePercentage}%</dd>
      </div>
    </dl>
  `;
}

function formatRecoveryAction(action) {
  const labels = {
    continue: "Continue Trip",
    finish: "Finish With Existing Data",
    discard: "Discard Trip",
  };

  return labels[action] ?? formatStatus(action);
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

function formatDuration(durationSeconds) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return `${minutes} min ${seconds} sec`;
}

function formatDistance(distanceMeters) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

function formatSpeed(speedMetersPerSecond) {
  return `${(speedMetersPerSecond * 3.6).toFixed(1)} km/h`;
}
