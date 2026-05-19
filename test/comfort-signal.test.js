import test from "node:test";
import assert from "node:assert/strict";

import { createComfortSignal } from "../src/comfort-signal.js";

test("Comfort Signal smooths peaks and decays after a brief hold", () => {
  const signal = createComfortSignal({
    holdMs: 500,
    decayPerSecond: 0.5,
    smoothing: 1,
  });

  assert.equal(signal.snapshot().tone, "calm");

  const peak = signal.observeMotionSample({
    timestamp: 1000,
    acceleration: { x: 3.4, y: 0, z: 0 },
  });

  assert.equal(peak.tone, "strong");

  const held = signal.tick(1300);

  assert.equal(held.tone, "strong");

  const decayed = signal.tick(2500);

  assert.equal(decayed.tone, "noticeable");
  assert.ok(decayed.level < peak.level);
});

test("Comfort Signal maps motion intensity to threshold color tones", () => {
  const signal = createComfortSignal({ smoothing: 1 });

  assert.equal(
    signal.observeMotionSample({
      timestamp: 1000,
      acceleration: { x: 0.18, y: 0, z: 0 },
    }).tone,
    "calm",
  );
  assert.equal(
    signal.observeMotionSample({
      timestamp: 1100,
      acceleration: { x: 1.2, y: 0, z: 0 },
    }).tone,
    "noticeable",
  );
  assert.equal(
    signal.observeMotionSample({
      timestamp: 1200,
      acceleration: { x: 2.2, y: 0, z: 0 },
    }).tone,
    "uncomfortable",
  );
  assert.equal(
    signal.observeMotionSample({
      timestamp: 1300,
      acceleration: { x: 3.2, y: 0, z: 0 },
    }).tone,
    "strong",
  );
});
