import test from "node:test";
import assert from "node:assert/strict";

import { createWakeLockController } from "../src/wake-lock.js";

test("wake lock controller requests a screen wake lock and reports active status", async () => {
  const sentinel = createWakeLockSentinel();
  const requests = [];
  const controller = createWakeLockController({
    wakeLock: {
      request: async (type) => {
        requests.push(type);
        return sentinel;
      },
    },
  });

  const status = await controller.request();

  assert.deepEqual(requests, ["screen"]);
  assert.equal(status.state, "active");
  assert.equal(controller.snapshot().state, "active");

  sentinel.releaseFromBrowser();

  assert.equal(controller.snapshot().state, "released");
});

test("wake lock controller reports unavailable when the browser has no wake lock support", async () => {
  const controller = createWakeLockController();

  const status = await controller.request();

  assert.equal(status.state, "unavailable");
  assert.equal(status.label, "Unavailable");
});

test("wake lock controller reacquires a released wake lock when the page becomes visible", async () => {
  const firstSentinel = createWakeLockSentinel();
  const secondSentinel = createWakeLockSentinel();
  const sentinels = [firstSentinel, secondSentinel];
  const document = createFakeDocument();
  const controller = createWakeLockController({
    document,
    wakeLock: {
      request: async () => sentinels.shift(),
    },
  });

  controller.bindVisibilityRecovery();
  await controller.request();

  document.visibilityState = "hidden";
  firstSentinel.releaseFromBrowser();
  document.emit("visibilitychange");

  assert.equal(controller.snapshot().state, "released");

  document.visibilityState = "visible";
  document.emit("visibilitychange");
  await document.flushAsyncHandlers();

  assert.equal(controller.snapshot().state, "active");
});

function createWakeLockSentinel() {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    releaseFromBrowser() {
      listeners.get("release")?.();
    },
    async release() {
      this.releaseFromBrowser();
    },
  };
}

function createFakeDocument() {
  const listeners = new Map();
  const pending = [];

  return {
    visibilityState: "visible",
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    emit(type) {
      const result = listeners.get(type)?.();

      if (result?.then) {
        pending.push(result);
      }
    },
    async flushAsyncHandlers() {
      await Promise.all(pending.splice(0));
    },
  };
}
