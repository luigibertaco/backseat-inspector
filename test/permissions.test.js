import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserPermissionFlow, createPermissionFlow } from "../src/permissions.js";

test("permission flow waits for an explicit user action before requesting access", async () => {
  const calls = [];
  const flow = createPermissionFlow({
    motion: {
      isAvailable: true,
      requestPermission: async () => {
        calls.push("motion");
        return "granted";
      },
    },
    location: {
      isAvailable: true,
      requestCurrentPosition: async () => {
        calls.push("location");
        return { coords: { accuracy: 12 } };
      },
    },
  });

  assert.deepEqual(calls, []);
  assert.equal(flow.snapshot().motion.permission, "not-requested");
  assert.equal(flow.snapshot().gps.permission, "not-requested");

  await flow.requestFromUserAction();

  assert.deepEqual(calls, ["motion", "location"]);
});

test("permission flow reports granted sensor and active GPS diagnostics", async () => {
  const flow = createPermissionFlow({
    motion: { isAvailable: true, requestPermission: async () => "granted" },
    orientation: { isAvailable: true, requestPermission: async () => "granted" },
    gyroscope: { isAvailable: true },
    location: {
      isAvailable: true,
      requestCurrentPosition: async () => ({ coords: { accuracy: 8 } }),
    },
  });

  const diagnostics = await flow.requestFromUserAction();

  assert.equal(diagnostics.motion.permission, "granted");
  assert.equal(diagnostics.orientation.permission, "granted");
  assert.equal(diagnostics.gyroscope.availability, "available");
  assert.equal(diagnostics.gps.permission, "granted");
  assert.equal(diagnostics.gps.active, true);
  assert.equal(diagnostics.gps.accuracyMeters, 8);
});

test("permission flow reports denied sensor and GPS diagnostics", async () => {
  const flow = createPermissionFlow({
    motion: { isAvailable: true, requestPermission: async () => "denied" },
    orientation: { isAvailable: true, requestPermission: async () => "denied" },
    location: {
      isAvailable: true,
      requestCurrentPosition: async () => {
        throw new Error("denied");
      },
    },
  });

  const diagnostics = await flow.requestFromUserAction();

  assert.equal(diagnostics.motion.permission, "denied");
  assert.equal(diagnostics.orientation.permission, "denied");
  assert.equal(diagnostics.gps.permission, "denied");
  assert.equal(diagnostics.gps.active, false);
});

test("permission flow reports unavailable browser capabilities", async () => {
  const flow = createPermissionFlow();

  const diagnostics = await flow.requestFromUserAction();

  assert.equal(diagnostics.motion.permission, "unavailable");
  assert.equal(diagnostics.orientation.permission, "unavailable");
  assert.equal(diagnostics.gyroscope.permission, "unavailable");
  assert.equal(diagnostics.gps.permission, "unavailable");
});

test("browser permission flow adapts sensor and geolocation APIs", async () => {
  const calls = [];
  const flow = createBrowserPermissionFlow({
    DeviceMotionEvent: {
      requestPermission: async () => {
        calls.push("motion");
        return "granted";
      },
    },
    DeviceOrientationEvent: {
      requestPermission: async () => {
        calls.push("orientation");
        return "denied";
      },
    },
    Gyroscope: function Gyroscope() {},
    navigator: {
      geolocation: {
        getCurrentPosition: (resolve) => {
          calls.push("location");
          resolve({ coords: { accuracy: 14 } });
        },
      },
    },
  });

  assert.equal(flow.snapshot().motion.permission, "not-requested");

  const diagnostics = await flow.requestFromUserAction();

  assert.deepEqual(calls, ["motion", "orientation", "location"]);
  assert.equal(diagnostics.motion.permission, "granted");
  assert.equal(diagnostics.orientation.permission, "denied");
  assert.equal(diagnostics.gyroscope.availability, "available");
  assert.equal(diagnostics.gps.active, true);
});
