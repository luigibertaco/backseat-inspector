const GRAVITY_METERS_PER_SECOND = 9.81;
const HORIZONTAL_LEVEL_WARNING_DEGREES = 12;
const PLACEMENT_DRIFT_WARNING_DEGREES = 8;
const STABILITY_WARNING_RMS = 0.35;

export function calibrateStoppedPhone({ mountingMode, samples }) {
  const vectors = samples.map((sample) => sample.accelerationIncludingGravity);
  const gravity = averageVector(vectors);
  const levelDegrees = angleBetweenDegrees(gravity, { x: 0, y: 0, z: GRAVITY_METERS_PER_SECOND });
  const driftDegrees = calculateDriftDegrees(vectors);
  const rmsNoise = calculateRmsNoise(vectors, gravity);
  const warnings = [];
  const confidenceMarkers = [];

  if (mountingMode === "horizontal-console" && levelDegrees > HORIZONTAL_LEVEL_WARNING_DEGREES) {
    warnings.push("Phone should be closer to level before starting high-confidence horizontal calibration.");
    confidenceMarkers.push({
      type: "tilted-phone",
      severity: "medium",
      reason: "Stopped-phone calibration detected horizontal placement outside the levelness threshold.",
    });
  }

  if (driftDegrees > PLACEMENT_DRIFT_WARNING_DEGREES) {
    warnings.push("Phone moved or slipped during calibration. Re-seat it before starting a high-confidence Trip.");
    confidenceMarkers.push({
      type: "moved-phone",
      severity: "high",
      reason: "Stopped-phone calibration detected a placement change while parked.",
    });
  }

  if (rmsNoise > STABILITY_WARNING_RMS) {
    warnings.push("Keep the stopped phone stable before starting a high-confidence Trip.");
    confidenceMarkers.push({
      type: "unstable-phone",
      severity: "medium",
      reason: "Stopped-phone calibration detected too much sensor variation while parked.",
    });
  }
  const confidence = confidenceMarkers.length > 0 ? "low" : "high";

  return {
    mountingMode,
    confidence,
    canStartHighConfidence: confidence === "high",
    warnings,
    confidenceMarkers,
    placement: {
      levelDegrees,
      driftDegrees,
      gravity,
    },
    stability: {
      rmsNoise,
    },
  };
}

function calculateDriftDegrees(vectors) {
  const midpoint = Math.floor(vectors.length / 2);
  const firstGravity = averageVector(vectors.slice(0, midpoint));
  const lastGravity = averageVector(vectors.slice(midpoint));

  return angleBetweenDegrees(firstGravity, lastGravity);
}

function averageVector(vectors) {
  const total = vectors.reduce(
    (sum, vector) => ({
      x: sum.x + vector.x,
      y: sum.y + vector.y,
      z: sum.z + vector.z,
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: total.x / vectors.length,
    y: total.y / vectors.length,
    z: total.z / vectors.length,
  };
}

function calculateRmsNoise(vectors, mean) {
  const squaredNoise = vectors.map((vector) => {
    const dx = vector.x - mean.x;
    const dy = vector.y - mean.y;
    const dz = vector.z - mean.z;

    return dx * dx + dy * dy + dz * dz;
  });
  const meanSquaredNoise =
    squaredNoise.reduce((total, value) => total + value, 0) / squaredNoise.length;

  return Math.sqrt(meanSquaredNoise);
}

function angleBetweenDegrees(first, second) {
  const firstMagnitude = magnitude(first);
  const secondMagnitude = magnitude(second);
  const cosine = dotProduct(first, second) / (firstMagnitude * secondMagnitude);
  const clampedCosine = Math.max(-1, Math.min(1, cosine));

  return (Math.acos(clampedCosine) * 180) / Math.PI;
}

function magnitude(vector) {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
}

function dotProduct(first, second) {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}
