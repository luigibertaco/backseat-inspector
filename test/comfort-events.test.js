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
