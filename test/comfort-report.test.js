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
  assert.equal(report.comfortEvents[0].eventId, "hard-braking-500-500-0");
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

test("Comfort Report includes Raw View and Trusted View without deleting raw events", () => {
  const report = createComfortReport(tripWithEventsAndConfidenceMarkers());

  assert.equal(report.comfortEvents.length, 2);
  assert.equal(report.confidenceMarkers.length, 1);
  assert.equal(report.rawView.label, "Raw View");
  assert.equal(report.trustedView.label, "Trusted View");
  assert.equal(report.rawView.comfortEvents.length, 2);
  assert.equal(report.trustedView.comfortEvents.length, 2);
  assert.equal(report.rawView.confidenceMarkers.length, 1);
  assert.equal(report.trustedView.confidenceMarkers.length, 1);
  assert.equal(report.trustedView.confidenceAdjustment.eventImpactMultiplier, 0.45);
  assert.match(report.trustedView.confidenceAdjustment.explanation, /reduced/i);
});

test("Comfort Index is experimental and changes classification when Confidence Markers reduce event influence", () => {
  const report = createComfortReport(tripWithEventsAndConfidenceMarkers());

  assert.equal(report.rawView.passengerComfort.comfortIndex.experimental, true);
  assert.equal(report.rawView.passengerComfort.comfortIndex.score, 64);
  assert.equal(report.rawView.passengerComfort.comfortIndex.classification, "Mixed comfort");
  assert.equal(report.trustedView.passengerComfort.comfortIndex.score, 84);
  assert.equal(
    report.trustedView.passengerComfort.comfortIndex.classification,
    "Mostly comfortable",
  );
});

test("Comfort Report separates Passenger Comfort from Driver Control", () => {
  const report = createComfortReport(tripWithEventsAndConfidenceMarkers());

  assert.equal(report.rawView.passengerComfort.eventCount, 2);
  assert.equal(report.rawView.driverControl.interpretations.length, 1);
  assert.match(report.rawView.driverControl.interpretations[0], /speed was reduced/i);
});

function tripWithEventsAndConfidenceMarkers() {
  return {
    tripId: "trip-index",
    status: "finished",
    timestamps: {
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: "2026-05-19T10:00:04.000Z",
    },
    confidenceMarkers: [
      {
        type: "moved-phone",
        severity: "high",
        reason: "Stopped-phone calibration detected a placement change while parked.",
      },
    ],
    streams: {
      motion: [
        { timestamp: 0, acceleration: { x: 0, y: 0, z: 0.1 } },
        { timestamp: 250, acceleration: { x: 0, y: -3.2, z: 0.1 } },
        { timestamp: 500, acceleration: { x: 0, y: -0.2, z: 0.1 } },
        { timestamp: 1250, acceleration: { x: 0, y: 0, z: 1.8 } },
        { timestamp: 1500, acceleration: { x: 0, y: 0, z: -1.9 } },
        { timestamp: 1750, acceleration: { x: 0, y: 0, z: 2.1 } },
        { timestamp: 2000, acceleration: { x: 0, y: 0, z: -1.7 } },
        { timestamp: 2250, acceleration: { x: 0, y: 0, z: 1.6 } },
        { timestamp: 2500, acceleration: { x: 0, y: 0, z: 0.2 } },
      ],
      gps: [
        {
          timestamp: 1250,
          latitude: 0,
          longitude: 0,
          speedMetersPerSecond: 11.9,
          accuracyMeters: 8,
        },
        {
          timestamp: 2250,
          latitude: 0,
          longitude: 0.001,
          speedMetersPerSecond: 9.7,
          accuracyMeters: 8,
        },
      ],
    },
  };
}
