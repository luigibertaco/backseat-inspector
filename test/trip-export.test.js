import test from "node:test";
import assert from "node:assert/strict";

import { createTripDatasetExportJson } from "../src/trip-export.js";

test("Trip dataset export JSON preserves full Trip data and derived Comfort Report data deterministically", () => {
  const trip = {
    schemaVersion: "1",
    tripId: "trip-export",
    deviceId: "device-local",
    mountingMode: "fixed-mount",
    status: "finished",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: "2026-05-19T10:00:02.000Z",
    },
    confidenceMarkers: [
      {
        type: "low-gps-accuracy",
        severity: "medium",
        reason: "GPS accuracy was reduced near tall buildings.",
      },
    ],
    streams: {
      motion: [
        { timestamp: 0, acceleration: { x: 0, y: 0, z: 0 } },
        { timestamp: 500, acceleration: { x: 0, y: -3.2, z: 0 } },
        { timestamp: 1000, acceleration: { x: 0, y: -0.2, z: 0 } },
      ],
      gps: [
        {
          timestamp: 0,
          latitude: -34.9285,
          longitude: 138.6007,
          speedMetersPerSecond: 10,
          accuracyMeters: 8,
        },
        {
          timestamp: 1000,
          latitude: -34.929,
          longitude: 138.6012,
          speedMetersPerSecond: 9.4,
          accuracyMeters: 44,
        },
      ],
    },
    tripReview: {
      eventLabels: [
        {
          eventType: "hard-braking",
          startedAtMs: 500,
          label: "correct",
          note: "Felt abrupt from the back seat.",
        },
      ],
      wholeTripComfort: "mixed",
      perceivedAppAccuracy: "mostly-right",
      missedComfortEvents: ["sharp lane change near the end"],
      notes: "Keep as a tuning fixture.",
    },
  };

  const firstJson = createTripDatasetExportJson(trip, { algorithmVersion: "comfort-v1" });
  const secondJson = createTripDatasetExportJson(trip, { algorithmVersion: "comfort-v1" });
  const exported = JSON.parse(firstJson);

  assert.equal(firstJson, secondJson);
  assert.equal(exported.schemaVersion, "1");
  assert.equal(exported.algorithmVersion, "comfort-v1");
  assert.equal(exported.tripId, "trip-export");
  assert.equal(exported.deviceId, "device-local");
  assert.equal(exported.mountingMode, "fixed-mount");
  assert.deepEqual(exported.timestamps, trip.timestamps);
  assert.deepEqual(exported.streams.motion, trip.streams.motion);
  assert.deepEqual(exported.streams.gps, trip.streams.gps);
  assert.equal(exported.comfortEvents[0].type, "hard-braking");
  assert.deepEqual(exported.confidenceMarkers, trip.confidenceMarkers);
  assert.equal(exported.comfortReport.tripId, "trip-export");
  assert.equal(exported.comfortReport.rawView.capturedData.motionSampleCount, 3);
  assert.equal(exported.comfortReport.rawView.capturedData.gpsSampleCount, 2);
  assert.deepEqual(exported.tripReview, trip.tripReview);
});
