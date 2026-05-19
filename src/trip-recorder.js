const DEFAULT_SCHEMA_VERSION = "1";
const DEFAULT_BATCH_SIZE = 25;

export function createTripRecorder({
  store,
  now = () => new Date().toISOString(),
  createTripId = () => crypto.randomUUID(),
  deviceId,
  schemaVersion = DEFAULT_SCHEMA_VERSION,
  batchSize = DEFAULT_BATCH_SIZE,
  initialTrip = null,
} = {}) {
  let activeTrip = initialTrip ? clone(initialTrip) : null;
  let pendingSamples = 0;

  return {
    async startTrip({ mountingMode } = {}) {
      activeTrip = {
        schemaVersion,
        tripId: createTripId(),
        deviceId,
        mountingMode,
        status: "recording",
        timestamps: {
          startedAt: now(),
          finishedAt: null,
        },
        streams: {
          motion: [],
          gps: [],
        },
        confidenceMarkers: [],
      };
      pendingSamples = 0;
      await persistActiveTrip(store, activeTrip);
      return clone(activeTrip);
    },
    async recordMotionSample(sample) {
      ensureRecording(activeTrip);
      activeTrip.streams.motion.push(clone(sample));
      pendingSamples += 1;
      await flushBatchIfReady();
      return clone(sample);
    },
    async recordGpsSample(sample) {
      ensureRecording(activeTrip);
      activeTrip.streams.gps.push(clone(sample));
      pendingSamples += 1;
      await flushBatchIfReady();
      return clone(sample);
    },
    async flush() {
      ensureRecording(activeTrip);
      await persistActiveTrip(store, activeTrip);
      pendingSamples = 0;
      return clone(activeTrip);
    },
    async finishTrip() {
      ensureRecording(activeTrip);
      const finishedTrip = await finishStoredTrip({
        store,
        trip: activeTrip,
        finishedAt: now(),
      });
      activeTrip = null;
      pendingSamples = 0;
      return finishedTrip;
    },
    get pendingSamples() {
      return pendingSamples;
    },
    get shouldFlushBatch() {
      return pendingSamples >= batchSize;
    },
    snapshot() {
      return activeTrip ? clone(activeTrip) : null;
    },
  };

  async function flushBatchIfReady() {
    if (pendingSamples >= batchSize) {
      await persistActiveTrip(store, activeTrip);
      pendingSamples = 0;
    }
  }
}

export async function recoverInterruptedTrip({ store, now = () => new Date().toISOString() } = {}) {
  const interruptedTrip = await store?.loadActiveTrip?.();

  if (!interruptedTrip || interruptedTrip.status !== "recording") {
    return {
      hasInterruptedTrip: false,
      trip: null,
      actions: [],
    };
  }

  return {
    hasInterruptedTrip: true,
    trip: clone(interruptedTrip),
    actions: ["continue", "finish", "discard"],
    async continueTrip({ batchSize = DEFAULT_BATCH_SIZE } = {}) {
      return createTripRecorder({
        store,
        now,
        deviceId: interruptedTrip.deviceId,
        schemaVersion: interruptedTrip.schemaVersion,
        batchSize,
        initialTrip: interruptedTrip,
      });
    },
    async finishTrip() {
      return finishStoredTrip({
        store,
        trip: interruptedTrip,
        finishedAt: now(),
      });
    },
    async discardTrip() {
      await store.clearActiveTrip();
      await store.deleteTrip?.(interruptedTrip.tripId);
    },
  };
}

export function createMemoryTripStore(initialTrip = null) {
  let activeTrip = initialTrip ? clone(initialTrip) : null;
  const trips = new Map();
  const writes = [];

  return {
    writes,
    async saveActiveTrip(trip) {
      activeTrip = clone(trip);
      writes.push(clone(trip));
      return clone(activeTrip);
    },
    async loadActiveTrip() {
      return activeTrip ? clone(activeTrip) : null;
    },
    async saveTrip(trip) {
      trips.set(trip.tripId, clone(trip));
      writes.push(clone(trip));
      return clone(trip);
    },
    async loadTrip(tripId) {
      const trip = trips.get(tripId);
      return trip ? clone(trip) : null;
    },
    async deleteTrip(tripId) {
      trips.delete(tripId);
    },
    async clearActiveTrip() {
      activeTrip = null;
    },
  };
}

export function createLocalStorageTripStore(
  storage = globalThis.localStorage,
  keyPrefix = "backseat-inspector.trip",
) {
  return {
    async saveActiveTrip(trip) {
      storage.setItem(activeTripKey(keyPrefix), JSON.stringify(trip));
      return clone(trip);
    },
    async loadActiveTrip() {
      return readJson(storage, activeTripKey(keyPrefix));
    },
    async clearActiveTrip() {
      storage.removeItem(activeTripKey(keyPrefix));
    },
    async saveTrip(trip) {
      storage.setItem(tripKey(keyPrefix, trip.tripId), JSON.stringify(trip));
      return clone(trip);
    },
    async loadTrip(tripId) {
      return readJson(storage, tripKey(keyPrefix, tripId));
    },
    async deleteTrip(tripId) {
      storage.removeItem(tripKey(keyPrefix, tripId));
    },
  };
}

export function getOrCreateLocalDeviceId(
  storage = globalThis.localStorage,
  createDeviceId = () => crypto.randomUUID(),
  key = "backseat-inspector.device-id",
) {
  const existingDeviceId = storage.getItem(key);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = createDeviceId();
  storage.setItem(key, deviceId);
  return deviceId;
}

async function persistActiveTrip(store, trip) {
  if (!store?.saveActiveTrip) {
    throw new Error("Trip recorder requires a store with saveActiveTrip().");
  }

  await store.saveActiveTrip(trip);
}

async function finishStoredTrip({ store, trip, finishedAt }) {
  const finishedTrip = {
    ...clone(trip),
    status: "finished",
    timestamps: {
      ...trip.timestamps,
      finishedAt,
    },
  };

  await store.saveTrip(finishedTrip);
  await store.clearActiveTrip();
  return clone(finishedTrip);
}

function activeTripKey(keyPrefix) {
  return `${keyPrefix}.active`;
}

function tripKey(keyPrefix, tripId) {
  return `${keyPrefix}.finished.${tripId}`;
}

function readJson(storage, key) {
  const value = storage.getItem(key);
  return value ? JSON.parse(value) : null;
}

function ensureRecording(trip) {
  if (!trip || trip.status !== "recording") {
    throw new Error("Start a Trip before recording samples.");
  }
}

function clone(value) {
  return structuredClone(value);
}
