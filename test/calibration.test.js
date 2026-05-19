import test from "node:test";
import assert from "node:assert/strict";

import { calibrateStoppedPhone } from "../src/calibration.js";

function stableHorizontalSamples() {
  return Array.from({ length: 16 }, (_, index) => ({
    timestamp: index * 100,
    accelerationIncludingGravity: {
      x: index % 2 === 0 ? 0.02 : -0.01,
      y: index % 3 === 0 ? 0.01 : -0.02,
      z: 9.81 + (index % 2 === 0 ? 0.01 : -0.01),
    },
  }));
}

function tiltedHorizontalSamples() {
  return Array.from({ length: 16 }, (_, index) => ({
    timestamp: index * 100,
    accelerationIncludingGravity: {
      x: 3.36 + (index % 2 === 0 ? 0.01 : -0.01),
      y: index % 3 === 0 ? 0.01 : -0.01,
      z: 9.21 + (index % 2 === 0 ? 0.01 : -0.01),
    },
  }));
}

function unstableHorizontalSamples() {
  return Array.from({ length: 16 }, (_, index) => ({
    timestamp: index * 100,
    accelerationIncludingGravity: {
      x: index % 2 === 0 ? 0.9 : -0.9,
      y: index % 3 === 0 ? 0.55 : -0.55,
      z: 9.81 + (index % 2 === 0 ? 0.35 : -0.35),
    },
  }));
}

function slippedPhoneSamples() {
  return Array.from({ length: 16 }, (_, index) => {
    const slipped = index >= 8;

    return {
      timestamp: index * 100,
      accelerationIncludingGravity: {
        x: slipped ? 2.35 : 0.02,
        y: slipped ? 0.4 : -0.01,
        z: slipped ? 9.52 : 9.81,
      },
    };
  });
}

test("horizontal console calibration allows a high-confidence start when the stopped phone is level and stable", () => {
  const calibration = calibrateStoppedPhone({
    mountingMode: "horizontal-console",
    samples: stableHorizontalSamples(),
  });

  assert.equal(calibration.mountingMode, "horizontal-console");
  assert.equal(calibration.confidence, "high");
  assert.equal(calibration.canStartHighConfidence, true);
  assert.deepEqual(calibration.warnings, []);
  assert.deepEqual(calibration.confidenceMarkers, []);
  assert.ok(calibration.placement.levelDegrees < 5);
  assert.ok(calibration.stability.rmsNoise < 0.05);
});

test("horizontal console calibration warns when the stopped phone is too tilted for high confidence", () => {
  const calibration = calibrateStoppedPhone({
    mountingMode: "horizontal-console",
    samples: tiltedHorizontalSamples(),
  });

  assert.equal(calibration.confidence, "low");
  assert.equal(calibration.canStartHighConfidence, false);
  assert.match(calibration.warnings.join("\n"), /level/i);
  assert.equal(calibration.confidenceMarkers[0].type, "tilted-phone");
  assert.equal(calibration.confidenceMarkers[0].severity, "medium");
  assert.ok(calibration.placement.levelDegrees > 15);
});

test("horizontal console calibration warns when the stopped phone is unstable", () => {
  const calibration = calibrateStoppedPhone({
    mountingMode: "horizontal-console",
    samples: unstableHorizontalSamples(),
  });

  assert.equal(calibration.confidence, "low");
  assert.equal(calibration.canStartHighConfidence, false);
  assert.match(calibration.warnings.join("\n"), /stable/i);
  assert.equal(calibration.confidenceMarkers[0].type, "unstable-phone");
  assert.equal(calibration.confidenceMarkers[0].severity, "medium");
  assert.ok(calibration.stability.rmsNoise > 0.75);
});

test("calibration marks data when the stopped phone moves or slips during setup", () => {
  const calibration = calibrateStoppedPhone({
    mountingMode: "fixed-mount",
    samples: slippedPhoneSamples(),
  });

  assert.equal(calibration.confidence, "low");
  assert.equal(calibration.canStartHighConfidence, false);
  assert.match(calibration.warnings.join("\n"), /moved|slipped/i);
  assert.equal(calibration.confidenceMarkers[0].type, "moved-phone");
  assert.equal(calibration.confidenceMarkers[0].severity, "high");
  assert.ok(calibration.placement.driftDegrees > 10);
});
