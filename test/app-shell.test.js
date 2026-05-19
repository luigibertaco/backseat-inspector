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
