const ACTIVE = "active";
const RELEASED = "released";
const UNAVAILABLE = "unavailable";

export function createWakeLockController({
  wakeLock = null,
  document = null,
  onChange = () => {},
} = {}) {
  let state = wakeLock?.request ? RELEASED : UNAVAILABLE;
  let sentinel = null;

  return {
    async request() {
      if (!wakeLock?.request) {
        state = UNAVAILABLE;
        notifyChange();
        return this.snapshot();
      }

      try {
        sentinel = await wakeLock.request("screen");
        state = ACTIVE;
        sentinel.addEventListener?.("release", () => {
          state = RELEASED;
          notifyChange();
        });
      } catch {
        state = UNAVAILABLE;
      }

      notifyChange();
      return this.snapshot();
    },
    bindVisibilityRecovery() {
      document?.addEventListener?.("visibilitychange", () => this.recoverIfVisible());
    },
    async recoverIfVisible() {
      if (document?.visibilityState === "visible" && state === RELEASED) {
        return this.request();
      }

      return this.snapshot();
    },
    async release() {
      await sentinel?.release?.();
      state = RELEASED;
      notifyChange();
      return this.snapshot();
    },
    snapshot() {
      return {
        state,
        label: formatWakeLockState(state),
      };
    },
  };

  function notifyChange() {
    onChange({
      state,
      label: formatWakeLockState(state),
    });
  }
}

export function createBrowserWakeLockController(browser = globalThis, options = {}) {
  return createWakeLockController({
    wakeLock: browser.navigator?.wakeLock,
    document: browser.document,
    ...options,
  });
}

function formatWakeLockState(state) {
  const labels = {
    [ACTIVE]: "Active",
    [RELEASED]: "Released",
    [UNAVAILABLE]: "Unavailable",
  };

  return labels[state] ?? "Unavailable";
}
