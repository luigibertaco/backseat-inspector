import { createAppShell, renderAppShell } from "./app-shell.js";
import { createComfortReport } from "./comfort-report.js";
import { createComfortSignal } from "./comfort-signal.js";
import { createBrowserPermissionFlow } from "./permissions.js";
import { createTripDatasetExportJson } from "./trip-export.js";
import {
  createLocalStorageTripStore,
  createTripRecorder,
  getOrCreateLocalDeviceId,
  recoverInterruptedTrip,
  saveTripReview,
} from "./trip-recorder.js";
import { createTripReviewFromFormData } from "./trip-review.js";
import { createBrowserWakeLockController } from "./wake-lock.js";

const app = document.querySelector("#app");
const shell = createAppShell();
const permissionFlow = createBrowserPermissionFlow(globalThis);
const tripStore = createLocalStorageTripStore(globalThis.localStorage);
const deviceId = getOrCreateLocalDeviceId(globalThis.localStorage);
let recorder = null;
let activeTrip = null;
let tripRecovery = await recoverInterruptedTrip({ store: tripStore });
let capture = null;
let comfortSignal = null;
let comfortSignalTimer = null;
let wakeLock = null;

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

    if (control.dataset.tripRecovery) {
      control.disabled = true;
      await applyTripRecovery(control.dataset.tripRecovery);
      render();
      return;
    }

    if (control.dataset.action === "export-json") {
      control.disabled = true;
      exportActiveTripDataset(globalThis, activeTrip);
      control.disabled = false;
      return;
    }

    if (control.dataset.action === "primary" && shell.currentScreen.id === "start") {
      control.disabled = true;
      await permissionFlow.requestFromUserAction();
      await startTrip();
      render();
      return;
    }

    if (control.dataset.action === "primary" && shell.currentScreen.id === "recording") {
      control.disabled = true;
      await finishTrip();
      render();
      return;
    }

    if (control.dataset.action === "primary") {
      shell.activatePrimaryAction();
      render();
    }
  });

  app.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-trip-review='form']");

    if (!form) {
      return;
    }

    event.preventDefault();
    await submitTripReview(form);
  });
}

function render() {
  if (app) {
    app.innerHTML = renderAppShell(shell, permissionFlow.snapshot(), {
      recovery: tripRecovery,
      activeTrip,
      comfortSignal: comfortSignal?.snapshot(),
      wakeLock: wakeLock?.snapshot(),
    });
    app.querySelector("[aria-pressed='true']")?.focus();
  }
}

async function startTrip() {
  recorder = createTripRecorder({
    store: tripStore,
    deviceId,
  });
  activeTrip = await recorder.startTrip({
    mountingMode: shell.currentMountingMode.id,
  });
  comfortSignal = createComfortSignal();
  startComfortSignalDecay();
  tripRecovery = await recoverInterruptedTrip({ store: tripStore });
  capture = createBrowserTripCapture(globalThis, recorder, updateActiveTrip, comfortSignal);
  capture.start();
  wakeLock = createBrowserWakeLockController(globalThis, { onChange: render });
  wakeLock.bindVisibilityRecovery();
  await wakeLock.request();
  shell.goToScreen("recording");
}

async function finishTrip() {
  capture?.stop();
  capture = null;
  stopComfortSignalDecay();
  await wakeLock?.release();
  wakeLock = null;

  if (recorder) {
    activeTrip = await recorder.finishTrip();
  }

  recorder = null;
  comfortSignal = null;
  tripRecovery = await recoverInterruptedTrip({ store: tripStore });
  shell.goToScreen("comfort-report");
}

async function applyTripRecovery(action) {
  if (!tripRecovery?.hasInterruptedTrip) {
    return;
  }

  if (action === "continue") {
    recorder = await tripRecovery.continueTrip();
    activeTrip = recorder.snapshot();
    comfortSignal = createComfortSignal();
    startComfortSignalDecay();
    capture = createBrowserTripCapture(globalThis, recorder, updateActiveTrip, comfortSignal);
    capture.start();
    wakeLock = createBrowserWakeLockController(globalThis, { onChange: render });
    wakeLock.bindVisibilityRecovery();
    await wakeLock.request();
    shell.goToScreen("recording");
    return;
  }

  if (action === "finish") {
    activeTrip = await tripRecovery.finishTrip();
    comfortSignal = null;
    stopComfortSignalDecay();
    tripRecovery = await recoverInterruptedTrip({ store: tripStore });
    shell.goToScreen("comfort-report");
    return;
  }

  if (action === "discard") {
    await tripRecovery.discardTrip();
    activeTrip = null;
    recorder = null;
    comfortSignal = null;
    stopComfortSignalDecay();
    wakeLock = null;
    tripRecovery = await recoverInterruptedTrip({ store: tripStore });
  }
}

function exportActiveTripDataset(browser, trip) {
  if (!trip || trip.status !== "finished") {
    return;
  }

  const json = createTripDatasetExportJson(trip);
  const blob = new browser.Blob([json], { type: "application/json" });
  const url = browser.URL.createObjectURL(blob);
  const link = browser.document.createElement("a");

  link.href = url;
  link.download = `${trip.tripId ?? "trip"}-dataset.json`;
  link.hidden = true;
  browser.document.body?.append(link);
  link.click();
  link.remove();
  browser.setTimeout?.(() => browser.URL.revokeObjectURL(url), 0) ??
    browser.URL.revokeObjectURL(url);
}

async function submitTripReview(form) {
  if (!activeTrip || activeTrip.status !== "finished") {
    return;
  }

  const control = form.querySelector("[data-trip-review-action='save']");

  control.disabled = true;

  const report = createComfortReport(activeTrip);
  const review = createTripReviewFromFormData({
    report,
    formData: new FormData(form),
  });

  activeTrip = await saveTripReview({
    store: tripStore,
    tripId: activeTrip.tripId,
    review,
  });

  render();
}

function updateActiveTrip() {
  activeTrip = recorder?.snapshot() ?? activeTrip;
  render();
}

function createBrowserTripCapture(browser, tripRecorder, onSample, signal = null) {
  let gpsWatchId = null;
  const motionHandler = (event) => {
    const sample = normalizeMotionEvent(event);
    signal?.observeMotionSample(sample);
    void tripRecorder.recordMotionSample(sample).then(onSample);
  };

  return {
    start() {
      browser.addEventListener?.("devicemotion", motionHandler);

      if (browser.navigator?.geolocation?.watchPosition) {
        gpsWatchId = browser.navigator.geolocation.watchPosition((position) => {
          void tripRecorder.recordGpsSample(normalizeGpsPosition(position)).then(onSample);
        });
      }
    },
    stop() {
      browser.removeEventListener?.("devicemotion", motionHandler);

      if (gpsWatchId !== null && browser.navigator?.geolocation?.clearWatch) {
        browser.navigator.geolocation.clearWatch(gpsWatchId);
      }
    },
  };
}

function startComfortSignalDecay() {
  stopComfortSignalDecay();
  comfortSignalTimer = globalThis.setInterval?.(() => {
    comfortSignal?.tick(globalThis.performance?.now?.() ?? Date.now());
    render();
  }, 250);
}

function stopComfortSignalDecay() {
  if (comfortSignalTimer !== null) {
    globalThis.clearInterval?.(comfortSignalTimer);
    comfortSignalTimer = null;
  }
}

function normalizeMotionEvent(event) {
  return {
    timestamp: event.timeStamp,
    acceleration: normalizeVector(event.acceleration),
    accelerationIncludingGravity: normalizeVector(event.accelerationIncludingGravity),
    rotationRate: normalizeRotation(event.rotationRate),
    intervalMs: event.interval ?? null,
  };
}

function normalizeGpsPosition(position) {
  return {
    timestamp: position.timestamp,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude,
    speedMetersPerSecond: position.coords.speed,
    headingDegrees: position.coords.heading,
    accuracyMeters: position.coords.accuracy,
  };
}

function normalizeVector(vector) {
  if (!vector) {
    return null;
  }

  return {
    x: vector.x ?? null,
    y: vector.y ?? null,
    z: vector.z ?? null,
  };
}

function normalizeRotation(rotationRate) {
  if (!rotationRate) {
    return null;
  }

  return {
    alpha: rotationRate.alpha ?? null,
    beta: rotationRate.beta ?? null,
    gamma: rotationRate.gamma ?? null,
  };
}
