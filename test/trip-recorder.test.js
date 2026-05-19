import test from "node:test";
import assert from "node:assert/strict";

import {
  createLocalStorageTripStore,
  createMemoryTripStore,
  createTripRecorder,
  getOrCreateLocalDeviceId,
  recoverInterruptedTrip,
} from "../src/trip-recorder.js";

test("Trip recorder stores local identifiers and separate timestamped motion and GPS streams", async () => {
  const store = createMemoryTripStore();
  const recorder = createTripRecorder({
    store,
    now: sequenceClock("2026-05-19T10:00:00.000Z"),
    createTripId: () => "trip-123",
    deviceId: "device-local",
  });

  const trip = await recorder.startTrip({ mountingMode: "fixed-mount" });

  recorder.recordMotionSample({
    timestamp: 100,
    acceleration: { x: 0.1, y: 0.2, z: -0.1 },
  });
  recorder.recordGpsSample({
    timestamp: 250,
    latitude: -34.9285,
    longitude: 138.6007,
    speedMetersPerSecond: 12.4,
    accuracyMeters: 8,
  });

  await recorder.flush();

  const persisted = await store.loadActiveTrip();

  assert.equal(trip.tripId, "trip-123");
  assert.equal(persisted.schemaVersion, "1");
  assert.equal(persisted.tripId, "trip-123");
  assert.equal(persisted.deviceId, "device-local");
  assert.equal(persisted.mountingMode, "fixed-mount");
  assert.equal(persisted.status, "recording");
  assert.equal(persisted.timestamps.startedAt, "2026-05-19T10:00:00.000Z");
  assert.deepEqual(persisted.streams.motion, [
    {
      timestamp: 100,
      acceleration: { x: 0.1, y: 0.2, z: -0.1 },
    },
  ]);
  assert.deepEqual(persisted.streams.gps, [
    {
      timestamp: 250,
      latitude: -34.9285,
      longitude: 138.6007,
      speedMetersPerSecond: 12.4,
      accuracyMeters: 8,
    },
  ]);
});

test("Trip recorder persists samples in local batches without merging motion and GPS frequencies", async () => {
  const store = createMemoryTripStore();
  const recorder = createTripRecorder({
    store,
    now: sequenceClock("2026-05-19T10:00:00.000Z"),
    createTripId: () => "trip-batched",
    deviceId: "device-local",
    batchSize: 3,
  });

  await recorder.startTrip({ mountingMode: "horizontal-console" });

  await recorder.recordMotionSample({ timestamp: 0, acceleration: { x: 0, y: 0, z: 0 } });
  await recorder.recordMotionSample({ timestamp: 20, acceleration: { x: 0.1, y: 0, z: 0 } });

  assert.equal(store.writes.length, 1);

  await recorder.recordGpsSample({
    timestamp: 1000,
    latitude: -34.9285,
    longitude: 138.6007,
    accuracyMeters: 7,
  });

  const persisted = await store.loadActiveTrip();

  assert.equal(store.writes.length, 2);
  assert.equal(recorder.pendingSamples, 0);
  assert.deepEqual(
    persisted.streams.motion.map((sample) => sample.timestamp),
    [0, 20],
  );
  assert.deepEqual(
    persisted.streams.gps.map((sample) => sample.timestamp),
    [1000],
  );
});

test("finishing a Trip flushes pending samples and clears interrupted recovery", async () => {
  const store = createMemoryTripStore();
  const recorder = createTripRecorder({
    store,
    now: sequenceClock("2026-05-19T10:00:00.000Z", "2026-05-19T10:12:00.000Z"),
    createTripId: () => "trip-finished",
    deviceId: "device-local",
    batchSize: 10,
  });

  await recorder.startTrip({ mountingMode: "fixed-mount" });
  await recorder.recordMotionSample({
    timestamp: 120,
    acceleration: { x: -0.2, y: 0, z: 0.1 },
  });

  const finished = await recorder.finishTrip();

  assert.equal(finished.status, "finished");
  assert.equal(finished.timestamps.finishedAt, "2026-05-19T10:12:00.000Z");
  assert.equal(recorder.pendingSamples, 0);
  assert.equal(await store.loadActiveTrip(), null);
  assert.deepEqual((await store.loadTrip("trip-finished")).streams.motion, [
    {
      timestamp: 120,
      acceleration: { x: -0.2, y: 0, z: 0.1 },
    },
  ]);
});

test("interrupted Trip recovery can continue, finish with existing data, or discard", async () => {
  const interruptedTrip = {
    schemaVersion: "1",
    tripId: "trip-interrupted",
    deviceId: "device-local",
    mountingMode: "fixed-mount",
    status: "recording",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: null,
    },
    streams: {
      motion: [{ timestamp: 0, acceleration: { x: 0, y: 0, z: 0 } }],
      gps: [],
    },
    confidenceMarkers: [],
  };
  const store = createMemoryTripStore(interruptedTrip);

  const recovery = await recoverInterruptedTrip({
    store,
    now: sequenceClock("2026-05-19T10:08:00.000Z"),
  });

  assert.equal(recovery.hasInterruptedTrip, true);
  assert.deepEqual(recovery.actions, ["continue", "finish", "discard"]);

  const continued = await recovery.continueTrip({ batchSize: 5 });
  await continued.recordGpsSample({
    timestamp: 1000,
    latitude: -34.9285,
    longitude: 138.6007,
    accuracyMeters: 6,
  });
  await continued.flush();

  assert.equal((await store.loadActiveTrip()).tripId, "trip-interrupted");
  assert.equal((await store.loadActiveTrip()).streams.gps.length, 1);

  const finishRecovery = await recoverInterruptedTrip({
    store,
    now: sequenceClock("2026-05-19T10:09:00.000Z"),
  });
  const finished = await finishRecovery.finishTrip();

  assert.equal(finished.status, "finished");
  assert.equal(finished.timestamps.finishedAt, "2026-05-19T10:09:00.000Z");
  assert.equal(await store.loadActiveTrip(), null);

  const discardStore = createMemoryTripStore(interruptedTrip);
  const discardRecovery = await recoverInterruptedTrip({ store: discardStore });

  await discardRecovery.discardTrip();

  assert.equal(await discardStore.loadActiveTrip(), null);
  assert.equal(await discardStore.loadTrip("trip-interrupted"), null);
});

test("local Trip store survives reloads and keeps a stable local device id", async () => {
  const storage = createFakeStorage();
  const store = createLocalStorageTripStore(storage);
  const activeTrip = {
    schemaVersion: "1",
    tripId: "trip-local",
    deviceId: "device-local",
    mountingMode: "fixed-mount",
    status: "recording",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: null,
    },
    streams: {
      motion: [{ timestamp: 0, acceleration: { x: 0, y: 0, z: 0 } }],
      gps: [],
    },
    confidenceMarkers: [],
  };

  await store.saveActiveTrip(activeTrip);

  const reloadedStore = createLocalStorageTripStore(storage);

  assert.deepEqual(await reloadedStore.loadActiveTrip(), activeTrip);

  await reloadedStore.saveTrip({ ...activeTrip, status: "finished" });
  await reloadedStore.clearActiveTrip();

  assert.equal(await reloadedStore.loadActiveTrip(), null);
  assert.equal((await reloadedStore.loadTrip("trip-local")).status, "finished");

  const deviceId = getOrCreateLocalDeviceId(storage, () => "device-generated");

  assert.equal(deviceId, "device-generated");
  assert.equal(getOrCreateLocalDeviceId(storage, () => "device-next"), "device-generated");
});

function createFakeStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function sequenceClock(...timestamps) {
  let index = 0;

  return () => timestamps[Math.min(index++, timestamps.length - 1)];
}
