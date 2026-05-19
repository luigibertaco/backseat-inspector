const DEFAULT_HOLD_MS = 700;
const DEFAULT_DECAY_PER_SECOND = 0.62;
const DEFAULT_SMOOTHING = 0.45;
const MAX_COMFORT_ACCELERATION = 3.2;

export function createComfortSignal({
  holdMs = DEFAULT_HOLD_MS,
  decayPerSecond = DEFAULT_DECAY_PER_SECOND,
  smoothing = DEFAULT_SMOOTHING,
} = {}) {
  let level = 0;
  let lastTimestamp = 0;
  let holdUntil = 0;

  return {
    observeMotionSample(sample) {
      const timestamp = sample?.timestamp ?? lastTimestamp;
      const nextLevel = sampleToLevel(sample);

      level = Math.max(level, level + (nextLevel - level) * smoothing);
      lastTimestamp = timestamp;
      holdUntil = timestamp + holdMs;

      return snapshot();
    },
    tick(timestamp = lastTimestamp) {
      if (timestamp > holdUntil) {
        const elapsedSeconds = Math.max(0, timestamp - Math.max(lastTimestamp, holdUntil)) / 1000;
        level = Math.max(0, level - decayPerSecond * elapsedSeconds);
      }

      lastTimestamp = timestamp;

      return snapshot();
    },
    snapshot,
  };

  function snapshot() {
    return {
      level: roundLevel(level),
      tone: toneForLevel(level),
      className: `comfort-signal-${toneForLevel(level)}`,
    };
  }
}

export function toneForLevel(level) {
  if (level >= 0.82) {
    return "strong";
  }

  if (level >= 0.58) {
    return "uncomfortable";
  }

  if (level >= 0.28) {
    return "noticeable";
  }

  return "calm";
}

function sampleToLevel(sample) {
  const vector = sample?.acceleration ?? sample?.accelerationIncludingGravity;
  const magnitude = vectorMagnitude(vector);

  return Math.min(1, magnitude / MAX_COMFORT_ACCELERATION);
}

function vectorMagnitude(vector) {
  if (!vector) {
    return 0;
  }

  const x = finiteNumber(vector.x);
  const y = finiteNumber(vector.y);
  const z = finiteNumber(vector.z);

  return Math.sqrt(x * x + y * y + z * z);
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function roundLevel(value) {
  return Math.round(value * 1000) / 1000;
}
