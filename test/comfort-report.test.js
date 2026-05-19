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
