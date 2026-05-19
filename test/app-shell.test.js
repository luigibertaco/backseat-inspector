import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createAppShell, renderAppShell } from "../src/app-shell.js";

test("app shell starts in the Start state with paths for Trip and Comfort Report", () => {
  const shell = createAppShell();

  assert.equal(shell.currentScreen.id, "start");
  assert.equal(shell.currentScreen.title, "Start Trip");
  assert.deepEqual(
    shell.screens.map((screen) => screen.id),
    ["start", "recording", "comfort-report"],
  );
});

test("start flow supports fixed mount and horizontal console mounting modes", () => {
  const shell = createAppShell();

  assert.equal(shell.currentMountingMode.id, "fixed-mount");

  shell.selectMountingMode("horizontal-console");

  assert.equal(shell.currentMountingMode.id, "horizontal-console");

  const html = renderAppShell(shell);

  assert.match(html, /Fixed mount/);
  assert.match(html, /Horizontal console/);
  assert.match(html, /data-mounting-mode="horizontal-console" aria-pressed="true"/);
});

test("app shell advances through the Trip flow", () => {
  const shell = createAppShell();

  shell.activatePrimaryAction();
  assert.equal(shell.currentScreen.id, "recording");

  shell.activatePrimaryAction();
  assert.equal(shell.currentScreen.id, "comfort-report");
});

test("start screen shows permission and GPS diagnostics", () => {
  const html = renderAppShell(createAppShell(), {
    motion: { availability: "available", permission: "not-requested" },
    orientation: { availability: "available", permission: "granted" },
    gyroscope: { availability: "unavailable", permission: "unavailable" },
    gps: {
      availability: "available",
      permission: "granted",
      active: true,
      accuracyMeters: 8,
    },
  });

  assert.match(html, /Motion/);
  assert.match(html, /Not requested/);
  assert.match(html, /Orientation/);
  assert.match(html, /Granted/);
  assert.match(html, /Gyroscope/);
  assert.match(html, /Unavailable/);
  assert.match(html, /GPS/);
  assert.match(html, /Active \(8 m accuracy\)/);
});

test("start screen offers interrupted Trip recovery actions", () => {
  const html = renderAppShell(createAppShell(), null, {
    recovery: {
      hasInterruptedTrip: true,
      trip: {
        tripId: "trip-interrupted",
        timestamps: {
          startedAt: "2026-05-19T10:00:00.000Z",
        },
      },
      actions: ["continue", "finish", "discard"],
    },
  });

  assert.match(html, /Interrupted Trip/);
  assert.match(html, /Continue Trip/);
  assert.match(html, /Finish With Existing Data/);
  assert.match(html, /Discard Trip/);
  assert.match(html, /data-trip-recovery="continue"/);
});

test("recording screen stays minimal with wake lock status and finish action", () => {
  const html = renderAppShell(createAppShell("recording"), null, {
    activeTrip: {
      status: "recording",
      streams: {
        motion: [{ timestamp: 0 }],
        gps: [{ timestamp: 1000 }, { timestamp: 2000 }],
      },
    },
    wakeLock: {
      state: "active",
      label: "Active",
    },
  });

  assert.match(html, /Trip recording status/);
  assert.match(html, /Motion Samples/);
  assert.match(html, /GPS Samples/);
  assert.match(html, /Wake Lock/);
  assert.match(html, /Active/);
  assert.match(html, /Finish Trip/);
  assert.doesNotMatch(html, /data-screen="start"/);
});

test("Comfort Report screen shows GPS aggregates for a finished Trip without unsupported claims", () => {
  const html = renderAppShell(createAppShell("comfort-report"), null, {
    activeTrip: {
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
    },
  });

  assert.match(html, /Comfort Report/);
  assert.match(html, /Duration/);
  assert.match(html, /2 min 0 sec/);
  assert.match(html, /Approximate Distance/);
  assert.match(html, /222 m/);
  assert.match(html, /Average Speed/);
  assert.match(html, /6\.7 km\/h/);
  assert.match(html, /Maximum Speed/);
  assert.match(html, /13\.0 km\/h/);
  assert.match(html, /GPS Points/);
  assert.match(html, /3/);
  assert.match(html, /Low-accuracy Samples/);
  assert.match(html, /33%/);
  assert.doesNotMatch(html, /safety|danger|fuel economy|efficiency/i);
});

test("Comfort Report screen renders detected Comfort Events with intensity details", () => {
  const html = renderAppShell(createAppShell("comfort-report"), null, {
    activeTrip: {
      tripId: "trip-events",
      status: "finished",
      timestamps: {
        startedAt: "2026-05-19T10:00:00.000Z",
        finishedAt: "2026-05-19T10:00:02.000Z",
      },
      streams: {
        motion: [
          { timestamp: 0, acceleration: { x: 0, y: 0, z: 0 } },
          { timestamp: 500, acceleration: { x: 2.5, y: 0, z: 0 } },
          { timestamp: 750, acceleration: { x: 2.8, y: 0, z: 0 } },
          { timestamp: 1000, acceleration: { x: 0.1, y: 0, z: 0 } },
        ],
        gps: [],
      },
    },
  });

  assert.match(html, /Comfort Events/);
  assert.match(html, /Uncomfortable turn/);
  assert.match(html, /sustained lateral acceleration/i);
  assert.match(html, /Peak lateral intensity/);
  assert.match(html, /2\.8 m\/s\^2/);
  assert.match(html, /Peak lateral jerk/);
  assert.match(html, /5\.0 m\/s\^3/);
  assert.doesNotMatch(html, /safety|danger|fuel economy|efficiency/i);
});

test("Comfort Report screen renders vertical Driver Control and speed response details", () => {
  const html = renderAppShell(createAppShell("comfort-report"), null, {
    activeTrip: {
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
    },
  });

  assert.match(html, /Rough-road segment/);
  assert.match(html, /Driver Control/);
  assert.match(html, /speed was reduced/i);
  assert.match(html, /Start speed/);
  assert.match(html, /36\.7 km\/h/);
  assert.match(html, /End speed/);
  assert.match(html, /31\.0 km\/h/);
  assert.match(html, /Speed response/);
  assert.match(html, /Reduced/);
  assert.doesNotMatch(html, /safety|danger|fuel economy|efficiency/i);
});

test("recording screen uses Comfort Signal as ambient color without live scoring language", () => {
  const html = renderAppShell(createAppShell("recording"), null, {
    activeTrip: {
      status: "recording",
      streams: {
        motion: [],
        gps: [],
      },
    },
    comfortSignal: {
      tone: "strong",
      className: "comfort-signal-strong",
    },
  });

  assert.match(html, /app-panel[^"]*comfort-signal-strong/);
  assert.doesNotMatch(html, /Comfort Index/);
  assert.doesNotMatch(html, /safety/i);
  assert.doesNotMatch(html, /warning/i);
});

test("static entrypoint mounts the app shell with a browser module", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /<main[^>]+id="app"/);
  assert.match(html, /<script type="module" src="\.\/src\/main\.js"><\/script>/);
});

test("project exposes local development and test commands", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(packageJson.scripts.dev, "node scripts/serve-static.js");
  assert.equal(packageJson.scripts.test, "node --test");
});
