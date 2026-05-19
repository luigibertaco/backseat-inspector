import { createAppShell, renderAppShell } from "./app-shell.js";
import { createBrowserPermissionFlow } from "./permissions.js";
import {
  createLocalStorageTripStore,
  createTripRecorder,
  getOrCreateLocalDeviceId,
  recoverInterruptedTrip,
} from "./trip-recorder.js";
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
}

function render() {
  if (app) {
    app.innerHTML = renderAppShell(shell, permissionFlow.snapshot(), {
      recovery: tripRecovery,
      activeTrip,
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
  tripRecovery = await recoverInterruptedTrip({ store: tripStore });
  capture = createBrowserTripCapture(globalThis, recorder, updateActiveTrip);
  capture.start();
  wakeLock = createBrowserWakeLockController(globalThis, { onChange: render });
  wakeLock.bindVisibilityRecovery();
  await wakeLock.request();
  shell.goToScreen("recording");
}

async function finishTrip() {
  capture?.stop();
  capture = null;
  await wakeLock?.release();
  wakeLock = null;

  if (recorder) {
    activeTrip = await recorder.finishTrip();
  }

  recorder = null;
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
    capture = createBrowserTripCapture(globalThis, recorder, updateActiveTrip);
    capture.start();
    wakeLock = createBrowserWakeLockController(globalThis, { onChange: render });
    wakeLock.bindVisibilityRecovery();
    await wakeLock.request();
    shell.goToScreen("recording");
    return;
  }

  if (action === "finish") {
    activeTrip = await tripRecovery.finishTrip();
    tripRecovery = await recoverInterruptedTrip({ store: tripStore });
    shell.goToScreen("comfort-report");
    return;
  }

  if (action === "discard") {
    await tripRecovery.discardTrip();
    activeTrip = null;
    recorder = null;
    wakeLock = null;
    tripRecovery = await recoverInterruptedTrip({ store: tripStore });
  }
}

function updateActiveTrip() {
  activeTrip = recorder?.snapshot() ?? activeTrip;
}

function createBrowserTripCapture(browser, tripRecorder, onSample) {
  let gpsWatchId = null;
  const motionHandler = (event) => {
    void tripRecorder.recordMotionSample(normalizeMotionEvent(event)).then(onSample);
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
