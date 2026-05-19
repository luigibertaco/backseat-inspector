import test from "node:test";
import assert from "node:assert/strict";

import { createComfortReport } from "../src/comfort-report.js";

test("Comfort Report calculates GPS aggregates from a finished Trip", () => {
  const report = createComfortReport({
    tripId: "trip-gps",
    status: "finished",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: "2026-05-19T10:02:00.000Z",
    },
    streams: {
      motion: [],
      gps: [
        {
          timestamp: 0,
          latitude: 0,
          longitude: 0,
          speedMetersPerSecond: 1.2,
          accuracyMeters: 8,
        },
        {
          timestamp: 60000,
          latitude: 0,
          longitude: 0.001,
          speedMetersPerSecond: 2.4,
          accuracyMeters: 42,
        },
        {
          timestamp: 120000,
          latitude: 0,
          longitude: 0.002,
          speedMetersPerSecond: 3.6,
          accuracyMeters: 12,
        },
      ],
    },
  });

  assert.equal(report.tripId, "trip-gps");
  assert.equal(report.durationSeconds, 120);
  assert.equal(report.gps.pointCount, 3);
  assert.equal(report.gps.lowAccuracySamplePercentage, 33);
  assert.equal(report.gps.maximumSpeedMetersPerSecond, 3.6);
  assert.ok(report.gps.approximateDistanceMeters > 222);
  assert.ok(report.gps.approximateDistanceMeters < 223);
  assert.ok(report.gps.averageSpeedMetersPerSecond > 1.85);
  assert.ok(report.gps.averageSpeedMetersPerSecond < 1.86);
});

test("Comfort Report includes detected Comfort Events with explanations and intensity metrics", () => {
  const report = createComfortReport({
    tripId: "trip-events",
    status: "finished",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: "2026-05-19T10:00:02.000Z",
    },
    streams: {
      motion: [
        { timestamp: 0, acceleration: { x: 0, y: 0, z: 0 } },
        { timestamp: 500, acceleration: { x: 0, y: -3.2, z: 0 } },
        { timestamp: 1000, acceleration: { x: 0, y: -0.2, z: 0 } },
      ],
      gps: [],
    },
  });

  assert.equal(report.comfortEvents.length, 1);
  assert.equal(report.comfortEvents[0].type, "hard-braking");
  assert.match(report.comfortEvents[0].explanation, /braking/i);
  assert.equal(report.comfortEvents[0].metrics.axis, "longitudinal");
  assert.equal(report.comfortEvents[0].metrics.peakAbsMetersPerSecondSquared, 3.2);
});

test("Comfort Report includes vertical event speed context and Driver Control interpretation", () => {
  const report = createComfortReport({
    tripId: "trip-rough-road",
    status: "finished",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: "2026-05-19T10:00:02.000Z",
    },
    streams: {
      motion: [
        { timestamp: 0, acceleration: { x: 0, y: 0, z: 0.1 } },
        { timestamp: 250, acceleration: { x: 0, y: 0, z: 1.7 } },
        { timestamp: 500, acceleration: { x: 0, y: 0, z: -1.8 } },
        { timestamp: 750, acceleration: { x: 0, y: 0, z: 1.9 } },
        { timestamp: 1000, acceleration: { x: 0, y: 0, z: -1.6 } },
        { timestamp: 1250, acceleration: { x: 0, y: 0, z: 0.2 } },
      ],
      gps: [
        {
          timestamp: 250,
          latitude: 0,
          longitude: 0,
          speedMetersPerSecond: 10.2,
          accuracyMeters: 8,
        },
        {
          timestamp: 1000,
          latitude: 0,
          longitude: 0.001,
          speedMetersPerSecond: 8.6,
          accuracyMeters: 8,
        },
      ],
    },
  });

  assert.equal(report.comfortEvents.length, 1);
  assert.equal(report.comfortEvents[0].type, "rough-road-segment");
  assert.equal(report.comfortEvents[0].driverControl.speedResponse, "reduced");
  assert.match(report.comfortEvents[0].driverControl.interpretation, /Driver Control/);
  assert.equal(report.comfortEvents[0].metrics.speedAtStartMetersPerSecond, 10.2);
  assert.equal(report.comfortEvents[0].metrics.speedAtEndMetersPerSecond, 8.6);
});
