import test from "node:test";
import assert from "node:assert/strict";

import { detectComfortEvents } from "../src/comfort-events.js";

test("detects hard braking Comfort Events from longitudinal motion samples", () => {
  const events = detectComfortEvents({
    tripId: "trip-braking",
    status: "finished",
    streams: {
      motion: [
        motionSample(0, { y: -0.2 }),
        motionSample(250, { y: -2.9 }),
        motionSample(500, { y: -3.4 }),
        motionSample(750, { y: -0.4 }),
      ],
      gps: [],
    },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "hard-braking");
  assert.equal(events[0].startedAtMs, 250);
  assert.equal(events[0].endedAtMs, 500);
  assert.match(events[0].explanation, /braking/i);
  assert.deepEqual(events[0].metrics, {
    axis: "longitudinal",
    peakMetersPerSecondSquared: -3.4,
    peakAbsMetersPerSecondSquared: 3.4,
    peakJerkMetersPerSecondCubed: -10.8,
    peakAbsJerkMetersPerSecondCubed: 10.8,
    sampleCount: 2,
  });
});

test("detects strong acceleration Comfort Events from recorded-style motion data", () => {
  const events = detectComfortEvents({
    tripId: "trip-acceleration",
    status: "finished",
    streams: {
      motion: [
        motionSample(0, { y: 0.1 }),
        motionSample(200, { y: 1.1 }),
        motionSample(400, { y: 2.8 }),
        motionSample(600, { y: 3.1 }),
        motionSample(800, { y: 0.7 }),
        motionSample(1000, { y: -0.2 }),
      ],
      gps: [],
    },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "strong-acceleration");
  assert.equal(events[0].startedAtMs, 400);
  assert.equal(events[0].endedAtMs, 600);
  assert.match(events[0].explanation, /acceleration/i);
  assert.equal(events[0].metrics.axis, "longitudinal");
  assert.equal(events[0].metrics.peakMetersPerSecondSquared, 3.1);
  assert.equal(events[0].metrics.peakAbsMetersPerSecondSquared, 3.1);
  assert.equal(events[0].metrics.peakJerkMetersPerSecondCubed, 8.5);
  assert.equal(events[0].metrics.peakAbsJerkMetersPerSecondCubed, 8.5);
  assert.equal(events[0].metrics.sampleCount, 2);
});

test("detects uncomfortable turn Comfort Events from lateral acceleration patterns", () => {
  const events = detectComfortEvents({
    tripId: "trip-turn",
    status: "finished",
    streams: {
      motion: [
        motionSample(0, { x: 0.2 }),
        motionSample(250, { x: 2.4 }),
        motionSample(500, { x: 2.9 }),
        motionSample(750, { x: 2.3 }),
        motionSample(1000, { x: 0.3 }),
      ],
      gps: [],
    },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "uncomfortable-turn");
  assert.equal(events[0].startedAtMs, 250);
  assert.equal(events[0].endedAtMs, 750);
  assert.match(events[0].explanation, /turn/i);
  assert.deepEqual(events[0].metrics, {
    axis: "lateral",
    peakMetersPerSecondSquared: 2.9,
    peakAbsMetersPerSecondSquared: 2.9,
    peakJerkMetersPerSecondCubed: 8.8,
    peakAbsJerkMetersPerSecondCubed: 8.8,
    sampleCount: 3,
  });
});

test("detects abrupt lateral variation Comfort Events from synthetic motion streams", () => {
  const events = detectComfortEvents({
    tripId: "trip-abrupt-lateral",
    status: "finished",
    streams: {
      motion: [
        motionSample(0, { x: 0.1 }),
        motionSample(250, { x: 1.4 }),
        motionSample(500, { x: -1.5 }),
        motionSample(750, { x: -0.2 }),
      ],
      gps: [],
    },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "abrupt-lateral-variation");
  assert.equal(events[0].startedAtMs, 250);
  assert.equal(events[0].endedAtMs, 500);
  assert.match(events[0].explanation, /lateral/i);
  assert.deepEqual(events[0].metrics, {
    axis: "lateral",
    lateralDeltaMetersPerSecondSquared: -2.9,
    peakJerkMetersPerSecondCubed: -11.6,
    peakAbsJerkMetersPerSecondCubed: 11.6,
  });
});

test("detects isolated vertical impact Comfort Events with speed context", () => {
  const events = detectComfortEvents({
    tripId: "trip-vertical-impact",
    status: "finished",
    streams: {
      motion: [
        motionSample(0, { z: 0.1 }),
        motionSample(250, { z: 3.8 }),
        motionSample(500, { z: 0.2 }),
      ],
      gps: [
        gpsSample(0, 12.4),
        gpsSample(250, 13.1),
        gpsSample(500, 13.3),
      ],
    },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "vertical-impact");
  assert.equal(events[0].startedAtMs, 250);
  assert.equal(events[0].endedAtMs, 250);
  assert.match(events[0].explanation, /isolated vertical impact/i);
  assert.match(events[0].driverControl.interpretation, /single vertical impact/i);
  assert.deepEqual(events[0].metrics, {
    axis: "vertical",
    peakMetersPerSecondSquared: 3.8,
    peakAbsMetersPerSecondSquared: 3.8,
    peakJerkMetersPerSecondCubed: 14.8,
    peakAbsJerkMetersPerSecondCubed: 14.8,
    speedAtPeakMetersPerSecond: 13.1,
    sampleCount: 1,
  });
});

test("detects sustained rough-road Comfort Events separately from isolated impacts", () => {
  const events = detectComfortEvents({
    tripId: "trip-rough-road",
    status: "finished",
    streams: {
      motion: [
        motionSample(0, { z: 0.1 }),
        motionSample(250, { z: 3.7 }),
        motionSample(500, { z: 0.2 }),
        motionSample(1500, { z: 0.3 }),
        motionSample(1750, { z: 1.8 }),
        motionSample(2000, { z: -1.9 }),
        motionSample(2250, { z: 2.1 }),
        motionSample(2500, { z: -1.7 }),
        motionSample(2750, { z: 1.6 }),
        motionSample(3000, { z: 0.2 }),
      ],
      gps: [
        gpsSample(250, 12.5),
        gpsSample(1750, 11.9),
        gpsSample(2750, 9.7),
      ],
    },
  });

  assert.deepEqual(
    events.map((event) => event.type),
    ["vertical-impact", "rough-road-segment"],
  );

  const roughRoad = events[1];
  assert.equal(roughRoad.startedAtMs, 1750);
  assert.equal(roughRoad.endedAtMs, 2750);
  assert.match(roughRoad.explanation, /sustained rough-road/i);
  assert.equal(roughRoad.driverControl.speedResponse, "reduced");
  assert.match(roughRoad.driverControl.interpretation, /speed was reduced/i);
  assert.equal(roughRoad.metrics.speedAtStartMetersPerSecond, 11.9);
  assert.equal(roughRoad.metrics.speedAtEndMetersPerSecond, 9.7);
});

test("records maintained speed response during rough-road segments", () => {
  const events = detectComfortEvents({
    tripId: "trip-rough-road-maintained",
    status: "finished",
    streams: {
      motion: [
        motionSample(0, { z: 0.1 }),
        motionSample(250, { z: 1.6 }),
        motionSample(500, { z: -1.7 }),
        motionSample(750, { z: 1.9 }),
        motionSample(1000, { z: -1.6 }),
        motionSample(1250, { z: 0.2 }),
      ],
      gps: [
        gpsSample(250, 8.1),
        gpsSample(1000, 7.8),
      ],
    },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "rough-road-segment");
  assert.equal(events[0].driverControl.speedResponse, "maintained");
  assert.match(events[0].driverControl.interpretation, /speed was maintained/i);
});

function motionSample(timestamp, acceleration) {
  return {
    timestamp,
    acceleration: {
      x: acceleration.x ?? 0,
      y: acceleration.y ?? 0,
      z: acceleration.z ?? 0,
    },
  };
}

function gpsSample(timestamp, speedMetersPerSecond) {
  return {
    timestamp,
    latitude: 0,
    longitude: 0,
    speedMetersPerSecond,
    accuracyMeters: 8,
  };
}
