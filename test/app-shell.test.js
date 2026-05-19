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
