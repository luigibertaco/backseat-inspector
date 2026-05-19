const NOT_REQUESTED = "not-requested";

export function createBrowserPermissionFlow(browser = globalThis) {
  return createPermissionFlow({
    motion: createEventSensorCapability(browser.DeviceMotionEvent),
    orientation: createEventSensorCapability(browser.DeviceOrientationEvent),
    gyroscope: {
      isAvailable: typeof browser.Gyroscope === "function",
    },
    location: createLocationCapability(browser.navigator?.geolocation),
  });
}

export function createPermissionFlow(capabilities = {}) {
  const state = {
    motion: createSensorState(capabilities.motion),
    orientation: createSensorState(capabilities.orientation),
    gyroscope: createAvailabilityState(capabilities.gyroscope),
    gps: {
      availability: capabilities.location?.isAvailable ? "available" : "unavailable",
      permission: capabilities.location?.isAvailable ? NOT_REQUESTED : "unavailable",
      active: false,
      accuracyMeters: null,
    },
  };

  return {
    snapshot() {
      return structuredClone(state);
    },
    async requestFromUserAction() {
      await requestSensorPermission(state.motion, capabilities.motion);
      await requestSensorPermission(state.orientation, capabilities.orientation);
      await requestLocationPermission(state.gps, capabilities.location);
      return this.snapshot();
    },
  };
}

function createEventSensorCapability(eventConstructor) {
  const isAvailable = typeof eventConstructor === "function" || Boolean(eventConstructor);

  return {
    isAvailable,
    requestPermission:
      typeof eventConstructor?.requestPermission === "function"
        ? () => eventConstructor.requestPermission()
        : null,
  };
}

function createLocationCapability(geolocation) {
  return {
    isAvailable: Boolean(geolocation),
    requestCurrentPosition: () =>
      new Promise((resolve, reject) => {
        geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        });
      }),
  };
}

function createSensorState(capability) {
  const availability = capability?.isAvailable ? "available" : "unavailable";

  return {
    availability,
    permission: availability === "available" ? NOT_REQUESTED : "unavailable",
  };
}

function createAvailabilityState(capability) {
  const availability = capability?.isAvailable ? "available" : "unavailable";

  return {
    availability,
    permission: availability,
  };
}

async function requestSensorPermission(sensorState, capability) {
  if (!capability?.isAvailable) {
    sensorState.permission = "unavailable";
    return;
  }

  if (!capability.requestPermission) {
    sensorState.permission = "granted";
    return;
  }

  const permission = await capability.requestPermission();
  sensorState.permission = permission === "granted" ? "granted" : "denied";
}

async function requestLocationPermission(gpsState, capability) {
  if (!capability?.isAvailable) {
    gpsState.permission = "unavailable";
    gpsState.active = false;
    return;
  }

  try {
    const position = await capability.requestCurrentPosition();
    gpsState.permission = "granted";
    gpsState.active = true;
    gpsState.accuracyMeters = position?.coords?.accuracy ?? null;
  } catch {
    gpsState.permission = "denied";
    gpsState.active = false;
    gpsState.accuracyMeters = null;
  }
}
